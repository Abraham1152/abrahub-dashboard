import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const FB_API = 'https://graph.facebook.com/v21.0'

serve(async () => {
  const metaToken = Deno.env.get('META_ACCESS_TOKEN')!
  const userId = Deno.env.get('INSTAGRAM_USER_ID')!

  const results: Record<string, unknown> = {}

  // Step 1: Get Pages and their Page Access Tokens
  try {
    const res = await fetch(`${FB_API}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${metaToken}`)
    const data = await res.json()
    results.pages = { status: res.status, data: data.data }
  } catch (e) {
    results.pages = { error: String(e) }
  }

  // Get the Page token for the page connected to our IG account
  const pages = (results.pages as { data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[] })?.data || []
  const page = pages.find(p => p.instagram_business_account?.id === userId) || pages[0]

  results.selected_page = page ? { id: page.id, name: page.name, ig_account: page.instagram_business_account } : 'NO PAGE FOUND'

  const pageToken = page?.access_token
  const igBusinessId = page?.instagram_business_account?.id || userId

  if (!pageToken) {
    results.error = 'No Page Access Token found. Cannot make business API calls.'
    return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } })
  }

  // Step 2: GET media using Page Token via FB Graph API
  try {
    const res = await fetch(`${FB_API}/${igBusinessId}/media?fields=id,caption,comments_count,timestamp&limit=5&access_token=${pageToken}`)
    const data = await res.json()
    results.media = { status: res.status, count: data.data?.length || 0, data: data.data?.map((m: { id: string; caption?: string; comments_count?: number }) => ({ id: m.id, caption: m.caption?.substring(0, 40), comments_count: m.comments_count })) }
  } catch (e) {
    results.media = { error: String(e) }
  }

  // Pick media with most comments
  const mediaList = (results.media as { data?: { id: string; comments_count?: number }[] })?.data || []
  const sorted = [...mediaList].sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0))
  const mediaId = sorted[0]?.id

  if (!mediaId) {
    results.error = 'No media found'
    return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } })
  }

  results.target_media = { id: mediaId, comments_count: sorted[0]?.comments_count }

  // Step 3: GET comments using PAGE TOKEN (instagram_business_manage_comments)
  try {
    const res = await fetch(`${FB_API}/${mediaId}/comments?fields=id,text,username,timestamp&limit=10&access_token=${pageToken}`)
    const data = await res.json()
    results.page_get_comments = { status: res.status, count: data.data?.length || 0, data: data.data?.slice(0, 3) }
  } catch (e) {
    results.page_get_comments = { error: String(e) }
  }

  // Step 4: POST comment using PAGE TOKEN (instagram_business_manage_comments WRITE)
  try {
    const res = await fetch(`${FB_API}/${mediaId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '🔥🎬', access_token: pageToken }),
    })
    const data = await res.json()
    results.page_post_comment = { status: res.status, data }

    // Step 5: DELETE the comment using PAGE TOKEN
    if (data.id) {
      try {
        const delRes = await fetch(`${FB_API}/${data.id}?access_token=${pageToken}`, { method: 'DELETE' })
        results.page_delete_comment = { status: delRes.status, data: await delRes.json() }
      } catch (e) {
        results.page_delete_comment = { error: String(e) }
      }
    }
  } catch (e) {
    results.page_post_comment = { error: String(e) }
  }

  // Step 6: Reply to existing comment using PAGE TOKEN
  const comments = (results.page_get_comments as { data?: { id: string }[] })?.data || []
  if (comments.length > 0) {
    try {
      const res = await fetch(`${FB_API}/${comments[0].id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '👏 Valeu!', access_token: pageToken }),
      })
      const data = await res.json()
      results.page_reply_comment = { status: res.status, data }

      if (data.id) {
        const delRes = await fetch(`${FB_API}/${data.id}?access_token=${pageToken}`, { method: 'DELETE' })
        results.page_reply_delete = { status: delRes.status, data: await delRes.json() }
      }
    } catch (e) {
      results.page_reply_comment = { error: String(e) }
    }
  }

  // Step 7: Also try with USER token (metaToken) for comparison
  try {
    const res = await fetch(`${FB_API}/${mediaId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '✨', access_token: metaToken }),
    })
    const data = await res.json()
    results.user_post_comment = { status: res.status, data }

    if (data.id) {
      const delRes = await fetch(`${FB_API}/${data.id}?access_token=${metaToken}`, { method: 'DELETE' })
      results.user_delete_comment = { status: delRes.status, data: await delRes.json() }
    }
  } catch (e) {
    results.user_post_comment = { error: String(e) }
  }

  results.summary = {
    page_token_used: true,
    user_token_used: true,
    ig_business_account: igBusinessId,
    page_id: page?.id,
    api_base: 'graph.facebook.com/v21.0',
  }

  return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } })
})
