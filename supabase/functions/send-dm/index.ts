import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { jsonResponse, corsHeaders, getServiceClient } from '../_shared/supabase-client.ts'
import { getMetaToken } from '../_shared/meta-token.ts'

const FB_API = 'https://graph.facebook.com/v21.0'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  try {
    const { recipient_id, message } = await req.json()
    if (!recipient_id || !message?.trim()) {
      return jsonResponse({ error: 'recipient_id and message are required' }, 400)
    }

    const accessToken = await getMetaToken('instagram')

    const res = await fetch(`${FB_API}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipient_id },
        message: { text: message.trim() },
        access_token: accessToken,
      }),
    })

    const data = await res.json()

    if (data.error) {
      return jsonResponse({ error: data.error.message || JSON.stringify(data.error) }, 400)
    }

    // Log to DB
    const supabase = getServiceClient()
    const { data: convo } = await supabase
      .from('human_agent_conversations')
      .select('id')
      .eq('ig_user_id', recipient_id)
      .single()

    if (convo) {
      await supabase.from('human_agent_messages').insert({
        conversation_id: convo.id,
        direction: 'outgoing',
        message_text: message.trim(),
        status: 'sent',
        is_ai: false,
      })
      await supabase
        .from('human_agent_conversations')
        .update({ last_message_at: new Date().toISOString(), messages_count: supabase.rpc('increment' as any) })
        .eq('id', convo.id)
    }

    return jsonResponse({ success: true, message_id: data.message_id })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
