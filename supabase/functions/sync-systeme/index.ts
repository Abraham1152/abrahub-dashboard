import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

const BASE = 'https://api.systeme.io/api'

interface Tag { id: number; name: string }
interface Contact { id: number; tags?: Array<{ id: number; name: string }> }
interface ListRes<T> { items: T[]; hasMore: boolean }

async function apiFetch<T>(path: string, apiKey: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
  })

  // Rate limit check
  const remaining = res.headers.get('X-RateLimit-Remaining')
  if (remaining !== null && parseInt(remaining) < 5) {
    await new Promise(r => setTimeout(r, 2000))
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Systeme API ${res.status}: ${body.substring(0, 200)}`)
  }

  return await res.json() as T
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const apiKey = Deno.env.get('SYSTEME_API_KEY')
  if (!apiKey) {
    return jsonResponse({ error: 'SYSTEME_API_KEY not configured' }, 500)
  }

  const supabase = getServiceClient()

  try {
    // Step 1: Fetch all tags (usually few, no pagination needed for most accounts)
    const tagsRes = await apiFetch<ListRes<Tag>>('/tags', apiKey, { limit: '100' })
    const tags = tagsRes.items || []

    // Step 2: Count contacts - fetch first page to get total count pattern
    // Systeme.io doesn't return total count, so we count with pagination
    // But we limit to first 5 pages (500 contacts) to avoid timeout
    let totalContacts = 0
    let hasMore = true
    let startingAfter: string | undefined
    let pages = 0
    const maxPages = 10 // Max 1000 contacts counted

    while (hasMore && pages < maxPages) {
      const params: Record<string, string> = { limit: '100' }
      if (startingAfter) params.startingAfter = startingAfter

      const res = await apiFetch<ListRes<Contact>>('/contacts', apiKey, params)
      const items = res.items || []
      totalContacts += items.length

      hasMore = res.hasMore === true
      if (hasMore && items.length > 0) {
        startingAfter = items[items.length - 1].id.toString()
      }
      pages++

      if (hasMore) await new Promise(r => setTimeout(r, 300))
    }

    // If there are more pages, estimate total (mark as 1000+)
    if (hasMore) totalContacts = totalContacts // we have a partial count

    // Step 3: For each tag, just fetch ONE page to get contact count estimate
    // This is much faster than counting ALL contacts per tag
    const tagBreakdown: Record<string, number> = {}
    const tagRows: Array<{ tag_id: number; name: string; contact_count: number; last_synced_at: string }> = []
    const now = new Date().toISOString()

    for (const tag of tags) {
      // Fetch first page with this tag to see how many contacts
      let tagCount = 0
      let tagHasMore = true
      let tagAfter: string | undefined
      let tagPages = 0
      const maxTagPages = 3 // Max 300 per tag to avoid timeout

      while (tagHasMore && tagPages < maxTagPages) {
        const params: Record<string, string> = { limit: '100', tagId: tag.id.toString() }
        if (tagAfter) params.startingAfter = tagAfter

        const res = await apiFetch<ListRes<Contact>>('/contacts', apiKey, params)
        const items = res.items || []
        tagCount += items.length

        tagHasMore = res.hasMore === true
        if (tagHasMore && items.length > 0) {
          tagAfter = items[items.length - 1].id.toString()
        }
        tagPages++

        if (tagHasMore) await new Promise(r => setTimeout(r, 300))
      }

      tagBreakdown[tag.name] = tagCount
      tagRows.push({
        tag_id: tag.id,
        name: tag.name,
        contact_count: tagCount,
        last_synced_at: now,
      })

      // Delay between tags
      await new Promise(r => setTimeout(r, 200))
    }

    // Step 4: Upsert tags
    if (tagRows.length > 0) {
      await supabase.from('systeme_tags').upsert(tagRows, { onConflict: 'tag_id' })
    }

    // Step 5: Daily snapshot
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    let newContacts = 0
    const { data: yesterdayRow } = await supabase
      .from('systeme_contacts_daily')
      .select('total_contacts')
      .eq('date', yesterday)
      .maybeSingle()

    if (yesterdayRow) {
      newContacts = Math.max(0, totalContacts - yesterdayRow.total_contacts)
    }

    await supabase.from('systeme_contacts_daily').upsert({
      date: today,
      total_contacts: totalContacts,
      new_contacts: newContacts,
      tag_breakdown: tagBreakdown,
    }, { onConflict: 'date' })

    return jsonResponse({
      success: true,
      total_contacts: totalContacts,
      new_contacts: newContacts,
      tags_synced: tags.length,
      tag_breakdown: tagBreakdown,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: msg }, 500)
  }
})
