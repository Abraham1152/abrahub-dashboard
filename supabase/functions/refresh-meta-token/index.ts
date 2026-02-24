import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

const FB_API = 'https://graph.facebook.com/v21.0'
const APP_ID = '1543735980062794'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const metaToken = Deno.env.get('META_ACCESS_TOKEN')!
  const appSecret = Deno.env.get('META_APP_SECRET')!
  const igUserId = Deno.env.get('INSTAGRAM_USER_ID')!

  const results: Record<string, unknown> = {}

  try {
    // Step 1: Exchange current user token for long-lived user token
    const llRes = await fetch(
      `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${appSecret}&fb_exchange_token=${metaToken}`
    )
    const llData = await llRes.json()

    if (llData.error) {
      results.error = `Long-lived exchange failed: ${llData.error.message}`
      return jsonResponse(results, 500)
    }

    const longLivedUserToken = llData.access_token
    const expiresIn = llData.expires_in // seconds (should be ~5184000 = 60 days)
    results.long_lived_user_token = {
      obtained: true,
      expires_in_days: Math.round((expiresIn || 0) / 86400),
      token_preview: longLivedUserToken.substring(0, 30) + '...',
    }

    // Step 2: Get Page Access Token using the long-lived user token
    const pagesRes = await fetch(
      `${FB_API}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longLivedUserToken}`
    )
    const pagesData = await pagesRes.json()

    if (pagesData.error) {
      results.error = `Pages fetch failed: ${pagesData.error.message}`
      results.long_lived_token = longLivedUserToken
      return jsonResponse(results, 500)
    }

    const pages = pagesData.data || []
    const page = pages.find((p: Record<string, unknown>) =>
      (p.instagram_business_account as Record<string, unknown>)?.id === igUserId
    ) || pages[0]

    if (!page) {
      results.error = 'No page found with Instagram business account'
      return jsonResponse(results, 500)
    }

    // This Page Token is PERMANENT (never expires) because it was derived
    // from a long-lived user token
    const permanentPageToken = page.access_token as string

    results.page = {
      id: page.id,
      name: page.name,
      ig_account: page.instagram_business_account,
    }

    // Step 3: Verify the page token by debugging it
    const debugRes = await fetch(
      `${FB_API}/debug_token?input_token=${permanentPageToken}&access_token=${permanentPageToken}`
    )
    const debugData = await debugRes.json()

    results.token_debug = {
      is_valid: debugData.data?.is_valid,
      expires_at: debugData.data?.expires_at === 0 ? 'NEVER (permanent)' : debugData.data?.expires_at,
      scopes: debugData.data?.scopes,
      type: debugData.data?.type,
    }

    // Step 4: Return the tokens so they can be saved
    results.tokens = {
      long_lived_user_token: longLivedUserToken,
      permanent_page_token: permanentPageToken,
      instruction: 'Save permanent_page_token as INSTAGRAM_ACCESS_TOKEN',
    }

    results.success = true

    return jsonResponse(results)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: msg }, 500)
  }
})
