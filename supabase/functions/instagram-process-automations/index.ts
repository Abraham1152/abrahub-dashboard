import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

// Instagram Graph API now uses Facebook Graph API endpoints
const IG_API = 'https://graph.facebook.com/v21.0'
const FB_API = 'https://graph.facebook.com/v21.0'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
  if (!accessToken) {
    return jsonResponse({ error: 'INSTAGRAM_ACCESS_TOKEN not configured' }, 500)
  }

  const supabase = getServiceClient()

  try {
    // Fetch all active automations
    const { data: automations, error: autoErr } = await supabase
      .from('instagram_automations')
      .select('*')
      .eq('is_active', true)

    if (autoErr) throw new Error(`DB error: ${autoErr.message}`)
    if (!automations || automations.length === 0) {
      return jsonResponse({ success: true, message: 'No active automations', processed: 0 })
    }

    // Fetch all already-processed comment IDs to avoid duplicates
    const { data: processedRows } = await supabase
      .from('instagram_processed_comments')
      .select('comment_id')

    const processedSet = new Set((processedRows || []).map(r => r.comment_id))

    let totalProcessed = 0
    const errors: string[] = []

    for (const automation of automations) {
      try {
        // Fetch comments for this post
        const commentsRes = await fetch(
          `${IG_API}/${automation.media_id}/comments?fields=id,text,username,timestamp&limit=50&access_token=${accessToken}`
        )
        const commentsText = await commentsRes.text()
        let commentsData: Record<string, unknown>

        try {
          commentsData = JSON.parse(commentsText)
        } catch {
          errors.push(`Post ${automation.media_id}: non-JSON response: ${commentsText.substring(0, 100)}`)
          continue
        }

        if (commentsData.error) {
          const err = commentsData.error as Record<string, unknown>
          errors.push(`Post ${automation.media_id}: ${err.message || JSON.stringify(err)}`)
          continue
        }

        const comments = (commentsData.data as Array<Record<string, unknown>>) || []

        for (const comment of comments) {
          const commentId = comment.id as string
          const commentText = ((comment.text as string) || '').toLowerCase()
          const username = (comment.username as string) || 'unknown'

          // Skip if already processed
          if (processedSet.has(commentId)) continue

          // Check keyword match
          const keywords = (automation.keywords as string[]) || []
          const respondToAll = automation.respond_to_all as boolean

          let matched = respondToAll
          if (!matched && keywords.length > 0) {
            matched = keywords.some((kw: string) => commentText.includes(kw.toLowerCase()))
          }

          if (!matched) continue

          // --- Execute automation ---
          let actionTaken = ''
          let status = 'success'
          let errorMessage = ''

          // 1. Reply to comment publicly
          const replyComments = (automation.reply_comments as string[]) || []
          if (replyComments.length > 0) {
            const randomReply = replyComments[Math.floor(Math.random() * replyComments.length)]
            try {
              const replyRes = await fetch(`${IG_API}/${commentId}/replies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: randomReply,
                  access_token: accessToken,
                }),
              })
              const replyData = await replyRes.json()
              if (replyData.error) {
                errorMessage += `Reply error: ${(replyData.error as Record<string, unknown>).message || JSON.stringify(replyData.error)}; `
                status = 'error'
              } else {
                actionTaken += 'reply'
              }
            } catch (e) {
              errorMessage += `Reply exception: ${e instanceof Error ? e.message : 'unknown'}; `
              status = 'error'
            }
            await new Promise(r => setTimeout(r, 500))
          }

          // 2. Send DM (private reply via comment_id)
          const dmMessage = automation.dm_message as string
          const dmLink = automation.dm_link as string
          const dmButtons = (automation.dm_buttons as Array<{ url: string; title: string }>) || []

          if (dmMessage || dmButtons.length > 0) {
            try {
              // Build message payload
              let messagePayload: Record<string, unknown>

              if (dmButtons.length > 0) {
                // Send as template with buttons
                messagePayload = {
                  attachment: {
                    type: 'template',
                    payload: {
                      template_type: 'button',
                      text: dmMessage || 'Confira:',
                      buttons: dmButtons.map(btn => ({
                        type: 'web_url',
                        url: btn.url,
                        title: btn.title,
                      })),
                    },
                  },
                }
              } else {
                // Send as plain text (with optional link)
                const fullDmText = dmLink ? `${dmMessage}\n\n${dmLink}` : dmMessage
                messagePayload = { text: fullDmText }
              }

              // Try Instagram Graph API first
              const dmRes = await fetch(`${IG_API}/me/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient: { comment_id: commentId },
                  message: messagePayload,
                  access_token: accessToken,
                }),
              })
              const dmText = await dmRes.text()
              let dmData: Record<string, unknown>
              try {
                dmData = JSON.parse(dmText)
              } catch {
                // Try Facebook Graph API as fallback
                const fbRes = await fetch(`${FB_API}/me/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    recipient: { comment_id: commentId },
                    message: messagePayload,
                    access_token: accessToken,
                  }),
                })
                dmData = await fbRes.json()
              }

              if (dmData.error) {
                errorMessage += `DM error: ${(dmData.error as Record<string, unknown>).message || JSON.stringify(dmData.error)}; `
                status = actionTaken ? 'partial' : 'error'
              } else {
                actionTaken += actionTaken ? '+dm' : 'dm'
              }
            } catch (e) {
              errorMessage += `DM exception: ${e instanceof Error ? e.message : 'unknown'}; `
              status = actionTaken ? 'partial' : 'error'
            }
            await new Promise(r => setTimeout(r, 500))
          }

          if (!actionTaken) actionTaken = 'none'

          // Log the processed comment
          await supabase.from('instagram_processed_comments').insert({
            comment_id: commentId,
            automation_id: automation.id,
            commenter_username: username,
            comment_text: (comment.text as string || '').substring(0, 500),
            action_taken: actionTaken,
            status,
            error_message: errorMessage || null,
          })

          // Upsert lead for this commenter
          try {
            await supabase.rpc('upsert_lead', {
              p_username: username,
              p_ig_user_id: null,
              p_source: 'automation_comment',
              p_source_automation_id: automation.id,
            })
          } catch (e) {
            // Non-critical, don't fail the automation
            console.error('Lead upsert error:', e instanceof Error ? e.message : e)
          }

          processedSet.add(commentId)
          totalProcessed++

          // Rate limit delay
          await new Promise(r => setTimeout(r, 300))
        }
      } catch (e) {
        errors.push(`Automation ${automation.id}: ${e instanceof Error ? e.message : 'unknown'}`)
      }

      // Delay between automations
      await new Promise(r => setTimeout(r, 200))
    }

    return jsonResponse({
      success: true,
      automations_checked: automations.length,
      comments_processed: totalProcessed,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: msg }, 500)
  }
})
