import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

const CHANNEL_IDS = [
  'UC0qgDFuPmvDRNz_tXO90fBg', // Abraham TV
  'UCNHMvXsxOBlUUd3k-Zvtr1Q', // Rodrigo Abraham
  'UCJDekPfdOi9gDg-1dw_GDng', // ABRAhub Studio
]

/** Exchange a refresh token for a fresh Google OAuth2 access token. */
async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth2 credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()

  if (data.error) {
    throw new Error(`Google OAuth2 token refresh failed: ${data.error_description || data.error}`)
  }

  if (!data.access_token) {
    throw new Error(`Google OAuth2 token refresh returned no access_token: ${JSON.stringify(data)}`)
  }

  return data.access_token as string
}

/** Format a Date as YYYY-MM-DD (YouTube Analytics API date format). */
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Fetch current USD to BRL exchange rate. Falls back to 5.80 if API fails. */
async function getUsdToBrl(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = await res.json()
    return data.rates?.BRL || 5.80
  } catch {
    return 5.80
  }
}

/**
 * Fetch estimatedRevenue per day from the YouTube Analytics API for a single channel.
 * Returns a map of date -> revenue.
 */
async function fetchChannelRevenue(
  channelId: string,
  startDate: string,
  endDate: string,
  accessToken: string,
): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: 'estimatedRevenue',
    dimensions: 'day',
  })

  const res = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  const data = await res.json()

  if (data.error) {
    const errMsg = data.error.message || JSON.stringify(data.error)
    // If the channel has no analytics data, log and return empty instead of failing the whole sync
    if (data.error.code === 403 || data.error.code === 404) {
      console.warn(`Channel ${channelId} analytics unavailable: ${errMsg}`)
      return {}
    }
    throw new Error(`YouTube Analytics API error for channel ${channelId}: ${errMsg}`)
  }

  const revenueByDay: Record<string, number> = {}

  // The API returns { columnHeaders: [...], rows: [["2024-01-01", 12.34], ...] }
  const rows = (data.rows as Array<[string, number]>) || []
  for (const row of rows) {
    const date = row[0] // YYYY-MM-DD
    const revenue = row[1] || 0
    revenueByDay[date] = revenue
  }

  return revenueByDay
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const supabase = getServiceClient()

  try {
    await logSync('adsense', 'running')

    // 1. Get a fresh access token and exchange rate
    const [accessToken, usdToBrl] = await Promise.all([getAccessToken(), getUsdToBrl()])
    console.log(`USD/BRL rate: ${usdToBrl}`)

    // 2. Determine date range (last 30 days)
    const endDateObj = new Date()
    const startDateObj = new Date()
    startDateObj.setDate(startDateObj.getDate() - 30)

    const startDate = formatDate(startDateObj)
    const endDate = formatDate(endDateObj)

    console.log(`Fetching AdSense revenue from ${startDate} to ${endDate} for ${CHANNEL_IDS.length} channels`)

    // 3. Fetch revenue for each channel and aggregate per day
    const aggregatedRevenue: Record<string, number> = {}
    const perChannelRevenue: Array<{ channel_id: string; date: string; revenue: number }> = []

    for (const channelId of CHANNEL_IDS) {
      const channelRevenue = await fetchChannelRevenue(channelId, startDate, endDate, accessToken)

      for (const [date, revenue] of Object.entries(channelRevenue)) {
        const revenueBrl = revenue * usdToBrl
        aggregatedRevenue[date] = (aggregatedRevenue[date] || 0) + revenueBrl
        perChannelRevenue.push({
          channel_id: channelId,
          date,
          revenue: Math.round(revenueBrl * 100) / 100,
        })
      }

      // Small delay between channels to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))
    }

    const dates = Object.keys(aggregatedRevenue)
    console.log(`Aggregated revenue for ${dates.length} days across all channels`)

    // 4. Upsert into financial_daily (only update revenue_adsense column)
    let totalRecords = 0

    if (dates.length > 0) {
      // Batch-fetch existing rows for these dates
      const { data: existingRows } = await supabase
        .from('financial_daily')
        .select('id, date')
        .in('date', dates)

      const existingMap = new Map((existingRows || []).map((r: { id: string; date: string }) => [r.date, r]))

      const toInsert: Array<Record<string, unknown>> = []
      const toUpdate: Array<{ id: string; revenue: number }> = []

      for (const date of dates) {
        const revenue = Math.round(aggregatedRevenue[date] * 100) / 100 // round to 2 decimal places
        const existing = existingMap.get(date)

        if (existing) {
          toUpdate.push({ id: existing.id, revenue })
        } else {
          toInsert.push({
            date,
            revenue_adsense: revenue,
            revenue_stripe: 0,
            revenue_kiwify: 0,
            refunds: 0,
            fees: 0,
          })
        }
      }

      // Insert new rows
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('financial_daily').insert(toInsert)
        if (insertErr) {
          console.error('Insert error:', insertErr.message)
        }
        totalRecords += toInsert.length
      }

      // Update existing rows (only revenue_adsense column)
      for (const item of toUpdate) {
        const { error: updateErr } = await supabase
          .from('financial_daily')
          .update({ revenue_adsense: item.revenue })
          .eq('id', item.id)

        if (updateErr) {
          console.error(`Update error for id ${item.id}:`, updateErr.message)
        }
        totalRecords++
      }
    }

    console.log(`Upserted ${totalRecords} financial_daily records`)

    // 5. Store per-channel revenue in youtube_revenue_daily
    if (perChannelRevenue.length > 0) {
      const { error: chErr } = await supabase
        .from('youtube_revenue_daily')
        .upsert(perChannelRevenue, { onConflict: 'channel_id,date' })
      if (chErr) {
        console.error('Per-channel revenue upsert error:', chErr.message)
      } else {
        console.log(`Upserted ${perChannelRevenue.length} youtube_revenue_daily records`)
      }
    }

    await logSync('adsense', 'success', totalRecords)
    return jsonResponse({
      success: true,
      records: totalRecords,
      channels: CHANNEL_IDS.length,
      date_range: { start: startDate, end: endDate },
      days_with_revenue: dates.length,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('sync-adsense error:', msg)
    await logSync('adsense', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
