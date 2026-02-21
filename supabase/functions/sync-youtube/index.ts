import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders, todayDate } from '../_shared/supabase-client.ts'

const CHANNEL_IDS = [
  'UC0qgDFuPmvDRNz_tXO90fBg', // @Abraham_tv (414K)
  'UCNHMvXsxOBlUUd3k-Zvtr1Q', // @abrahub (80K)
  'UCJDekPfdOi9gDg-1dw_GDng', // @abrahubstudio (4.3K)
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const apiKey = Deno.env.get('YOUTUBE_API_KEY')

  if (!apiKey) {
    return jsonResponse({ error: 'YOUTUBE_API_KEY not configured' }, 500)
  }

  const supabase = getServiceClient()

  try {
    await logSync('youtube', 'running')
    let totalRecords = 0
    const today = todayDate()

    // --- Fetch All Channels Statistics in one request ---
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${CHANNEL_IDS.join(',')}&key=${apiKey}`
    )
    const channelData = await channelRes.json()

    if (channelData.error) throw new Error(channelData.error.message)

    for (const channel of channelData.items || []) {
      const channelId = channel.id
      const stats = channel.statistics
      const subscribers = parseInt(stats.subscriberCount || '0')
      const totalViews = parseInt(stats.viewCount || '0')
      const totalVideos = parseInt(stats.videoCount || '0')

      // Get previous day's views to calculate views_gained
      const { data: prevDay } = await supabase
        .from('youtube_daily')
        .select('total_views')
        .eq('channel_id', channelId)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const viewsGained = prevDay ? totalViews - prevDay.total_views : 0

      // Upsert daily stats
      await supabase.from('youtube_daily').upsert(
        {
          date: today,
          channel_id: channelId,
          subscribers,
          total_views: totalViews,
          total_videos: totalVideos,
          views_gained: Math.max(viewsGained, 0),
        },
        { onConflict: 'date,channel_id' }
      )
      totalRecords++

      // --- Fetch Recent Videos for this channel ---
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=10&type=video&key=${apiKey}`
      )
      const searchData = await searchRes.json()

      if (searchData.error) throw new Error(searchData.error.message)

      const videoIds = (searchData.items || [])
        .map((item: any) => item.id?.videoId)
        .filter(Boolean)

      if (videoIds.length > 0) {
        const videosRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}&key=${apiKey}`
        )
        const videosData = await videosRes.json()

        if (videosData.error) throw new Error(videosData.error.message)

        for (const video of videosData.items || []) {
          await supabase.from('youtube_videos').upsert(
            {
              video_id: video.id,
              title: video.snippet.title,
              published_at: video.snippet.publishedAt,
              view_count: parseInt(video.statistics.viewCount || '0'),
              like_count: parseInt(video.statistics.likeCount || '0'),
              comment_count: parseInt(video.statistics.commentCount || '0'),
              thumbnail_url: video.snippet.thumbnails?.medium?.url || null,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'video_id' }
          )
          totalRecords++
        }
      }
    }

    await logSync('youtube', 'success', totalRecords)
    return jsonResponse({ success: true, records: totalRecords })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('youtube', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
