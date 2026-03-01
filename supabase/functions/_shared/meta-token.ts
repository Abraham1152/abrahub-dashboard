import { getServiceClient } from './supabase-client.ts'

const FB_API = 'https://graph.facebook.com/v21.0'
const APP_ID = '1543735980062794'

/**
 * Returns a valid Meta access token for the given type ('ads' | 'instagram').
 * Priority: DB token → env var fallback.
 * Auto-refreshes if token expires within 7 days.
 */
export async function getMetaToken(tokenType: 'ads' | 'instagram'): Promise<string> {
  const supabase = getServiceClient()
  const appSecret = Deno.env.get('META_APP_SECRET')

  // 1. Try DB
  const { data: row } = await supabase
    .from('meta_token_config')
    .select('access_token, expires_at')
    .eq('token_type', tokenType)
    .single()

  let token = row?.access_token
  const expiresAt = row?.expires_at ? new Date(row.expires_at) : null

  // 2. Fallback to env var
  if (!token) {
    token = tokenType === 'ads'
      ? Deno.env.get('META_ADS_ACCESS_TOKEN')
      : Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
  }

  if (!token) throw new Error(`No ${tokenType} Meta token available`)

  // 3. Auto-refresh if expires within 7 days
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  if (expiresAt && expiresAt < sevenDays && appSecret) {
    const refreshed = await exchangeToken(token, appSecret)
    if (refreshed) {
      await supabase.from('meta_token_config').upsert({
        token_type: tokenType,
        access_token: refreshed.token,
        expires_at: refreshed.expiresAt,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'token_type' })
      return refreshed.token
    }
  }

  return token
}

/**
 * Saves tokens to DB after a manual refresh.
 */
export async function saveMetaTokens(opts: {
  adsToken: string
  adsExpiresIn: number
  instagramToken: string
}) {
  const supabase = getServiceClient()
  const adsExpiresAt = new Date(Date.now() + opts.adsExpiresIn * 1000).toISOString()

  await supabase.from('meta_token_config').upsert([
    {
      token_type: 'ads',
      access_token: opts.adsToken,
      expires_at: adsExpiresAt,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      token_type: 'instagram',
      access_token: opts.instagramToken,
      expires_at: null, // permanent page token
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ], { onConflict: 'token_type' })
}

async function exchangeToken(
  currentToken: string,
  appSecret: string,
): Promise<{ token: string; expiresAt: string | null } | null> {
  try {
    const res = await fetch(
      `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`
    )
    const data = await res.json()
    if (data.error || !data.access_token) return null
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null
    return { token: data.access_token, expiresAt }
  } catch {
    return null
  }
}
