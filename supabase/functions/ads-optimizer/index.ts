import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'
import { getMetaCredentials, metaPost, rateLimit } from '../_shared/meta-api.ts'

// ---------------------------------------------------------------------------
// ABRAhub Ads Optimizer v2 — Full Autonomous Brain
// Engines: Kill & Scale (rules-driven) + Sandbox (auto-tag/promote/degrade)
// Supports: approval mode (pending_actions) or direct execution
// ---------------------------------------------------------------------------

interface Campaign {
  campaign_id: string
  name: string
  status: string
  spend: number
  ctr: number
  cpc: number
  conversions: number
  cost_per_result: number
  daily_budget: number | null
  impressions: number
  clicks: number
  frequency: number
  campaign_tag: string
  creative_theme: string | null
  created_time: string | null
}

interface Config {
  target_cpa: number
  min_roas: number
  max_cpa_multiplier: number
  min_daily_budget: number
  max_daily_budget: number
  budget_increase_pct: number
  budget_decrease_pct: number
  min_spend_to_evaluate: number
  min_impressions_to_evaluate: number
  approval_mode_enabled: boolean
  kill_min_spend: number
  kill_min_ctr: number
  kill_max_frequency: number
  kill_frequency_days: number
  scale_increase_pct: number
  scale_interval_hours: number
  scale_max_cpa_pct: number
  sandbox_min_spend_pct: number
  sandbox_test_days: number
  optimizer_enabled: boolean
  auto_pause_enabled: boolean
  auto_boost_enabled: boolean
}

interface AutomationRule {
  id: string
  rule_type: 'kill' | 'scale'
  name: string
  conditions: Record<string, unknown>
  action_config: Record<string, unknown>
  enabled: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logAutomation(
  supabase: ReturnType<typeof getServiceClient>,
  ruleId: string | null,
  ruleName: string,
  ruleType: string,
  campaignId: string,
  campaignName: string,
  actionTaken: string,
  details: Record<string, unknown>,
) {
  await supabase.from('ads_automation_log').insert({
    rule_id: ruleId,
    rule_name: ruleName,
    rule_type: ruleType,
    campaign_id: campaignId,
    campaign_name: campaignName,
    action_taken: actionTaken,
    details,
  })
}

async function logAgentAction(
  supabase: ReturnType<typeof getServiceClient>,
  actionType: string,
  campaignId: string | null,
  status: 'success' | 'error',
  details: Record<string, unknown>,
) {
  await supabase.from('ads_agent_actions').insert({
    action_type: actionType,
    campaign_id: campaignId,
    status,
    details,
    source: 'ads-optimizer',
    created_at: new Date().toISOString(),
  })
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  const then = new Date(dateStr).getTime()
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// KILL ENGINE — pause underperformers based on ads_automation_rules
// ---------------------------------------------------------------------------

async function runKillEngine(
  supabase: ReturnType<typeof getServiceClient>,
  campaigns: Campaign[],
  config: Config,
  rules: AutomationRule[],
  accessToken: string,
  approvalMode: boolean,
): Promise<{ killed: number; pending: number; details: string[] }> {
  let killed = 0
  let pending = 0
  const details: string[] = []

  const activeCampaigns = campaigns.filter(c =>
    c.status === 'ACTIVE' && c.spend >= config.min_spend_to_evaluate
  )

  const avgCpa = (() => {
    const withConv = campaigns.filter(c => c.conversions > 0)
    if (withConv.length === 0) return config.target_cpa
    const totalSpend = withConv.reduce((s, c) => s + c.spend, 0)
    const totalConv = withConv.reduce((s, c) => s + c.conversions, 0)
    return totalConv > 0 ? totalSpend / totalConv : config.target_cpa
  })()

  for (const campaign of activeCampaigns) {
    let shouldKill = false
    let killReason = ''
    let matchedRule: AutomationRule | null = null

    // Check each enabled kill rule from DB
    for (const rule of rules.filter(r => r.rule_type === 'kill' && r.enabled)) {
      const cond = rule.conditions
      const metric = cond.metric as string

      if (metric === 'ctr') {
        const threshold = cond.value as number
        const minSpend = (cond.min_spend as number) || config.kill_min_spend
        if (campaign.spend >= minSpend && campaign.ctr < threshold) {
          shouldKill = true
          killReason = `${rule.name}: CTR ${campaign.ctr.toFixed(2)}% < ${threshold}% com gasto R$${campaign.spend.toFixed(2)}`
          matchedRule = rule
          break
        }
      }

      if (metric === 'cpa_multiplier') {
        const multiplier = cond.value as number
        const minConv = (cond.min_conversions as number) ?? 0
        if (campaign.conversions <= minConv && campaign.spend > avgCpa * multiplier) {
          shouldKill = true
          killReason = `${rule.name}: Gasto R$${campaign.spend.toFixed(2)} > ${multiplier}x CPA medio (R$${avgCpa.toFixed(2)}) sem conversoes`
          matchedRule = rule
          break
        }
      }

      if (metric === 'frequency') {
        const maxFreq = cond.value as number
        if (campaign.frequency > maxFreq) {
          shouldKill = true
          killReason = `${rule.name}: Frequencia ${campaign.frequency.toFixed(1)} > ${maxFreq}`
          matchedRule = rule
          break
        }
      }
    }

    // Fallback: built-in config rules (if no rule matched but campaign is bad)
    if (!shouldKill) {
      if (campaign.cost_per_result > 0 && campaign.cost_per_result > config.target_cpa * config.max_cpa_multiplier) {
        shouldKill = true
        killReason = `CPA R$${campaign.cost_per_result.toFixed(2)} > ${config.max_cpa_multiplier}x target CPA R$${config.target_cpa.toFixed(2)}`
      } else if (campaign.conversions === 0 && campaign.spend > config.target_cpa * 3) {
        shouldKill = true
        killReason = `R$${campaign.spend.toFixed(2)} gasto sem conversoes (> 3x target CPA)`
      }
    }

    if (!shouldKill) continue

    if (approvalMode) {
      await supabase.from('ads_pending_actions').insert({
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.name,
        action_type: 'pause',
        ai_reasoning: killReason,
        current_metrics: {
          spend: campaign.spend, ctr: campaign.ctr, cpa: campaign.cost_per_result,
          conversions: campaign.conversions, frequency: campaign.frequency,
        },
        proposed_changes: { new_status: 'PAUSED' },
        status: 'pending',
      })
      pending++
      details.push(`[PENDING] Kill "${campaign.name}": ${killReason}`)
      await logAutomation(supabase, matchedRule?.id || null, matchedRule?.name || 'Config Rule',
        'kill', campaign.campaign_id, campaign.name, 'pending_approval', { reason: killReason })
    } else {
      try {
        await rateLimit()
        await metaPost(campaign.campaign_id, { status: 'PAUSED' }, accessToken)
        await supabase.from('ads_campaigns').update({ status: 'PAUSED' }).eq('campaign_id', campaign.campaign_id)
        killed++
        details.push(`[KILLED] "${campaign.name}": ${killReason}`)
        await logAutomation(supabase, matchedRule?.id || null, matchedRule?.name || 'Config Rule',
          'kill', campaign.campaign_id, campaign.name, 'paused', { reason: killReason })
        await logAgentAction(supabase, 'auto_pause', campaign.campaign_id, 'success',
          { reason: killReason, rule: matchedRule?.name })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        details.push(`[ERROR] Kill "${campaign.name}": ${msg}`)
        await logAgentAction(supabase, 'auto_pause', campaign.campaign_id, 'error', { error: msg, reason: killReason })
      }
    }
  }

  return { killed, pending, details }
}

// ---------------------------------------------------------------------------
// SCALE ENGINE — increase budget on winners
// ---------------------------------------------------------------------------

async function runScaleEngine(
  supabase: ReturnType<typeof getServiceClient>,
  campaigns: Campaign[],
  config: Config,
  rules: AutomationRule[],
  accessToken: string,
  approvalMode: boolean,
): Promise<{ scaled: number; pending: number; details: string[] }> {
  let scaled = 0
  let pending = 0
  const details: string[] = []

  const activeCampaigns = campaigns.filter(c =>
    c.status === 'ACTIVE' && c.conversions > 0 && c.spend > 0
  )

  for (const campaign of activeCampaigns) {
    let shouldScale = false
    let scaleReason = ''
    let scalePct = config.scale_increase_pct
    let matchedRule: AutomationRule | null = null

    for (const rule of rules.filter(r => r.rule_type === 'scale' && r.enabled)) {
      const cond = rule.conditions
      const actionCfg = rule.action_config
      const metric = cond.metric as string

      if (metric === 'cpa') {
        const minConv = (cond.min_conversions as number) || 3
        const minDays = (cond.min_days_active as number) || 4
        const daysActive = daysSince(campaign.created_time)
        if (campaign.conversions >= minConv && daysActive >= minDays &&
            campaign.cost_per_result > 0 && campaign.cost_per_result < config.target_cpa) {
          shouldScale = true
          scaleReason = `${rule.name}: CPA R$${campaign.cost_per_result.toFixed(2)} < target R$${config.target_cpa.toFixed(2)} com ${campaign.conversions} conv em ${daysActive}d`
          scalePct = (actionCfg.pct as number) || config.scale_increase_pct
          matchedRule = rule
          break
        }
      }

      if (metric === 'roas') {
        const minRoas = cond.value as number
        const minSpend = (cond.min_spend as number) || 50
        const estimatedRevenue = campaign.conversions * config.target_cpa
        const roas = campaign.spend > 0 ? estimatedRevenue / campaign.spend : 0
        if (roas > minRoas && campaign.spend >= minSpend) {
          shouldScale = true
          scaleReason = `${rule.name}: ROAS estimado ${roas.toFixed(2)}x > ${minRoas}x`
          scalePct = (actionCfg.pct as number) || 30
          matchedRule = rule
          break
        }
      }
    }

    // Fallback: built-in scale rule
    if (!shouldScale && campaign.cost_per_result > 0 && campaign.cost_per_result < config.target_cpa * 0.7 && campaign.conversions >= 3) {
      shouldScale = true
      scaleReason = `CPA excelente R$${campaign.cost_per_result.toFixed(2)} (< 70% target) com ${campaign.conversions} conv`
    }

    if (!shouldScale) continue

    const currentBudget = campaign.daily_budget || config.min_daily_budget
    const newBudget = Math.min(
      Math.round((currentBudget * (1 + scalePct / 100)) * 100) / 100,
      config.max_daily_budget
    )

    if (newBudget <= currentBudget) continue

    if (approvalMode) {
      await supabase.from('ads_pending_actions').insert({
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.name,
        action_type: 'boost',
        ai_reasoning: scaleReason,
        current_metrics: {
          spend: campaign.spend, cpa: campaign.cost_per_result,
          conversions: campaign.conversions, daily_budget: currentBudget,
        },
        proposed_changes: { old_budget: currentBudget, new_budget: newBudget, increase_pct: scalePct },
        status: 'pending',
      })
      pending++
      details.push(`[PENDING] Scale "${campaign.name}": ${scaleReason} (R$${currentBudget} -> R$${newBudget})`)
      await logAutomation(supabase, matchedRule?.id || null, matchedRule?.name || 'Config Rule',
        'scale', campaign.campaign_id, campaign.name, 'pending_approval',
        { reason: scaleReason, old_budget: currentBudget, new_budget: newBudget })
    } else {
      try {
        await rateLimit()
        await metaPost(campaign.campaign_id, { daily_budget: String(Math.round(newBudget * 100)) }, accessToken)
        await supabase.from('ads_campaigns').update({ daily_budget: newBudget }).eq('campaign_id', campaign.campaign_id)
        scaled++
        details.push(`[SCALED] "${campaign.name}": R$${currentBudget} -> R$${newBudget} (${scaleReason})`)
        await logAutomation(supabase, matchedRule?.id || null, matchedRule?.name || 'Config Rule',
          'scale', campaign.campaign_id, campaign.name, 'budget_increased',
          { reason: scaleReason, old_budget: currentBudget, new_budget: newBudget })
        await logAgentAction(supabase, 'auto_scale', campaign.campaign_id, 'success',
          { reason: scaleReason, old_budget: currentBudget, new_budget: newBudget })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        details.push(`[ERROR] Scale "${campaign.name}": ${msg}`)
        await logAgentAction(supabase, 'auto_scale', campaign.campaign_id, 'error', { error: msg })
      }
    }
  }

  return { scaled, pending, details }
}

// ---------------------------------------------------------------------------
// SANDBOX ENGINE — auto-tag, promote, degrade campaigns
// ---------------------------------------------------------------------------

async function runSandboxEngine(
  supabase: ReturnType<typeof getServiceClient>,
  campaigns: Campaign[],
  config: Config,
): Promise<{ tagged: number; promoted: number; degraded: number; details: string[] }> {
  let promoted = 0
  let tagged = 0
  let degraded = 0
  const details: string[] = []

  for (const campaign of campaigns) {
    const isActive = campaign.status === 'ACTIVE'
    const tag = campaign.campaign_tag || 'untagged'
    const daysActive = daysSince(campaign.created_time)
    const testDays = config.sandbox_test_days || 7

    // 1. AUTO-TAG: New active campaigns without tag -> challenger
    if (tag === 'untagged' && isActive) {
      await supabase.from('ads_campaigns')
        .update({ campaign_tag: 'challenger' })
        .eq('campaign_id', campaign.campaign_id)
      tagged++
      details.push(`[TAG] "${campaign.name}" -> challenger (nova campanha)`)
      await logAutomation(supabase, null, 'Sandbox Auto-Tag', 'sandbox',
        campaign.campaign_id, campaign.name, 'tagged_challenger',
        { reason: 'Nova campanha ativa sem tag — marcada como challenger' })
      continue
    }

    // 2. PROMOTE: Challenger -> Champion after test period with good metrics
    if (tag === 'challenger' && isActive) {
      const passedTest = daysActive >= testDays
      const hasConversions = campaign.conversions >= 3
      const cpaBelowTarget = campaign.cost_per_result > 0 && campaign.cost_per_result <= config.target_cpa
      const goodCtr = campaign.ctr >= (config.kill_min_ctr || 0.5)

      if (passedTest && hasConversions && cpaBelowTarget && goodCtr) {
        await supabase.from('ads_campaigns')
          .update({ campaign_tag: 'champion' })
          .eq('campaign_id', campaign.campaign_id)
        promoted++
        details.push(`[PROMOTE] "${campaign.name}" challenger -> champion (${campaign.conversions} conv, CPA R$${campaign.cost_per_result.toFixed(2)}, ${daysActive}d)`)
        await logAutomation(supabase, null, 'Sandbox Promotion', 'sandbox',
          campaign.campaign_id, campaign.name, 'promoted_to_champion',
          { conversions: campaign.conversions, cpa: campaign.cost_per_result, ctr: campaign.ctr, days_active: daysActive })
      }
    }

    // 3. DEGRADE: Champion -> challenger if performance drops
    if (tag === 'champion' && isActive) {
      const highFreq = campaign.frequency > (config.kill_max_frequency || 4)
      const lowCtr = campaign.ctr < (config.kill_min_ctr || 0.5) && campaign.spend > config.min_spend_to_evaluate
      const cpaTooHigh = campaign.cost_per_result > config.target_cpa * config.max_cpa_multiplier && campaign.conversions > 0

      if (highFreq || lowCtr || cpaTooHigh) {
        const reasons: string[] = []
        if (highFreq) reasons.push(`freq ${campaign.frequency.toFixed(1)}`)
        if (lowCtr) reasons.push(`CTR ${campaign.ctr.toFixed(2)}%`)
        if (cpaTooHigh) reasons.push(`CPA R$${campaign.cost_per_result.toFixed(2)}`)

        await supabase.from('ads_campaigns')
          .update({ campaign_tag: 'challenger' })
          .eq('campaign_id', campaign.campaign_id)
        degraded++
        details.push(`[DEGRADE] "${campaign.name}" champion -> challenger (${reasons.join(', ')})`)
        await logAutomation(supabase, null, 'Sandbox Degradation', 'sandbox',
          campaign.campaign_id, campaign.name, 'degraded_to_challenger',
          { reasons })
      }
    }
  }

  return { tagged, promoted, degraded, details }
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const startTime = Date.now()

  try {
    const supabase = getServiceClient()

    // 1. Load config
    const { data: configRow } = await supabase
      .from('ads_optimization_config')
      .select('*')
      .single()

    if (!configRow) {
      return jsonResponse({ error: 'No optimization config found' }, 500)
    }

    const config = configRow as unknown as Config

    if (!config.optimizer_enabled) {
      return jsonResponse({
        status: 'skipped',
        reason: 'Optimizer disabled in config',
        duration_ms: Date.now() - startTime,
      })
    }

    // 2. Load campaigns
    const { data: campaignRows } = await supabase
      .from('ads_campaigns')
      .select('campaign_id, name, status, spend, ctr, cpc, conversions, cost_per_result, daily_budget, impressions, clicks, frequency, campaign_tag, creative_theme, created_time')

    const campaigns = (campaignRows || []) as unknown as Campaign[]

    // 3. Load automation rules
    const { data: ruleRows } = await supabase
      .from('ads_automation_rules')
      .select('*')
      .eq('enabled', true)

    const rules = (ruleRows || []) as unknown as AutomationRule[]

    // 4. Get Meta credentials
    const { accessToken } = await getMetaCredentials()
    const approvalMode = config.approval_mode_enabled

    // 5. Run all engines
    const killResult = await runKillEngine(supabase, campaigns, config, rules, accessToken, approvalMode)
    const scaleResult = await runScaleEngine(supabase, campaigns, config, rules, accessToken, approvalMode)
    const sandboxResult = await runSandboxEngine(supabase, campaigns, config)

    const duration = Date.now() - startTime

    // 6. Log summary
    await logAgentAction(supabase, 'optimizer_run', null, 'success', {
      duration_ms: duration,
      approval_mode: approvalMode,
      campaigns_evaluated: campaigns.length,
      rules_loaded: rules.length,
      kill: { killed: killResult.killed, pending: killResult.pending },
      scale: { scaled: scaleResult.scaled, pending: scaleResult.pending },
      sandbox: { tagged: sandboxResult.tagged, promoted: sandboxResult.promoted, degraded: sandboxResult.degraded },
    })

    return jsonResponse({
      status: 'completed',
      duration_ms: duration,
      approval_mode: approvalMode,
      campaigns_evaluated: campaigns.length,
      rules_loaded: rules.length,
      kill: killResult,
      scale: scaleResult,
      sandbox: sandboxResult,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('ads-optimizer error:', msg)
    try {
      const supabase = getServiceClient()
      await logAgentAction(supabase, 'optimizer_run', null, 'error', { error: msg })
    } catch { /* best effort */ }
    return jsonResponse({ error: msg, duration_ms: Date.now() - startTime }, 500)
  }
})
