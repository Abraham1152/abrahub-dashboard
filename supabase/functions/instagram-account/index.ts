import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/supabase-client.ts'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
  const userId = Deno.env.get('INSTAGRAM_USER_ID')

  if (!accessToken || !userId) {
    return jsonResponse({ error: 'Instagram credentials not configured' }, 500)
  }

  try {
    const res = await fetch(
      `${GRAPH_API}/${userId}?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${accessToken}`
    )
    const data = await res.json()

    if (data.error) {
      return jsonResponse({ error: data.error.message || 'Instagram API error' }, 500)
    }

    return jsonResponse({
      id: data.id,
      username: data.username || null,
      name: data.name || null,
      profile_picture_url: data.profile_picture_url || null,
      followers_count: data.followers_count || 0,
      media_count: data.media_count || 0,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: msg }, 500)
  }
})
