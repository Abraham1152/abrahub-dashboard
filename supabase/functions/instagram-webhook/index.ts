import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

const IG_API = 'https://graph.instagram.com/v21.0'
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

  if (!geminiKey) {
    console.error('GEMINI_API_KEY not configured')
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
      const messagingEvents = entry.messaging || []

      for (const event of messagingEvents) {
        // Skip echo messages (messages we sent)
        if (event.message?.is_echo) continue

        // Skip non-text messages (stickers, attachments, etc.)
        if (!event.message?.text) continue

        const senderId = event.sender?.id
        const messageText = event.message.text
        const messageId = event.message.mid

        if (!senderId || !messageText) continue

        await processMessage(supabase, senderId, messageText, messageId, accessToken, geminiKey)
      }
    }

    return jsonResponse({ received: true })
  } catch (error) {
    console.error('Webhook error:', error instanceof Error ? error.message : error)
    // Always return 200 to avoid Meta retrying
    return jsonResponse({ received: true })
  }
})

async function processMessage(
  supabase: ReturnType<typeof getServiceClient>,
  senderId: string,
  messageText: string,
  messageId: string,
  accessToken: string,
  geminiKey: string
) {
  try {
    // 1. Check if agent is active
    const { data: configs } = await supabase
      .from('human_agent_config')
      .select('*')
      .limit(1)

    const config = configs?.[0]
    if (!config || !config.is_active) {
      console.log('Human agent is disabled, skipping message')
      return
    }

    // 2. Find or create conversation
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
          status: 'active',
          messages_count: 0,
        })
        .select()
        .single()

      conversation = newConvo
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

    // 4. Get conversation history
    const maxHistory = config.max_history_messages || 10
    const { data: historyRows } = await supabase
      .from('human_agent_messages')
      .select('direction, message_text')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(maxHistory)

    // 5. Build Gemini request
    const systemInstruction = buildSystemInstruction(config)
    const contents = buildContents(historyRows || [], messageText)

    // 6. Call Gemini API
    const geminiModel = config.gemini_model || 'gemini-2.0-flash'
    const aiResponse = await callGemini(geminiKey, geminiModel, systemInstruction, contents)

    if (!aiResponse) {
      console.error('Gemini returned empty response')
      return
    }

    // 7. Send reply via Instagram API
    const sent = await sendInstagramMessage(accessToken, senderId, aiResponse)

    // 8. Save outgoing message
    await supabase.from('human_agent_messages').insert({
      conversation_id: conversation.id,
      ig_user_id: senderId,
      direction: 'outgoing',
      message_text: aiResponse,
      status: sent ? 'sent' : 'failed',
      error_message: sent ? null : 'Failed to send via Instagram API',
    })

    // 9. Update conversation counters
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

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>
): Promise<string | null> {
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
            maxOutputTokens: 300,
            temperature: 0.7,
          },
        }),
      }
    )

    const data = await res.json()

    if (data.error) {
      console.error('Gemini API error:', JSON.stringify(data.error))
      return null
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    return text || null
  } catch (error) {
    console.error('Gemini fetch error:', error instanceof Error ? error.message : error)
    return null
  }
}

async function sendInstagramMessage(
  accessToken: string,
  recipientId: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(`${IG_API}/me/messages`, {
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
      console.error('Instagram send error:', JSON.stringify(data.error))
      return false
    }

    return true
  } catch (error) {
    console.error('Instagram send fetch error:', error instanceof Error ? error.message : error)
    return false
  }
}
