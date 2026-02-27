import { getServiceClient } from './supabase-client.ts'

export const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v17'

export interface GoogleAdsCredentials {
  customerId: string
  accessToken: string
  developerToken: string
}

/**
 * Refresh OAuth2 access token using the stored refresh_token.
 * Google access tokens expire after ~1 hour.
 */
export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(`Google OAuth error: ${data.error_description || data.error}`)
  }
  return data.access_token as string
}

/**
 * Get Google Ads credentials from the google_ads_config table.
 * Automatically refreshes the access token.
 */
export async function getGoogleAdsCredentials(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<GoogleAdsCredentials> {
  const { data: config, error } = await supabase
    .from('google_ads_config')
    .select('*')
    .single()

  if (error || !config) {
    throw new Error('Google Ads config not found in database')
  }

  if (!config.customer_id || !config.refresh_token || !config.developer_token) {
    throw new Error('Google Ads credentials not configured (missing customer_id, refresh_token, or developer_token)')
  }

  const clientId = config.client_id || Deno.env.get('GOOGLE_ADS_CLIENT_ID')
  const clientSecret = config.client_secret || Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Google Ads OAuth client_id/client_secret not configured')
  }

  const accessToken = await refreshGoogleToken(clientId, clientSecret, config.refresh_token)

  // Update last_token_refresh timestamp
  await supabase
    .from('google_ads_config')
    .update({ last_token_refresh: new Date().toISOString() })
    .eq('id', config.id)

  return {
    customerId: (config.customer_id as string).replace(/-/g, ''),
    accessToken,
    developerToken: config.developer_token as string,
  }
}

/**
 * Execute a GAQL query against the Google Ads API.
 * Returns the results array from the search response.
 */
export async function googleAdsQuery(
  creds: GoogleAdsCredentials,
  query: string,
): Promise<any[]> {
  const url = `${GOOGLE_ADS_API}/customers/${creds.customerId}/googleAds:search`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'developer-token': creds.developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (data.error) {
      throw new Error(`Google Ads API error: ${JSON.stringify(data.error).substring(0, 300)}`)
    }
    return data.results || []
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Google Ads API returned non-JSON (${res.status}): ${text.substring(0, 200)}`)
    }
    throw e
  }
}

/**
 * Mutate campaigns via the Google Ads API.
 * Used for pause/resume/budget changes.
 */
export async function googleAdsMutateCampaign(
  creds: GoogleAdsCredentials,
  campaignId: string,
  fields: Record<string, unknown>,
  updateMask: string,
): Promise<Record<string, unknown>> {
  const url = `${GOOGLE_ADS_API}/customers/${creds.customerId}/campaigns:mutate`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'developer-token': creds.developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operations: [
        {
          update: {
            resourceName: `customers/${creds.customerId}/campaigns/${campaignId}`,
            ...fields,
          },
          updateMask: updateMask,
        },
      ],
    }),
  })

  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (data.error) {
      throw new Error(`Google Ads mutate error: ${JSON.stringify(data.error).substring(0, 300)}`)
    }
    return data
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Google Ads API returned non-JSON (${res.status}): ${text.substring(0, 200)}`)
    }
    throw e
  }
}

/**
 * Mutate campaign budgets via the Google Ads API.
 */
export async function googleAdsMutateBudget(
  creds: GoogleAdsCredentials,
  budgetId: string,
  amountMicros: string,
): Promise<Record<string, unknown>> {
  const url = `${GOOGLE_ADS_API}/customers/${creds.customerId}/campaignBudgets:mutate`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.accessToken}`,
      'developer-token': creds.developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operations: [
        {
          update: {
            resourceName: `customers/${creds.customerId}/campaignBudgets/${budgetId}`,
            amountMicros: amountMicros,
          },
          updateMask: 'amountMicros',
        },
      ],
    }),
  })

  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (data.error) {
      throw new Error(`Google Ads budget mutate error: ${JSON.stringify(data.error).substring(0, 300)}`)
    }
    return data
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Google Ads API returned non-JSON (${res.status}): ${text.substring(0, 200)}`)
    }
    throw e
  }
}

/** Convert Google Ads micros to BRL (divide by 1,000,000) */
export function microsToReal(micros: string | number): number {
  return Number(micros) / 1_000_000
}

/** Convert BRL to Google Ads micros (multiply by 1,000,000) */
export function realToMicros(brl: number): string {
  return String(Math.round(brl * 1_000_000))
}

/** Rate limit helper: 100ms between Google Ads API requests */
export async function googleRateLimit() {
  await new Promise((r) => setTimeout(r, 100))
}
