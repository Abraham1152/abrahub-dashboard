import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export async function logSync(
  service: 'stripe' | 'kiwify' | 'youtube' | 'instagram' | 'churn' | 'ads' | 'adsense' | 'ads-optimizer',
  status: 'running' | 'success' | 'error',
  recordsProcessed = 0,
  errorMessage?: string
) {
  const client = getServiceClient()
  await client.from('sync_log').insert({
    service,
    status,
    records_processed: recordsProcessed,
    error_message: errorMessage || null,
    completed_at: status !== 'running' ? new Date().toISOString() : null,
  })
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

export function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function daysAgoUnix(days: number): number {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return Math.floor(d.getTime() / 1000)
}
