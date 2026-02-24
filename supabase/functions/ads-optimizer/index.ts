import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'
import { getMetaCredentials, metaPost, rateLimit } from '../_shared/meta-api.ts'

// ─── Types ──────────────────────────────────────────────────────────

interface OptimizationDecision {
  campaign_id: string
  campaign_name: string
  action: 'pause' | 'boost' | 'keep' | 'skip'
  reason: string
  metrics: { spend: number; conversions: number; cpa: number; ctr: number }
}

interface OptimizationConfig {
  optimizer_enabled: boolean
  auto_pause_enabled: boolean
  auto_boost_enabled: boolean
  approval_mode_enabled: boolean
  target_cpa: number
  max_cpa_multiplier: number
  min_spend_to_evaluate: number
  min_impressions_to_evaluate: number
  budget_increase_pct: number
  max_daily_budget: number
}

// ─── Evaluation Logic ───────────────────────────────────────────────

function evaluateCampaign(campaign: any, config: OptimizationConfig): OptimizationDecision {
  const cpa = campaign.cost_per_result || 0
  const spend = campaign.spend || 0
  const metrics = {
    spend,
    conversions: campaign.conversions || 0,
    cpa,
    ctr: campaign.ctr || 0,
  }

  // Skip if insufficient data
  if (spend < config.min_spend_to_evaluate || campaign.impressions < config.min_impressions_to_evaluate) {
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.name,
      action: 'skip',
      reason: 'Dados insuficientes para avaliar',
      metrics,
    }
  }

  // RULE 1: Pause if CPA way too high
  if (cpa > 0 && cpa > config.target_cpa * config.max_cpa_multiplier) {
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.name,
      action: 'pause',
      reason: `CPA (R$${cpa.toFixed(2)}) excede ${config.max_cpa_multiplier}x o target (R$${config.target_cpa})`,
      metrics,
    }
  }

  // RULE 2: Pause if spending but zero conversions after significant spend
  if (campaign.conversions === 0 && spend > config.target_cpa * 3) {
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.name,
      action: 'pause',
      reason: `Gastou R$${spend.toFixed(2)} sem nenhuma conversao`,
      metrics,
    }
  }

  // RULE 3: Boost top performers
  if (cpa > 0 && cpa < config.target_cpa * 0.7 && campaign.conversions >= 3) {
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.name,
      action: 'boost',
      reason: `CPA excelente (R$${cpa.toFixed(2)}), abaixo de 70% do target`,
      metrics,
    }
  }

  // RULE 4: Keep acceptable
  return {
    campaign_id: campaign.campaign_id,
    campaign_name: campaign.name,
    action: 'keep',
    reason: `Performance dentro do aceitavel (CPA: R$${cpa > 0 ? cpa.toFixed(2) : 'N/A'})`,
    metrics,
  }
}

// ─── Main Handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const supabase = getServiceClient()
  const startTime = Date.now()

  try {
    // 1. Fetch optimization config
    const { data: configRows, error: configError } = await supabase
      .from('ads_optimization_config')
      .select('*')
      .limit(1)
      .single()

    if (configError || !configRows) {
      return jsonResponse({ error: 'Configuracao de otimizacao nao encontrada', details: configError?.message }, 500)
    }

    const config = configRows as OptimizationConfig

    // Return early if optimizer is disabled
    if (!config.optimizer_enabled) {
      return jsonResponse({
        success: true,
        message: 'Otimizador desabilitado',
        evaluated: 0,
        paused: 0,
        boosted: 0,
        kept: 0,
        skipped: 0,
        decisions: [],
      })
    }

    // 2. Fetch ALL active campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('ads_campaigns')
      .select('*')
      .eq('status', 'ACTIVE')

    if (campaignsError) {
      return jsonResponse({ error: 'Erro ao buscar campanhas', details: campaignsError.message }, 500)
    }

    if (!campaigns || campaigns.length === 0) {
      return jsonResponse({
        success: true,
        message: 'Nenhuma campanha ativa encontrada',
        evaluated: 0,
        paused: 0,
        boosted: 0,
        kept: 0,
        skipped: 0,
        decisions: [],
      })
    }

    // Get Meta credentials for API calls
    const { accessToken } = getMetaCredentials()

    // 3. Evaluate each campaign against rules
    const decisions: OptimizationDecision[] = campaigns.map((campaign: any) =>
      evaluateCampaign(campaign, config)
    )

    // 4. Execute actions and log decisions
    let pausedCount = 0
    let boostedCount = 0
    let keptCount = 0
    let skippedCount = 0
    let pendingCount = 0
    const errors: string[] = []

    const approvalMode = config.approval_mode_enabled ?? true

    for (const decision of decisions) {
      // ── PAUSE action ──────────────────────────────────────────
      if (decision.action === 'pause' && config.auto_pause_enabled) {

        // ── Approval mode: create pending action instead of executing ──
        if (approvalMode) {
          await supabase.from('ads_pending_actions').insert({
            campaign_id: decision.campaign_id,
            campaign_name: decision.campaign_name,
            action_type: 'pause',
            ai_reasoning: decision.reason,
            current_metrics: decision.metrics,
            proposed_changes: { status: 'PAUSED' },
          })
          pendingCount++
          pausedCount++

          await supabase.from('ads_agent_actions').insert({
            action_type: 'optimizer_pause',
            source: 'optimizer',
            campaign_id: decision.campaign_id,
            campaign_name: decision.campaign_name,
            details: {
              reason: decision.reason,
              metrics: decision.metrics,
              pending_approval: true,
            },
          })
          continue
        }

        // ── Direct execution (approval mode OFF) ──
        try {
          await metaPost(decision.campaign_id, { status: 'PAUSED' }, accessToken)
          await rateLimit()

          const { error: updateError } = await supabase
            .from('ads_campaigns')
            .update({ status: 'PAUSED' })
            .eq('campaign_id', decision.campaign_id)

          if (updateError) {
            errors.push(`DB update failed for pause ${decision.campaign_id}: ${updateError.message}`)
          }

          pausedCount++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`Meta API pause failed for ${decision.campaign_id}: ${msg}`)
        }

        await supabase.from('ads_agent_actions').insert({
          action_type: 'optimizer_pause',
          source: 'optimizer',
          campaign_id: decision.campaign_id,
          campaign_name: decision.campaign_name,
          details: {
            reason: decision.reason,
            metrics: decision.metrics,
          },
        })

      // ── BOOST action ──────────────────────────────────────────
      } else if (decision.action === 'boost' && config.auto_boost_enabled) {

        // Fetch current budget for both approval and direct modes
        const { data: campaignRecord } = await supabase
          .from('ads_campaigns')
          .select('daily_budget')
          .eq('campaign_id', decision.campaign_id)
          .single()

        const currentBudget = campaignRecord?.daily_budget || 0

        if (currentBudget > 0) {
          const newBudget = Math.min(
            currentBudget * (1 + config.budget_increase_pct / 100),
            config.max_daily_budget
          )

          if (newBudget > currentBudget) {
            // ── Approval mode: create pending action ──
            if (approvalMode) {
              await supabase.from('ads_pending_actions').insert({
                campaign_id: decision.campaign_id,
                campaign_name: decision.campaign_name,
                action_type: 'boost',
                ai_reasoning: decision.reason,
                current_metrics: decision.metrics,
                proposed_changes: {
                  old_budget: currentBudget,
                  new_budget: newBudget,
                },
              })
              pendingCount++
              boostedCount++

              await supabase.from('ads_agent_actions').insert({
                action_type: 'optimizer_boost',
                source: 'optimizer',
                campaign_id: decision.campaign_id,
                campaign_name: decision.campaign_name,
                details: {
                  reason: decision.reason,
                  metrics: decision.metrics,
                  old_budget: currentBudget,
                  new_budget: newBudget,
                  pending_approval: true,
                },
              })
              continue
            }

            // ── Direct execution (approval mode OFF) ──
            try {
              await metaPost(
                decision.campaign_id,
                { daily_budget: String(Math.round(newBudget * 100)) },
                accessToken
              )
              await rateLimit()

              const { error: updateError } = await supabase
                .from('ads_campaigns')
                .update({ daily_budget: newBudget })
                .eq('campaign_id', decision.campaign_id)

              if (updateError) {
                errors.push(`DB update failed for boost ${decision.campaign_id}: ${updateError.message}`)
              }

              boostedCount++

              await supabase.from('ads_agent_actions').insert({
                action_type: 'optimizer_boost',
                source: 'optimizer',
                campaign_id: decision.campaign_id,
                campaign_name: decision.campaign_name,
                details: {
                  reason: decision.reason,
                  metrics: decision.metrics,
                  old_budget: currentBudget,
                  new_budget: newBudget,
                },
              })
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error'
              errors.push(`Meta API boost failed for ${decision.campaign_id}: ${msg}`)

              await supabase.from('ads_agent_actions').insert({
                action_type: 'optimizer_boost',
                source: 'optimizer',
                campaign_id: decision.campaign_id,
                campaign_name: decision.campaign_name,
                details: {
                  reason: decision.reason,
                  metrics: decision.metrics,
                  error: msg,
                },
              })
            }
          } else {
            keptCount++
            await supabase.from('ads_agent_actions').insert({
              action_type: 'optimizer_keep',
              source: 'optimizer',
              campaign_id: decision.campaign_id,
              campaign_name: decision.campaign_name,
              details: {
                reason: `${decision.reason} (budget ja no maximo: R$${currentBudget.toFixed(2)})`,
                metrics: decision.metrics,
              },
            })
          }
        } else {
          keptCount++
          await supabase.from('ads_agent_actions').insert({
            action_type: 'optimizer_keep',
            source: 'optimizer',
            campaign_id: decision.campaign_id,
            campaign_name: decision.campaign_name,
            details: {
              reason: `${decision.reason} (budget atual desconhecido, boost nao aplicado)`,
              metrics: decision.metrics,
            },
          })
        }

      // ── KEEP action ───────────────────────────────────────────
      } else if (decision.action === 'keep') {
        keptCount++
        await supabase.from('ads_agent_actions').insert({
          action_type: 'optimizer_keep',
          source: 'optimizer',
          campaign_id: decision.campaign_id,
          campaign_name: decision.campaign_name,
          details: {
            reason: decision.reason,
            metrics: decision.metrics,
          },
        })

      // ── SKIP action ───────────────────────────────────────────
      } else if (decision.action === 'skip') {
        skippedCount++
        await supabase.from('ads_agent_actions').insert({
          action_type: 'optimizer_skip',
          source: 'optimizer',
          campaign_id: decision.campaign_id,
          campaign_name: decision.campaign_name,
          details: {
            reason: decision.reason,
            metrics: decision.metrics,
          },
        })

      // ── Pause/Boost with auto-action disabled ─────────────────
      } else {
        if (decision.action === 'pause') pausedCount++
        if (decision.action === 'boost') boostedCount++

        await supabase.from('ads_agent_actions').insert({
          action_type: `optimizer_${decision.action}`,
          source: 'optimizer',
          campaign_id: decision.campaign_id,
          campaign_name: decision.campaign_name,
          details: {
            reason: decision.reason,
            metrics: decision.metrics,
            auto_action_disabled: true,
          },
        })
      }
    }

    // 6. Return summary
    const elapsed = Date.now() - startTime

    return jsonResponse({
      success: true,
      evaluated: decisions.length,
      paused: pausedCount,
      boosted: boostedCount,
      kept: keptCount,
      skipped: skippedCount,
      pending_approval: pendingCount,
      approval_mode: approvalMode,
      elapsed_ms: elapsed,
      ...(errors.length > 0 ? { errors } : {}),
      decisions: decisions.map((d) => ({
        campaign: d.campaign_name,
        action: d.action,
        reason: d.reason,
      })),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`ads-optimizer fatal error: ${msg}`)
    return jsonResponse({ error: msg }, 500)
  }
})
