import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

// Instagram Graph API now uses Facebook Graph API endpoints
const IG_API = 'https://graph.facebook.com/v21.0'
const FB_API = 'https://graph.facebook.com/v21.0'
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models'

serve(async (req) => {
  // --- CORS preflight ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  // --- GET: Webhook verification ---
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = Deno.env.get('WEBHOOK_VERIFY_TOKEN')

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully')
      return new Response(challenge, { status: 200 })
    }

    return new Response('Forbidden', { status: 403 })
  }

  // --- POST: Receive webhook events ---
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
  const geminiKey = Deno.env.get('GEMINI_API_KEY')

  if (!accessToken) {
    console.error('INSTAGRAM_ACCESS_TOKEN not configured')
    return jsonResponse({ received: true })
  }

  const supabase = getServiceClient()

  try {
    const body = await req.json()

    // Must always return 200 quickly to Meta
    if (body.object !== 'instagram') {
      return jsonResponse({ received: true })
    }

    for (const entry of (body.entry || [])) {
      // --- Handle COMMENT events (changes field) ---
      const changes = entry.changes || []
      for (const change of changes) {
        if (change.field === 'comments') {
          const value = change.value
          if (!value) continue

          const commentId = value.id as string
          const commentText = value.text as string
          const mediaId = value.media?.id as string
          const username = value.from?.username as string

          if (!commentId || !commentText || !mediaId) continue

          console.log(`[WEBHOOK] Comment from @${username}: "${commentText.substring(0, 50)}" on media ${mediaId}`)

          await processComment(supabase, {
            commentId,
            commentText,
            mediaId,
            username: username || 'unknown',
          }, accessToken)
        }
      }

      // --- Handle DM/messaging events ---
      if (geminiKey) {
        const messagingEvents = entry.messaging || []
        for (const event of messagingEvents) {
          if (event.message?.is_echo) continue
          if (!event.message?.text) continue

          const senderId = event.sender?.id
          const messageText = event.message.text
          const messageId = event.message.mid

          if (!senderId || !messageText) continue

          await processMessage(supabase, senderId, messageText, messageId, accessToken, geminiKey)
        }
      }
    }

    return jsonResponse({ received: true })
  } catch (error) {
    console.error('Webhook error:', error instanceof Error ? error.message : error)
    // Always return 200 to avoid Meta retrying
    return jsonResponse({ received: true })
  }
})

// =============================================
// COMMENT AUTOMATION (InstaNinja - real-time)
// =============================================

interface CommentData {
  commentId: string
  commentText: string
  mediaId: string
  username: string
}

async function processComment(
  supabase: ReturnType<typeof getServiceClient>,
  comment: CommentData,
  accessToken: string,
) {
  try {
    // 1. Check if already processed
    const { data: existing } = await supabase
      .from('instagram_processed_comments')
      .select('id')
      .eq('comment_id', comment.commentId)
      .maybeSingle()

    if (existing) {
      console.log(`[WEBHOOK] Comment ${comment.commentId} already processed, skipping`)
      return
    }

    // 2. Find active automations for this media
    const { data: automations } = await supabase
      .from('instagram_automations')
      .select('*')
      .eq('is_active', true)
      .eq('media_id', comment.mediaId)

    if (!automations || automations.length === 0) {
      console.log(`[WEBHOOK] No active automation for media ${comment.mediaId}`)
      return
    }

    for (const automation of automations) {
      // 3. Check keyword match
      const keywords = (automation.keywords as string[]) || []
      const respondToAll = automation.respond_to_all as boolean
      const textLower = comment.commentText.toLowerCase()

      let matched = respondToAll
      if (!matched && keywords.length > 0) {
        matched = keywords.some((kw: string) => textLower.includes(kw.toLowerCase()))
      }

      if (!matched) {
        console.log(`[WEBHOOK] Comment "${comment.commentText.substring(0, 30)}" doesn't match keywords for automation ${automation.id}`)
        continue
      }

      console.log(`[WEBHOOK] MATCH! Processing automation for @${comment.username}`)

      let actionTaken = ''
      let status = 'success'
      let errorMessage = ''

      // 4. Reply to comment publicly
      const replyComments = (automation.reply_comments as string[]) || []
      if (replyComments.length > 0) {
        const randomReply = replyComments[Math.floor(Math.random() * replyComments.length)]
        try {
          const replyRes = await fetch(`${IG_API}/${comment.commentId}/replies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: randomReply,
              access_token: accessToken,
            }),
          })
          const replyData = await replyRes.json()
          if (replyData.error) {
            errorMessage += `Reply error: ${(replyData.error as Record<string, unknown>).message || JSON.stringify(replyData.error)}; `
            status = 'error'
            console.error(`[WEBHOOK] Reply error:`, replyData.error)
          } else {
            actionTaken += 'reply'
            console.log(`[WEBHOOK] Replied to comment: "${randomReply.substring(0, 40)}"`)
          }
        } catch (e) {
          errorMessage += `Reply exception: ${e instanceof Error ? e.message : 'unknown'}; `
          status = 'error'
        }
      }

      // 5. Send DM (private reply via comment_id)
      const dmMessage = automation.dm_message as string
      const dmLink = automation.dm_link as string
      const dmButtons = (automation.dm_buttons as Array<{ url: string; title: string }>) || []

      if (dmMessage || dmButtons.length > 0) {
        try {
          let messagePayload: Record<string, unknown>

          if (dmButtons.length > 0) {
            messagePayload = {
              attachment: {
                type: 'template',
                payload: {
                  template_type: 'button',
                  text: dmMessage || 'Confira:',
                  buttons: dmButtons.map(btn => ({
                    type: 'web_url',
                    url: btn.url,
                    title: btn.title,
                  })),
                },
              },
            }
          } else {
            const fullDmText = dmLink ? `${dmMessage}\n\n${dmLink}` : dmMessage
            messagePayload = { text: fullDmText }
          }

          // Try IG API first, then FB API as fallback
          let dmData: Record<string, unknown> | null = null

          const igRes = await fetch(`${IG_API}/me/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { comment_id: comment.commentId },
              message: messagePayload,
              access_token: accessToken,
            }),
          })
          const igText = await igRes.text()
          try {
            dmData = JSON.parse(igText)
          } catch {
            dmData = null
          }

          if (!dmData || dmData.error) {
            // Fallback to Facebook Graph API
            const fbRes = await fetch(`${FB_API}/me/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { comment_id: comment.commentId },
                message: messagePayload,
                access_token: accessToken,
              }),
            })
            dmData = await fbRes.json()
          }

          if (dmData?.error) {
            errorMessage += `DM error: ${(dmData.error as Record<string, unknown>).message || JSON.stringify(dmData.error)}; `
            status = actionTaken ? 'partial' : 'error'
            console.error(`[WEBHOOK] DM error:`, dmData.error)
          } else {
            actionTaken += actionTaken ? '+dm' : 'dm'
            console.log(`[WEBHOOK] DM sent to @${comment.username}`)
          }
        } catch (e) {
          errorMessage += `DM exception: ${e instanceof Error ? e.message : 'unknown'}; `
          status = actionTaken ? 'partial' : 'error'
        }
      }

      if (!actionTaken) actionTaken = 'none'

      // 6. Log the processed comment
      await supabase.from('instagram_processed_comments').insert({
        comment_id: comment.commentId,
        automation_id: automation.id,
        commenter_username: comment.username,
        comment_text: comment.commentText.substring(0, 500),
        action_taken: actionTaken,
        status,
        error_message: errorMessage || null,
      })

      // 7. Upsert lead for this commenter
      try {
        await supabase.rpc('upsert_lead', {
          p_username: comment.username,
          p_ig_user_id: null,
          p_source: 'automation_comment',
          p_source_automation_id: automation.id,
        })
      } catch (e) {
        console.error('[WEBHOOK] Lead upsert error:', e instanceof Error ? e.message : e)
      }

      console.log(`[WEBHOOK] Done processing comment ${comment.commentId}: action=${actionTaken}, status=${status}`)
    }
  } catch (error) {
    console.error('[WEBHOOK] processComment error:', error instanceof Error ? error.message : error)
  }
}

// =============================================
// DM HUMAN AGENT (AI chatbot - existing logic)
// =============================================

async function processMessage(
  supabase: ReturnType<typeof getServiceClient>,
  senderId: string,
  messageText: string,
  messageId: string,
  accessToken: string,
  geminiKey: string
) {
  try {
    // 1. Check if any agent is active
    const { data: config } = await supabase
      .from('human_agent_config')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!config) {
      console.log('Human agent is disabled, skipping message')
      return
    }

    // 2. Resolve sender username via Graph API
    let senderUsername: string | null = null
    try {
      const userRes = await fetch(
        `${FB_API}/${senderId}?fields=name,username&access_token=${accessToken}`
      )
      const userData = await userRes.json()
      if (userData.username) {
        senderUsername = userData.username
      } else if (userData.name) {
        senderUsername = userData.name
      }
    } catch (e) {
      console.log('[WEBHOOK] Could not resolve username for', senderId, e instanceof Error ? e.message : e)
    }

    // 3. Find or create conversation
    let { data: conversation } = await supabase
      .from('human_agent_conversations')
      .select('*')
      .eq('ig_user_id', senderId)
      .single()

    if (!conversation) {
      const { data: newConvo } = await supabase
        .from('human_agent_conversations')
        .insert({
          ig_user_id: senderId,
          ig_username: senderUsername,
          status: 'active',
          messages_count: 0,
        })
        .select()
        .single()

      conversation = newConvo
    } else if (senderUsername && !conversation.ig_username) {
      // Update username if we resolved it and it wasn't set before
      await supabase
        .from('human_agent_conversations')
        .update({ ig_username: senderUsername })
        .eq('id', conversation.id)
      conversation.ig_username = senderUsername
    }

    if (!conversation) {
      console.error('Failed to create/find conversation for', senderId)
      return
    }

    // 3. Save incoming message
    await supabase.from('human_agent_messages').insert({
      conversation_id: conversation.id,
      ig_user_id: senderId,
      direction: 'incoming',
      message_text: messageText,
      ig_message_id: messageId,
      status: 'received',
    })

    // 3.5 Check if conversation is paused (human took over)
    if (conversation.status === 'paused') {
      console.log(`[WEBHOOK] Conversation ${conversation.id} is paused (human mode), skipping AI response`)
      return
    }

    // 3.6 Keyword gating: check if AI should respond
    const requireKeyword = config.require_keyword !== false // default true
    const triggerKeywords = (config.trigger_keywords as string[]) || []

    if (requireKeyword && triggerKeywords.length > 0) {
      const textLower = messageText.toLowerCase()
      const keywordMatched = triggerKeywords.some((kw: string) => textLower.includes(kw.toLowerCase()))

      if (keywordMatched) {
        // Keyword matched → activate AI for this conversation
        if (conversation.status !== 'ai_active') {
          await supabase.from('human_agent_conversations')
            .update({ status: 'ai_active' })
            .eq('id', conversation.id)
          console.log(`[WEBHOOK] Keyword "${messageText.substring(0, 30)}" matched, activating AI for ${senderId}`)
        }
      } else if (conversation.status !== 'ai_active') {
        // No keyword match and conversation is not AI-activated → skip
        console.log(`[WEBHOOK] No keyword match for "${messageText.substring(0, 30)}", skipping AI response`)
        return
      }
      // If conversation.status === 'ai_active' → continue responding (ongoing conversation)
    }

    // Also upsert lead from DM interaction
    try {
      await supabase.rpc('upsert_lead', {
        p_username: senderUsername || conversation.ig_username || senderId,
        p_ig_user_id: senderId,
        p_source: 'dm',
      })
    } catch (e) {
      console.error('Lead upsert error:', e instanceof Error ? e.message : e)
    }

    // 4. Get conversation history
    const maxHistory = config.max_history_messages || 10
    const { data: historyRows } = await supabase
      .from('human_agent_messages')
      .select('direction, message_text')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(maxHistory)

    const isSalesAgent = config.agent_type === 'sales'

    // 5. Build Gemini request (different for sales vs support)
    let systemInstruction: string
    let products: Array<Record<string, unknown>> = []
    let lead: Record<string, unknown> | null = null

    if (isSalesAgent) {
      // Fetch products and lead for sales context
      const { data: productRows } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)

      products = productRows || []

      const { data: leadRow } = await supabase
        .from('instagram_leads')
        .select('*')
        .eq('ig_user_id', senderId)
        .maybeSingle()

      if (!leadRow) {
        // Try by username
        const { data: leadByName } = await supabase
          .from('instagram_leads')
          .select('*')
          .eq('username', conversation.ig_username || senderId)
          .maybeSingle()
        lead = leadByName
      } else {
        lead = leadRow
      }

      systemInstruction = buildSalesInstruction(config, products, lead)
    } else {
      systemInstruction = buildSystemInstruction(config)
    }

    const contents = buildContents(historyRows || [], messageText)

    // 6. Call Gemini API
    const geminiModel = config.gemini_model === 'gemini-2.0-flash' ? 'gemini-2.5-flash' : (config.gemini_model || 'gemini-2.5-flash')
    const geminiResult = await callGemini(geminiKey, geminiModel, systemInstruction, contents)

    if (!geminiResult.text) {
      console.error('Gemini returned empty response:', geminiResult.error)
      // Save debug info as error message so we can check the DB
      await supabase.from('human_agent_messages').insert({
        conversation_id: conversation.id,
        ig_user_id: senderId,
        direction: 'outgoing',
        message_text: `[DEBUG] Gemini failed`,
        status: 'failed',
        error_message: geminiResult.error || 'Unknown error',
      })
      return
    }

    const aiResponse = geminiResult.text

    // 7. Process response (sales agents return JSON, support returns plain text)
    let messageToSend = aiResponse
    let leadUpdate: Record<string, unknown> | null = null
    let sendProductId: string | null = null

    if (isSalesAgent) {
      try {
        // Strip markdown code fences if present
        const cleaned = aiResponse.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
        const parsed = JSON.parse(cleaned)

        if (parsed.message) {
          messageToSend = parsed.message
        }
        if (parsed.lead_update) {
          leadUpdate = parsed.lead_update as Record<string, unknown>
        }
        if (parsed.send_product) {
          sendProductId = parsed.send_product as string
        }
      } catch {
        // If JSON parsing fails, use raw response as message
        console.log('[WEBHOOK] Sales agent response is not JSON, using as plain text')
        messageToSend = aiResponse
      }
    }

    // 8. Send reply via Instagram API
    const sendResult = await sendInstagramMessage(accessToken, senderId, messageToSend)
    const sent = sendResult.success

    // 8.5 Handle sales agent actions
    if (isSalesAgent && lead) {
      // Update lead temperature/status if AI suggested it
      if (leadUpdate) {
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (leadUpdate.temperature && ['hot', 'warm', 'cold'].includes(leadUpdate.temperature as string)) {
          updateData.temperature = leadUpdate.temperature
          updateData.temperature_override = true // AI override counts as manual
        }
        if (leadUpdate.status && ['new', 'contacted', 'negotiating', 'converted', 'lost'].includes(leadUpdate.status as string)) {
          updateData.status = leadUpdate.status
        }
        await supabase.from('instagram_leads').update(updateData).eq('id', lead.id)
        console.log(`[WEBHOOK] Lead ${lead.id} updated:`, JSON.stringify(updateData))
      }

      // Send tracked product link if AI requested it
      if (sendProductId) {
        const product = products.find(p => p.id === sendProductId || p.name === sendProductId)
        if (product) {
          const trackedLink = `${product.payment_link}${(product.payment_link as string).includes('?') ? '&' : '?'}ref=${lead.id}`
          await sendInstagramMessage(accessToken, senderId, trackedLink)

          // Update lead tracking info
          await supabase.from('instagram_leads').update({
            tracked_link_sent: true,
            tracked_product_id: product.id,
            status: 'negotiating',
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id)

          console.log(`[WEBHOOK] Tracked link sent to ${senderId}: ${trackedLink}`)
        }
      }
    }

    // 9. Save outgoing message
    await supabase.from('human_agent_messages').insert({
      conversation_id: conversation.id,
      ig_user_id: senderId,
      direction: 'outgoing',
      message_text: messageToSend,
      status: sent ? 'sent' : 'failed',
      error_message: sent ? null : (sendResult.error || 'Failed to send via Instagram API'),
    })

    // 10. Update conversation counters
    await supabase
      .from('human_agent_conversations')
      .update({
        messages_count: (conversation.messages_count || 0) + 2,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    console.log(`Processed message from ${senderId}: "${messageText.substring(0, 50)}..." -> replied`)
  } catch (error) {
    console.error('processMessage error:', error instanceof Error ? error.message : error)
  }
}

function buildSystemInstruction(config: Record<string, unknown>): string {
  const parts: string[] = []

  if (config.system_prompt) {
    parts.push(config.system_prompt as string)
  }

  if (config.knowledge_base) {
    parts.push('\n\n--- BASE DE CONHECIMENTO ---\n')
    parts.push(config.knowledge_base as string)
    parts.push('\n--- FIM DA BASE DE CONHECIMENTO ---')
  }

  parts.push('\n\nRegras importantes:')
  parts.push('- Responda SEMPRE em portugues brasileiro')
  parts.push('- Seja amigavel e profissional')
  parts.push('- Use apenas informacoes da base de conhecimento')
  parts.push('- Se nao souber a resposta, diga que vai encaminhar para atendimento humano')
  parts.push('- Mantenha respostas curtas e diretas (maximo 500 caracteres)')
  parts.push('- Nao use markdown, apenas texto simples')

  return parts.join('\n')
}

function buildSalesInstruction(
  config: Record<string, unknown>,
  products: Array<Record<string, unknown>>,
  lead: Record<string, unknown> | null,
): string {
  const parts: string[] = []

  // ====== IDENTIDADE E PERSONALIDADE ======
  parts.push(`## QUEM VOCE E
Voce e um vendedor humano real que trabalha atendendo clientes pelo Instagram DM. Voce NAO e um robô, NAO e uma IA, NAO e um assistente virtual. Voce e uma pessoa de verdade conversando com outra pessoa.

Seu nome: ${config.agent_name || 'Atendente'}

PERSONALIDADE:
- Voce fala como um brasileiro normal no direct do Instagram
- Use linguagem informal e natural (mas profissional)
- Pode usar "kkk", "haha", "top", "show", "massa" quando fizer sentido
- NUNCA use emojis. Zero emojis. Nenhum emoji em nenhuma mensagem
- NUNCA use linguagem corporativa robótica tipo "estou à disposição", "fico no aguardo", "agradeço o contato"
- Fale como alguém que realmente usa Instagram, não como um email formal
- Seja genuíno e empático - se coloque no lugar da pessoa`)

  // ====== SYSTEM PROMPT DO USUARIO (personalização extra) ======
  if (config.system_prompt) {
    parts.push(`\n## INSTRUCOES PERSONALIZADAS DO DONO
${config.system_prompt as string}`)
  }

  // ====== BASE DE CONHECIMENTO ======
  if (config.knowledge_base) {
    parts.push(`\n## BASE DE CONHECIMENTO
Use estas informacoes para responder duvidas com propriedade. Nunca invente nada que nao esteja aqui.
---
${config.knowledge_base as string}
---`)
  }

  // ====== CATALOGO DE PRODUTOS ======
  if (products.length > 0) {
    parts.push('\n## CATALOGO DE PRODUTOS')
    parts.push('Estes sao os UNICOS produtos que voce pode vender. NUNCA invente precos ou produtos.')
    for (const p of products) {
      parts.push(`\nPRODUTO: "${p.name}"`)
      parts.push(`  ID: "${p.id}"`)
      parts.push(`  Preco: R$${p.price_brl}`)
      if (p.description) parts.push(`  Descricao: ${p.description}`)
    }
  }

  // ====== CONTEXTO DO LEAD ======
  if (lead) {
    const interactions = lead.interaction_count as number
    const temp = lead.temperature as string
    const status = lead.status as string
    const linkSent = lead.tracked_link_sent as boolean

    parts.push(`\n## CONTEXTO DESSE CLIENTE
- Username: @${lead.username}
- Temperatura: ${temp} (${temp === 'hot' ? 'muito interessado' : temp === 'warm' ? 'curioso mas nao decidido' : 'frio, pouco interesse'})
- Status: ${status}
- Total de interacoes: ${interactions}
- Link de pagamento ja foi enviado: ${linkSent ? 'SIM' : 'NAO'}

${interactions === 0 ? 'PRIMEIRA CONVERSA: Seja acolhedor, pergunte como pode ajudar. NAO tente vender logo de cara.' : ''}
${interactions > 0 && interactions <= 3 ? 'CONVERSA INICIAL: Ja tiveram contato. Construa rapport, entenda a necessidade.' : ''}
${interactions > 3 && temp === 'warm' ? 'LEAD MORNO: Ja conversaram bastante. Hora de direcionar pra solucao se fizer sentido.' : ''}
${temp === 'hot' ? 'LEAD QUENTE: Esse cliente tem interesse forte. Se fizer sentido, apresente o produto e ajude a fechar.' : ''}
${linkSent ? 'ATENCAO: O link JA FOI ENVIADO. NAO envie de novo. Pergunte se conseguiu acessar, se teve alguma duvida, se precisa de ajuda.' : ''}`)
  }

  // ====== TECNICAS DE VENDAS ======
  parts.push(`\n## ESTRATEGIA DE VENDAS (SIGA NESSA ORDEM)

ETAPA 1 - CONEXAO (primeiras mensagens):
- Cumprimente de forma natural, como faria com um amigo
- Pergunte como a pessoa ta, o que ela procura
- ESCUTE mais do que fale. Faca perguntas abertas
- Ex: "e ai, tudo bem? vi que voce se interessou, me conta o que ta buscando"
- NUNCA comece vendendo. Primeiro entenda a pessoa

ETAPA 2 - DESCOBERTA (entendendo a dor):
- Faca 2-3 perguntas sobre a situacao atual da pessoa
- Entenda o problema que ela quer resolver
- Mostre empatia genuina ("entendo total", "faz sentido", "muita gente passa por isso")
- Ex: "e hoje como ta essa parte pra voce?", "qual tua maior dificuldade nisso?"

ETAPA 3 - APRESENTACAO (quando entender a necessidade):
- Conecte o problema da pessoa com a solucao (produto)
- Fale de BENEFICIOS, nao de funcionalidades
- Use prova social se tiver na base de conhecimento
- Seja direto mas nao agressivo
- Ex: "olha, pelo que voce me contou acho que o [produto] ia te ajudar demais porque..."

ETAPA 4 - FECHAMENTO (quando demonstrar interesse):
- So envie o link quando a pessoa demonstrar que QUER comprar
- Sinais de compra: perguntou preco, perguntou forma de pagamento, disse "quero", "me manda"
- Ao enviar: "show! vou te mandar o link aqui, qualquer duvida me chama"
- Use send_product para enviar o link rastreado

ETAPA 5 - FOLLOW UP (pos-link):
- Se o link ja foi enviado e a pessoa nao comprou: pergunte com naturalidade
- "e ai, conseguiu ver la?", "ficou com alguma duvida?"
- NAO pressione. NAO envie o link de novo.`)

  // ====== TRATAMENTO DE OBJECOES ======
  parts.push(`\n## OBJECOES COMUNS E COMO RESPONDER

"Ta caro" / "Nao tenho dinheiro agora":
- Valide: "entendo, investimento precisa fazer sentido ne"
- Reforce o valor: fale do retorno, do que a pessoa ganha
- Se tiver parcelamento: mencione
- NUNCA desvalorize o produto baixando preco

"Vou pensar" / "Depois eu vejo":
- Respeite: "tranquilo, fica a vontade"
- Deixe a porta aberta: "qualquer coisa me chama aqui"
- NAO insista agressivamente
- Faca uma pergunta sutil: "tem alguma duvida que eu possa tirar pra te ajudar a decidir?"

"Tem desconto?" / "Faz por menos?":
- Se NAO tem: "o preco ja ta bem justo pelo que entrega, mas entendo"
- Se tem cupom na base de conhecimento: compartilhe
- NUNCA invente desconto

"Ja comprei algo parecido e nao gostei":
- Empatia: "poxa, entendo total a frustacao"
- Diferencie: explique o que torna esse produto diferente
- Ofereça garantia se existir na base de conhecimento

Pessoa nao responde / monosilabica:
- Mande UMA mensagem de follow up casual
- Se continuar fria: "sem problema, fico por aqui se precisar"
- NAO insista. Marque como cold.`)

  // ====== FORMATO DE RESPOSTA (JSON) ======
  parts.push(`\n## FORMATO DE RESPOSTA (OBRIGATORIO)

Voce DEVE responder SEMPRE com um JSON valido neste formato exato. NADA fora do JSON.

{"message": "sua mensagem aqui", "lead_update": {"temperature": "hot", "status": "negotiating"}, "send_product": null}

CAMPOS:
- "message" (OBRIGATORIO): A mensagem que sera enviada. Texto puro, sem markdown, sem asteriscos, sem negrito.
- "lead_update" (pode ser null): Como classificar esse lead agora:
  - temperature: "hot" = quer comprar / muito interessado, "warm" = curioso / fazendo perguntas, "cold" = desinteressado / nao respondeu bem
  - status: "contacted" = primeiro contato, "negotiating" = esta considerando, "lost" = desistiu / nao quer
- "send_product" (pode ser null): O ID exato do produto para enviar link de pagamento.
  SO USE quando o cliente claramente quer comprar. NUNCA na primeira interacao.

EXEMPLOS:
Primeira msg: {"message": "e ai, tudo bem? vi que voce se interessou! me conta, o que ta buscando?", "lead_update": {"temperature": "warm", "status": "contacted"}, "send_product": null}
Cliente perguntou preco: {"message": "o curso ta R$497, da pra parcelar em ate 12x. pelo que voce me contou acho que ia te ajudar demais com essa parte", "lead_update": {"temperature": "hot", "status": "negotiating"}, "send_product": null}
Cliente quer comprar: {"message": "show! vou te mandar o link aqui, qualquer duvida me chama", "lead_update": {"temperature": "hot", "status": "negotiating"}, "send_product": "uuid-do-produto"}
Cliente desistiu: {"message": "tranquilo, sem problema! fico por aqui se precisar de algo", "lead_update": {"temperature": "cold", "status": "lost"}, "send_product": null}

REGRAS FINAIS:
- Responda SEMPRE em portugues brasileiro
- Mensagens CURTAS (max 300 caracteres). Ninguem le textao no DM
- Uma ideia por mensagem. Seja direto
- NUNCA mencione que voce e uma IA, um bot, ou um agente automatizado
- NUNCA use formato markdown (*negrito*, _italico_). Apenas texto simples
- NUNCA invente produtos, precos ou informacoes que nao estao no catalogo/base de conhecimento
- NUNCA retorne nada fora do JSON`)

  return parts.join('\n')
}

function buildContents(
  history: Array<{ direction: string; message_text: string }>,
  currentMessage: string
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []

  for (const msg of history) {
    // Skip the current message if it's already in history
    if (msg.message_text === currentMessage && msg.direction === 'incoming') continue

    contents.push({
      role: msg.direction === 'incoming' ? 'user' : 'model',
      parts: [{ text: msg.message_text }],
    })
  }

  // Add current message
  contents.push({
    role: 'user',
    parts: [{ text: currentMessage }],
  })

  return contents
}

interface GeminiResult {
  text: string | null
  error: string | null
}

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>
): Promise<GeminiResult> {
  try {
    const res = await fetch(
      `${GEMINI_API}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      }
    )

    const data = await res.json()

    if (data.error) {
      const errMsg = `API error: ${JSON.stringify(data.error).substring(0, 300)}`
      console.error('Gemini API error:', errMsg)
      return { text: null, error: errMsg }
    }

    // Check for safety blocks or empty candidates
    if (!data.candidates || data.candidates.length === 0) {
      const errMsg = `No candidates. promptFeedback: ${JSON.stringify(data.promptFeedback || data).substring(0, 300)}`
      console.error(errMsg)
      return { text: null, error: errMsg }
    }

    const candidate = data.candidates[0]
    if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
      const errMsg = `Blocked: finishReason=${candidate.finishReason}, safetyRatings=${JSON.stringify(candidate.safetyRatings).substring(0, 200)}`
      console.error(errMsg)
      return { text: null, error: errMsg }
    }

    const text = candidate.content?.parts?.[0]?.text
    if (!text) {
      const errMsg = `Empty text. Response: ${JSON.stringify(data).substring(0, 300)}`
      console.error(errMsg)
      return { text: null, error: errMsg }
    }
    return { text, error: null }
  } catch (error) {
    const errMsg = `Fetch error: ${error instanceof Error ? error.message : String(error)}`
    console.error(errMsg)
    return { text: null, error: errMsg }
  }
}

interface SendResult {
  success: boolean
  error: string | null
}

async function sendInstagramMessage(
  accessToken: string,
  recipientId: string,
  text: string
): Promise<SendResult> {
  try {
    // Use Facebook Graph API for messaging (page token works here, not on graph.instagram.com)
    const res = await fetch(`${FB_API}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        access_token: accessToken,
      }),
    })

    const data = await res.json()

    if (data.error) {
      const errMsg = `IG API: ${(data.error as Record<string, unknown>).message || JSON.stringify(data.error).substring(0, 300)}`
      console.error('Instagram send error:', errMsg)
      return { success: false, error: errMsg }
    }

    return { success: true, error: null }
  } catch (error) {
    const errMsg = `IG fetch: ${error instanceof Error ? error.message : String(error)}`
    console.error('Instagram send fetch error:', errMsg)
    return { success: false, error: errMsg }
  }
}
