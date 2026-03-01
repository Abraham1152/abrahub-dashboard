export const GRAPH_API = 'https://graph.facebook.com/v21.0'

export async function getMetaCredentials() {
  const { getMetaToken } = await import('./meta-token.ts')
  const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID')
  if (!adAccountId) throw new Error('META_AD_ACCOUNT_ID not configured')
  const accessToken = await getMetaToken('ads')
  const accountRef = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  return { accessToken, adAccountId, accountRef }
}

export async function metaGet(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (data.error) {
      throw new Error(`Meta API error: ${data.error.message || JSON.stringify(data.error)}`)
    }
    return data
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Meta API returned non-JSON (${res.status}): ${text.substring(0, 200)}`)
    }
    throw e
  }
}

export async function metaPost(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: accessToken })
  const res = await fetch(`${GRAPH_API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (data.error) {
      throw new Error(`Meta API error: ${data.error.message || JSON.stringify(data.error)}`)
    }
    return data
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Meta API returned non-JSON (${res.status}): ${text.substring(0, 200)}`)
    }
    throw e
  }
}

export async function rateLimit() {
  await new Promise(r => setTimeout(r, 200))
}
