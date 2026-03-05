import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders } from '../_shared/supabase-client.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    // Try TinyURL (most reliable, no API key needed)
    try {
      const res = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
      )
      if (res.ok) {
        const text = await res.text()
        if (text.startsWith('https://')) {
          return new Response(JSON.stringify({ short_url: text.trim() }), {
            headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
          })
        }
      }
    } catch { /* fallthrough */ }

    // Fallback: is.gd
    try {
      const res = await fetch(
        `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
      )
      if (res.ok) {
        const text = await res.text()
        if (text.startsWith('https://')) {
          return new Response(JSON.stringify({ short_url: text.trim() }), {
            headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
          })
        }
      }
    } catch { /* fallthrough */ }

    return new Response(
      JSON.stringify({ error: 'All shortening services failed' }),
      {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      }
    )
  }
})
