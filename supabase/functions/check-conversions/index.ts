import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const supabase = getServiceClient()

  try {
    // 1. Get leads that have tracked links sent but are not yet converted
    const { data: pendingLeads, error: leadsErr } = await supabase
      .from('instagram_leads')
      .select('id, username, tracked_product_id, tracked_link_sent')
      .eq('tracked_link_sent', true)
      .not('status', 'eq', 'converted')

    if (leadsErr) throw new Error(`Leads fetch error: ${leadsErr.message}`)
    if (!pendingLeads || pendingLeads.length === 0) {
      return jsonResponse({ success: true, message: 'No pending leads to check', checked: 0, converted: 0 })
    }

    let convertedCount = 0
    const errors: string[] = []

    for (const lead of pendingLeads) {
      try {
        // 2. Search revenue_transactions for matching ref in metadata
        // Kiwify stores the ref param in metadata.reference or metadata.ref
        const { data: transactions } = await supabase
          .from('revenue_transactions')
          .select('id, amount, date, product_name, customer_email, metadata')
          .or(`metadata->reference.eq.${lead.id},metadata->ref.eq.${lead.id}`)
          .eq('status', 'paid')
          .limit(1)

        let matchedTransaction = transactions?.[0]

        // 3. Fallback: search by lead ID in metadata JSONB (broader search)
        if (!matchedTransaction) {
          const { data: fallbackTxns } = await supabase
            .from('revenue_transactions')
            .select('id, amount, date, product_name, customer_email, metadata')
            .eq('status', 'paid')
            .filter('metadata', 'cs', JSON.stringify({ ref: lead.id }))
            .limit(1)

          matchedTransaction = fallbackTxns?.[0]
        }

        if (matchedTransaction) {
          // 4. Update lead as converted
          await supabase.from('instagram_leads').update({
            status: 'converted',
            temperature: 'hot',
            temperature_override: true,
            converted_at: new Date().toISOString(),
            conversion_value: matchedTransaction.amount,
            customer_email: matchedTransaction.customer_email,
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id)

          convertedCount++
          console.log(`[CONVERSIONS] Lead ${lead.username} (${lead.id}) converted! Amount: R$${matchedTransaction.amount}`)
        }
      } catch (e) {
        errors.push(`Lead ${lead.id}: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    return jsonResponse({
      success: true,
      leads_checked: pendingLeads.length,
      converted: convertedCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: msg }, 500)
  }
})
