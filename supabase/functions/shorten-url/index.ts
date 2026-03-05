import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, corsHeaders } from '../_shared/supabase-client.ts'

function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

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

    const supabase = getServiceClient()

    // Check if this URL was already shortened
    const { data: existing } = await supabase
      .from('short_links')
      .select('code')
      .eq('target_url', url)
      .limit(1)
      .single()

    if (existing?.code) {
      const baseUrl = Deno.env.get('SUPABASE_URL')!
      return new Response(
        JSON.stringify({ short_url: `${baseUrl}/functions/v1/r/${existing.code}` }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
      )
    }

    // Generate unique code with retry
    let code = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode()
      const { error } = await supabase
        .from('short_links')
        .insert({ code, target_url: url })
      if (!error) break
      if (attempt === 4) {
        return new Response(
          JSON.stringify({ error: 'Failed to generate unique code' }),
          { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
        )
      }
    }

    const baseUrl = Deno.env.get('SUPABASE_URL')!
    return new Response(
      JSON.stringify({ short_url: `${baseUrl}/functions/v1/r/${code}` }),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
    )
  }
})
