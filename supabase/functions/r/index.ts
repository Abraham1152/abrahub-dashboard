import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient } from '../_shared/supabase-client.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.pathname.split('/').pop()

  if (!code) {
    return new Response('Not found', { status: 404 })
  }

  const supabase = getServiceClient()

  const { data } = await supabase
    .from('short_links')
    .select('id, target_url, clicks')
    .eq('code', code)
    .limit(1)
    .single()

  if (!data?.target_url) {
    return new Response('Link not found', { status: 404 })
  }

  // Increment clicks (fire and forget)
  supabase
    .from('short_links')
    .update({ clicks: (data.clicks || 0) + 1 })
    .eq('id', data.id)
    .then(() => {})

  // 301 redirect — direct, no preview page
  return new Response(null, {
    status: 301,
    headers: { 'Location': data.target_url },
  })
})
