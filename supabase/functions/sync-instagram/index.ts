import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders, todayDate } from '../_shared/supabase-client.ts'

const GRAPH_API = 'https://graph.instagram.com/v21.0'

async function igFetch(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Instagram API returned non-JSON (${res.status}): ${text.substring(0, 200)}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
  const userId = Deno.env.get('INSTAGRAM_USER_ID')

  if (!accessToken || !userId) {
    return jsonResponse({ error: 'Instagram credentials not configured' }, 500)
  }

  const supabase = getServiceClient()

  try {
    await logSync('instagram', 'running')
    let totalRecords = 0

    // --- Fetch Account Info ---
    const accountData = await igFetch(
      `${GRAPH_API}/me?fields=user_id,username,followers_count,follows_count,media_count&access_token=${accessToken}`
    )

    if (accountData.error) {
      const err = accountData.error as Record<string, unknown>
      throw new Error(`Account: ${err.message || JSON.stringify(err)}`)
    }

    const followers = (accountData.followers_count as number) || 0
    const follows = (accountData.follows_count as number) || 0
    const mediaCount = (accountData.media_count as number) || 0

    // --- Fetch Account Insights (last day) ---
    let reach = 0
    let impressions = 0
    let profileViews = 0

    try {
      const insightsData = await igFetch(
        `${GRAPH_API}/${userId}/insights?metric=reach,impressions,profile_views&period=day&access_token=${accessToken}`
      )

      const insightsArr = (insightsData.data as Array<Record<string, unknown>>) || []
      for (const metric of insightsArr) {
        const values = metric.values as Array<Record<string, unknown>> | undefined
        const latestValue = values?.[values.length - 1]?.value as number || 0
        if (metric.name === 'reach') reach = latestValue
        if (metric.name === 'impressions') impressions = latestValue
        if (metric.name === 'profile_views') profileViews = latestValue
      }
    } catch {
      // Insights may not be available for all accounts
    }

    // Upsert daily stats
    const today = todayDate()
    await supabase.from('instagram_daily').upsert(
      {
        date: today,
        account_id: userId,
        followers,
        follows,
        media_count: mediaCount,
        reach,
        impressions,
        profile_views: profileViews,
      },
      { onConflict: 'date,account_id' }
    )
    totalRecords++

    // --- Fetch Recent Media ---
    const mediaData = await igFetch(
      `${GRAPH_API}/me/media?fields=id,media_type,caption,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url&limit=25&access_token=${accessToken}`
    )

    if (mediaData.error) {
      const err = mediaData.error as Record<string, unknown>
      throw new Error(`Media: ${err.message || JSON.stringify(err)}`)
    }

    const posts = (mediaData.data as Array<Record<string, unknown>>) || []

    // Batch collect post data (avoid individual insights calls to prevent rate limiting)
    const postRows: Array<Record<string, unknown>> = []

    for (const post of posts) {
      let postReach = 0
      let postImpressions = 0
      let postSaves = 0
      let postShares = 0

      try {
        const postInsightsData = await igFetch(
          `${GRAPH_API}/${post.id}/insights?metric=reach,impressions,saved,shares&access_token=${accessToken}`
        )
        const metrics = (postInsightsData.data as Array<Record<string, unknown>>) || []
        for (const metric of metrics) {
          const values = metric.values as Array<Record<string, unknown>> | undefined
          const val = (values?.[0]?.value as number) || 0
          if (metric.name === 'reach') postReach = val
          if (metric.name === 'impressions') postImpressions = val
          if (metric.name === 'saved') postSaves = val
          if (metric.name === 'shares') postShares = val
        }
      } catch {
        // Some posts may not have insights
      }

      // Determine the best thumbnail URL based on media type:
      // - VIDEO/REEL: use thumbnail_url (video frame preview)
      // - IMAGE: use media_url (the image itself)
      // - CAROUSEL_ALBUM: fetch first child's media_url
      let bestThumbnail = (post.thumbnail_url as string) || (post.media_url as string) || null
      const mediaType = (post.media_type as string) || 'IMAGE'

      if (mediaType === 'CAROUSEL_ALBUM' && !bestThumbnail) {
        try {
          const childrenData = await igFetch(
            `${GRAPH_API}/${post.id}/children?fields=media_url,media_type&limit=1&access_token=${accessToken}`
          )
          const children = (childrenData.data as Array<Record<string, unknown>>) || []
          if (children.length > 0) {
            bestThumbnail = (children[0].media_url as string) || null
          }
        } catch {
          // Fallback: no thumbnail for this carousel
        }
        await new Promise(r => setTimeout(r, 150))
      }

      postRows.push({
        media_id: post.id as string,
        media_type: mediaType,
        caption: (post.caption as string) || null,
        permalink: (post.permalink as string) || null,
        timestamp: (post.timestamp as string) || null,
        like_count: (post.like_count as number) || 0,
        comments_count: (post.comments_count as number) || 0,
        reach: postReach,
        impressions: postImpressions,
        saves: postSaves,
        shares: postShares,
        thumbnail_url: bestThumbnail,
        last_synced_at: new Date().toISOString(),
      })

      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 150))
    }

    // Batch upsert posts
    if (postRows.length > 0) {
      await supabase.from('instagram_posts').upsert(postRows, { onConflict: 'media_id' })
      totalRecords += postRows.length
    }

    await logSync('instagram', 'success', totalRecords)
    return jsonResponse({
      success: true,
      records: totalRecords,
      followers,
      media_count: mediaCount,
      posts_synced: postRows.length,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('instagram', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
