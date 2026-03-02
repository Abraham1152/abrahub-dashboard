import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GEMINI_API, GEMINI_MODEL } from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── No-reply patterns ────────────────────────────────────────────────────────
const NO_REPLY_PATTERNS = [
  'naoresponda', 'nao-responda', 'nao_responda',
  'naoresponde', 'nao-responde', 'nao_responde',
  'noreply', 'no-reply', 'no_reply',
  'donotreply', 'do-not-reply', 'do_not_reply',
  'dontreply', 'dont-reply', 'dont_reply',
  'notreply', 'not-reply', 'not_reply',
  'newsletter', 'notifications', 'notification',
  'mailer-daemon', 'mailer_daemon', 'mailerdaemon',
  'postmaster', 'bounce', 'bounces',
  'automatico', 'automaticamente',
]

const PASTA_RESPONDIDOS = 'Respondidos'

// ─── Prompts ──────────────────────────────────────────────────────────────────
const FAQ = `Sempre tratar o usuário com cordialidade, mas sem ser muito formal para não perceber que é uma I.A
Começar os e-mails com Bom dia *nome*, boa tarde ou boa noite.

Dúvidas:
Cliente pediu Parcelamento da comunidade ou do produto, ou pagamento PIX, enviar esse link:
https://pay.kiwify.com.br/btFZj9x

Para cliente que não recebeu acesso a algum curso:
Responder falando que vai liberar o acesso o mais rápido possível e que vai chegar no e-mail
*Anotar no front end, o e-mail da pessoa, e o curso que tem que dar o acesso*

Para cliente que quer reembolso do produto:
Anotar e-mail do cliente, e data que solicitou reembolso no front`

function periodoDoDia(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function extrairEmail(remetente: string): string {
  if (remetente.includes('<')) {
    return remetente.split('<')[1].replace('>', '').trim()
  }
  return remetente.trim()
}

const PROMPT_BASE = `Você é um agente de suporte ao cliente. Siga EXATAMENTE as instruções abaixo e retorne SOMENTE um JSON válido.

=== INSTRUÇÕES DE ATENDIMENTO ===
${FAQ}

=== REGRAS GERAIS ===
- Cumprimente com "${periodoDoDia()}, [nome do cliente]" — extraia o primeiro nome do e-mail ou da assinatura
- Se não encontrar o nome, use apenas "${periodoDoDia()},"
- Tom cordial e descontraído, sem parecer robô
- Responda sempre em português

=== FORMATO DE RETORNO (JSON) ===
{
  "tipo": "PAGAMENTO" | "ACESSO_CURSO" | "REEMBOLSO" | "DUVIDA" | "RECLAMACAO" | "OUTRO",
  "precisa_acao_manual": true ou false,
  "descricao_tarefa": "O que precisa ser feito manualmente. Vazio se não precisar.",
  "resposta_email": "Texto completo da resposta ao cliente."
}

=== QUANDO precisa_acao_manual = true ===
- ACESSO_CURSO: descrever "Liberar acesso para [email] no curso [nome do curso]"
- RECLAMACAO grave: descrever o que precisa ser resolvido

=== QUANDO precisa_acao_manual = false ===
- PAGAMENTO/PARCELAMENTO/PIX: responder com o link do FAQ
- DUVIDA simples: responder diretamente`

const PROMPT_REEMBOLSO_ELEGIVEL = `Você é um agente de suporte. Escreva uma resposta de e-mail informando que o reembolso foi aprovado e será processado.

Regras:
- Cumprimente com "${periodoDoDia()}, [nome]"
- Tom cordial e descontraído
- Informe que o reembolso foi aprovado pois está dentro do prazo legal de 7 dias
- Diga que o valor retorna ao cartão/conta em até 10 dias úteis
- Se tiver assinatura, informe que ela também será cancelada
- SE o cliente NÃO explicou o motivo do cancelamento no e-mail, pergunte gentilmente ao final
- SE o cliente JÁ explicou o motivo, não pergunte novamente — apenas agradeça o feedback
- Retorne SOMENTE o texto do e-mail, sem JSON`

const PROMPT_REEMBOLSO_INELEGIVEL = `Você é um agente de suporte. Escreva uma resposta de e-mail informando que o reembolso não pode ser processado.

Regras:
- Cumprimente com "${periodoDoDia()}, [nome]"
- Tom cordial, empático e descontraído
- Explique gentilmente que a compra foi feita há mais de 7 dias
- Informe que o prazo legal de arrependimento no Brasil é de 7 dias corridos a partir da compra
- Ofereça ajuda para aproveitar melhor o produto/serviço
- Retorne SOMENTE o texto do e-mail, sem JSON`

const PROMPT_DETECTAR_FEEDBACK = `Analise o e-mail abaixo e retorne um JSON:
{
  "eh_feedback": true ou false,
  "motivo": "resumo em até 10 palavras do motivo do cancelamento. Vazio se não for feedback."
}

É um feedback se o cliente está respondendo sobre o motivo de ter cancelado/pedido reembolso.
Retorne SOMENTE o JSON.`

const ASSINATURA_HTML = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;color:#6b7280;font-size:12px;line-height:1.6;">
  <strong style="font-size:18px;color:#1a1a1a;">ABRA<span style="color:#6366f1;">hub</span></strong>
  <div style="margin-top:6px;">
    <strong style="color:#1a1a1a;font-size:13px;">ABRAhub — Escola &amp; Estúdio de IA</strong><br>
    CNPJ: 49.531.961/0001-11<br>
    <a href="https://abrahub.com" style="color:#6366f1;text-decoration:none;">abrahub.com</a>
  </div>
</div>`

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')!
  const res = await fetch(
    `${GEMINI_API}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

// ─── Email processing ─────────────────────────────────────────────────────────
async function classificarEmail(remetente: string, assunto: string, corpo: string, historico?: string, knowledgeContext?: string) {
  let conteudo = PROMPT_BASE

  if (knowledgeContext) {
    conteudo += `\n\n=== BASE DE CONHECIMENTO DO NEGOCIO ===\n${knowledgeContext}\n=== FIM DA BASE DE CONHECIMENTO ===`
  }

  if (historico) {
    conteudo += `\n\n=== HISTÓRICO DE INTERAÇÕES COM ESTE CLIENTE ===\n${historico}\n=== FIM DO HISTÓRICO ===\n\nUse o histórico acima para dar continuidade ao atendimento.`
  }

  conteudo += `\n\nDe: ${remetente}\nAssunto: ${assunto}\n\n${corpo}`

  let texto = await callGemini(conteudo)
  if (texto.includes('```')) {
    texto = texto.split('```')[1].replace('json', '').trim()
  }
  return JSON.parse(texto)
}

async function gerarRespostaReembolso(remetente: string, assunto: string, corpo: string, elegivel: boolean, analise: any) {
  const prompt = elegivel ? PROMPT_REEMBOLSO_ELEGIVEL : PROMPT_REEMBOLSO_INELEGIVEL
  const contexto = elegivel
    ? `Assinatura ativa: ${analise.tem_assinatura ? 'Sim' : 'Não'}\nValor: ${analise.moeda} ${analise.valor}`
    : `Dias desde a compra: ${analise.dias_passados} dias`
  const conteudo = `${prompt}\n\nContexto: ${contexto}\n\nE-mail do cliente:\nDe: ${remetente}\nAssunto: ${assunto}\n\n${corpo}`
  return await callGemini(conteudo)
}

async function detectarFeedback(assunto: string, corpo: string) {
  const conteudo = `${PROMPT_DETECTAR_FEEDBACK}\n\nAssunto: ${assunto}\n\n${corpo}`
  let texto = await callGemini(conteudo)
  if (texto.includes('```')) {
    texto = texto.split('```')[1].replace('json', '').trim()
  }
  return JSON.parse(texto)
}

async function processarEmail(remetente: string, assunto: string, corpo: string, historico?: string, knowledgeContext?: string) {
  const resultado = await classificarEmail(remetente, assunto, corpo, historico, knowledgeContext)

  if (resultado.tipo === 'REEMBOLSO') {
    try {
      const emailCliente = extrairEmail(remetente)
      const analise = await analisarReembolso(emailCliente)

      if (analise.encontrado) {
        const elegivel = analise.elegivel
        resultado.resposta_email = await gerarRespostaReembolso(remetente, assunto, corpo, elegivel, analise)

        if (elegivel) {
          resultado.precisa_acao_manual = true
          resultado.descricao_tarefa = `Reembolso APROVADO — ${analise.nome} (${emailCliente}) | ${analise.moeda} ${analise.valor.toFixed(2)} | Compra há ${analise.dias_passados} dia(s)`
        } else {
          resultado.precisa_acao_manual = false
          resultado.descricao_tarefa = ''
        }
      } else {
        resultado.precisa_acao_manual = true
        resultado.descricao_tarefa = `Cliente não encontrado na Stripe: ${extrairEmail(remetente)}. Verificar manualmente. Motivo: ${analise.motivo || ''}`
      }
    } catch (e: any) {
      resultado.precisa_acao_manual = true
      resultado.descricao_tarefa = `Erro ao consultar Stripe: ${e.message}. Verificar manualmente.`
    }
  }

  return resultado
}

// ─── Stripe ───────────────────────────────────────────────────────────────────
async function analisarReembolso(emailCliente: string) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!
  const PRAZO_DIAS = 7

  const custRes = await fetch(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(emailCliente)}&limit=1`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  )
  const custData = await custRes.json()
  if (!custData.data?.length) {
    return { encontrado: false, motivo: 'Cliente não encontrado no Stripe com esse e-mail.' }
  }
  const cliente = custData.data[0]

  const chargeRes = await fetch(
    `https://api.stripe.com/v1/charges?customer=${cliente.id}&limit=1`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  )
  const chargeData = await chargeRes.json()
  if (!chargeData.data?.length) {
    return { encontrado: false, motivo: 'Nenhuma cobrança encontrada para este cliente.' }
  }
  const cobranca = chargeData.data[0]

  if (cobranca.refunded) {
    return { encontrado: false, motivo: 'Este pagamento já foi reembolsado anteriormente.' }
  }

  const dataCompra = new Date(cobranca.created * 1000)
  const dias = Math.floor((Date.now() - dataCompra.getTime()) / (1000 * 60 * 60 * 24))
  const elegivel = dias <= PRAZO_DIAS

  const subRes = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${cliente.id}&status=active&limit=1`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  )
  const subData = await subRes.json()
  const temAssinatura = subData.data?.length > 0
  const assinaturaId = temAssinatura ? subData.data[0].id : null

  return {
    encontrado: true,
    elegivel,
    cliente_id: cliente.id,
    cobranca_id: cobranca.id,
    assinatura_id: assinaturaId,
    tem_assinatura: temAssinatura,
    nome: cliente.name || emailCliente,
    email: emailCliente,
    produto: cobranca.description || 'Não identificado',
    valor: cobranca.amount / 100,
    moeda: (cobranca.currency || 'brl').toUpperCase(),
    data_compra: dataCompra.toLocaleDateString('pt-BR') + ' às ' + dataCompra.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    dias_passados: dias,
    prazo_dias: PRAZO_DIAS,
    motivo_inelegivel: !elegivel ? `Compra realizada há ${dias} dias (prazo máximo: ${PRAZO_DIAS} dias).` : '',
  }
}

async function executarReembolso(cobrancaId: string, assinaturaId?: string) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!

  const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `charge=${cobrancaId}`,
  })
  const refund = await refundRes.json()

  let assinaturaCancelada = false
  if (assinaturaId) {
    await fetch(`https://api.stripe.com/v1/subscriptions/${assinaturaId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    assinaturaCancelada = true
  }

  return {
    sucesso: true,
    reembolso_id: refund.id,
    assinatura_cancelada: assinaturaCancelada,
  }
}

// ─── SMTP send via nodemailer ─────────────────────────────────────────────────
async function enviarEmailSMTP(para: string, assunto: string, corpo: string): Promise<void> {
  // @ts-ignore — Deno npm compat
  const nodemailer = (await import('npm:nodemailer@6')).default

  const emailFrom = Deno.env.get('EMAIL')!
  const transporter = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST') || 'smtpout.secureserver.net',
    port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
    secure: true,
    auth: {
      user: emailFrom,
      pass: Deno.env.get('EMAIL_PASSWORD')!,
    },
  })

  const destino = para.includes('<') ? para.split('<')[1].replace('>', '').trim() : para.trim()

  const corpoBR = corpo.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  const corpoHtml = `<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;"><div style="white-space:pre-wrap;">${corpoBR}</div>${ASSINATURA_HTML}</body></html>`

  await transporter.sendMail({
    from: `ABRAhub Suporte <${emailFrom}>`,
    to: destino,
    subject: `Re: ${assunto}`,
    text: corpo,
    html: corpoHtml,
  })
}

// ─── IMAP full check cycle ─────────────────────────────────────────────────────
async function runEmailCheck(supabase: any): Promise<{ processados: number; erros: number }> {
  // @ts-ignore — Deno npm compat
  const { ImapFlow } = await import('npm:imapflow@1')
  // @ts-ignore
  const { simpleParser } = await import('npm:mailparser@3')

  const emailAccount = Deno.env.get('EMAIL')!

  const client = new ImapFlow({
    host: Deno.env.get('IMAP_HOST') || 'imap.secureserver.net',
    port: parseInt(Deno.env.get('IMAP_PORT') || '993'),
    secure: true,
    auth: { user: emailAccount, pass: Deno.env.get('EMAIL_PASSWORD')! },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  })

  // Prevent unhandled error events from crashing the Deno process
  client.on('error', (err: Error) => {
    console.error('IMAP error event:', err.message)
  })

  await client.connect()
  const lock = await client.getMailboxLock('INBOX')

  let processados = 0
  let erros = 0

  // Collect messages first (avoid modifying mailbox while iterating)
  const toSkip: number[] = []
  const toDelete: number[] = []
  const toProcess: Array<{ uid: number; remetente: string; assunto: string; corpo: string }> = []

  try {
    let count = 0
    for await (const msg of client.fetch({ seen: false }, { envelope: true, source: true, uid: true })) {
      if (count >= 15) break
      count++

      const fromAddr = msg.envelope.from?.[0]?.address || ''
      const fromName = msg.envelope.from?.[0]?.name || ''
      const remetente = fromName ? `${fromName} <${fromAddr}>` : fromAddr

      // Skip own emails
      if (fromAddr.toLowerCase() === emailAccount.toLowerCase()) {
        toSkip.push(msg.uid as number)
        continue
      }

      // Skip and delete no-reply emails
      if (NO_REPLY_PATTERNS.some(p => fromAddr.toLowerCase().includes(p))) {
        toDelete.push(msg.uid as number)
        continue
      }

      try {
        const parsed = await simpleParser(msg.source)
        toProcess.push({
          uid: msg.uid as number,
          remetente,
          assunto: parsed.subject || '(sem assunto)',
          corpo: parsed.text?.trim() || '',
        })
      } catch {
        toSkip.push(msg.uid as number)
      }
    }

    // Mark skipped as seen
    for (const uid of toSkip) {
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
    }

    // Mark no-reply as seen + deleted
    for (const uid of toDelete) {
      await client.messageFlagsAdd(uid, ['\\Seen', '\\Deleted'], { uid: true })
    }

    // Load global knowledge base
    const { data: knowledgeDocs } = await supabase
      .from('ai_knowledge_base')
      .select('name, content')
      .order('created_at', { ascending: true })

    const knowledgeContext = knowledgeDocs && knowledgeDocs.length > 0
      ? knowledgeDocs.map((d: any) => `--- ${d.name} ---\n${d.content}`).join('\n\n')
      : undefined

    // Process each email
    for (const em of toProcess) {
      try {
        // Check if it's feedback
        const feedback = await detectarFeedback(em.assunto, em.corpo)
        if (feedback.eh_feedback) {
          await supabase.from('email_feedbacks').insert({
            email_from: em.remetente,
            motivo: feedback.motivo || '',
            feedback: em.corpo,
          })
        } else {
          // Fetch previous interactions for context
          const emailClean = extrairEmail(em.remetente)
          const { data: prevTasks } = await supabase
            .from('email_tasks')
            .select('email_subject, tipo, email_sent, created_at')
            .ilike('email_from', `%${emailClean}%`)
            .order('created_at', { ascending: false })
            .limit(5)

          let historico = ''
          if (prevTasks && prevTasks.length > 0) {
            historico = [...prevTasks].reverse().map((t: any) => {
              const data = new Date(t.created_at).toLocaleDateString('pt-BR')
              return `[${data}] Assunto: ${t.email_subject} | Tipo: ${t.tipo}\nResposta enviada: ${t.email_sent || '(sem resposta)'}`
            }).join('\n\n---\n\n')
          }

          const resultado = await processarEmail(em.remetente, em.assunto, em.corpo, historico || undefined, knowledgeContext)

          await supabase.from('email_tasks').insert({
            email_from: em.remetente,
            email_subject: em.assunto,
            tipo: resultado.tipo,
            description: resultado.descricao_tarefa || '',
            email_sent: resultado.resposta_email,
            email_body: em.corpo,
            precisa_acao: resultado.precisa_acao_manual,
            status: resultado.precisa_acao_manual ? 'pending' : 'auto',
          })
        }

        // Mark as seen and move to Respondidos
        await client.messageFlagsAdd(em.uid, ['\\Seen'], { uid: true })
        try {
          await client.messageMove(em.uid, PASTA_RESPONDIDOS, { uid: true })
        } catch {
          try {
            await client.mailboxCreate(PASTA_RESPONDIDOS)
            await client.messageMove(em.uid, PASTA_RESPONDIDOS, { uid: true })
          } catch { /* ignore if move fails */ }
        }

        processados++
      } catch (e: any) {
        erros++
        console.error('Erro ao processar email:', e.message)
      }
    }
  } finally {
    lock.release()
    await client.logout()
  }

  return { processados, erros }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const path = url.pathname.replace('/email-agent', '').replace('/functions/v1', '')

  try {
    // GET /tasks — list tasks and stats
    if (req.method === 'GET' && (path === '/tasks' || path === '' || path === '/')) {
      const days = parseInt(url.searchParams.get('days') || '0')
      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceStr = since.toISOString().split('T')[0]

      const { data: tasks } = await supabase
        .from('email_tasks')
        .select('*')
        .gte('created_at', sinceStr + 'T00:00:00')
        .order('created_at', { ascending: false })

      const allTasks = tasks || []

      // Single query to fetch all historical tasks (avoids N+1)
      const { data: historicalTasks } = await supabase
        .from('email_tasks')
        .select('email_from')
        .lt('created_at', sinceStr + 'T00:00:00')

      const historyCounts: Record<string, number> = {}
      for (const t of historicalTasks || []) {
        const email = extrairEmail(t.email_from)
        historyCounts[email] = (historyCounts[email] || 0) + 1
      }

      const tasksWithHistory = allTasks.map((t: any) => ({
        ...t,
        history_count: historyCounts[extrairEmail(t.email_from)] || 0,
      }))

      const stats = {
        total: allTasks.length,
        pending: allTasks.filter((t: any) => t.status === 'pending').length,
        auto: allTasks.filter((t: any) => t.status === 'auto').length,
        done: allTasks.filter((t: any) => t.status === 'done').length,
      }

      return new Response(JSON.stringify({ tasks: tasksWithHistory, stats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GET /history/:email — full history of a sender
    if (req.method === 'GET' && path.startsWith('/history/')) {
      const email = decodeURIComponent(path.split('/history/')[1])
      const { data } = await supabase
        .from('email_tasks')
        .select('*')
        .ilike('email_from', `%${email}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      return new Response(JSON.stringify({ history: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GET /feedbacks — list feedbacks
    if (req.method === 'GET' && path === '/feedbacks') {
      const { data } = await supabase
        .from('email_feedbacks')
        .select('*')
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ feedbacks: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST /run — trigger full IMAP check cycle
    if (req.method === 'POST' && path === '/run') {
      try {
        const result = await runEmailCheck(supabase)
        return new Response(JSON.stringify({ sucesso: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        return new Response(JSON.stringify({ sucesso: false, erro: e.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // POST /send/:id — send email reply via SMTP
    if (req.method === 'POST' && path.startsWith('/send/')) {
      const id = path.split('/send/')[1]
      const body = await req.json().catch(() => ({}))
      const emailSentOverride = body.email_sent

      const { data: task } = await supabase.from('email_tasks').select('*').eq('id', id).single()
      if (!task) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'Tarefa não encontrada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const corpoFinal = emailSentOverride || task.email_sent

      // Persist edited draft if changed
      if (emailSentOverride && emailSentOverride !== task.email_sent) {
        await supabase.from('email_tasks').update({ email_sent: corpoFinal }).eq('id', id)
      }

      await enviarEmailSMTP(task.email_from, task.email_subject, corpoFinal)

      // Auto tasks become done after sending
      if (task.status === 'auto') {
        await supabase.from('email_tasks').update({ status: 'done' }).eq('id', id)
      }

      return new Response(JSON.stringify({ sucesso: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST /process — process a single email (called from external or IMAP proxy)
    if (req.method === 'POST' && path === '/process') {
      const { remetente, assunto, corpo } = await req.json()

      const feedback = await detectarFeedback(assunto, corpo)
      if (feedback.eh_feedback) {
        await supabase.from('email_feedbacks').insert({
          email_from: remetente,
          motivo: feedback.motivo || '',
          feedback: corpo,
        })
        return new Response(JSON.stringify({ sucesso: true, tipo: 'feedback', motivo: feedback.motivo }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: knowledgeDocs } = await supabase
        .from('ai_knowledge_base')
        .select('name, content')
        .order('created_at', { ascending: true })

      const knowledgeContext = knowledgeDocs && knowledgeDocs.length > 0
        ? knowledgeDocs.map((d: any) => `--- ${d.name} ---\n${d.content}`).join('\n\n')
        : undefined

      const emailClean = extrairEmail(remetente)
      const { data: prevTasks } = await supabase
        .from('email_tasks')
        .select('email_subject, tipo, email_sent, created_at')
        .ilike('email_from', `%${emailClean}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      let historico = ''
      if (prevTasks && prevTasks.length > 0) {
        historico = [...prevTasks].reverse().map((t: any) => {
          const data = new Date(t.created_at).toLocaleDateString('pt-BR')
          return `[${data}] Assunto: ${t.email_subject} | Tipo: ${t.tipo}\nResposta enviada: ${t.email_sent || '(sem resposta)'}`
        }).join('\n\n---\n\n')
      }

      const resultado = await processarEmail(remetente, assunto, corpo, historico || undefined, knowledgeContext)

      const status = resultado.precisa_acao_manual ? 'pending' : 'auto'
      await supabase.from('email_tasks').insert({
        email_from: remetente,
        email_subject: assunto,
        tipo: resultado.tipo,
        description: resultado.descricao_tarefa || '',
        email_sent: resultado.resposta_email,
        email_body: corpo,
        precisa_acao: resultado.precisa_acao_manual,
        status,
      })

      return new Response(JSON.stringify({
        sucesso: true,
        tipo: resultado.tipo,
        precisa_acao: resultado.precisa_acao_manual,
        resposta: resultado.resposta_email,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST /done/:id — mark task as done
    if (req.method === 'POST' && path.startsWith('/done/')) {
      const id = path.split('/done/')[1]
      await supabase.from('email_tasks').update({ status: 'done' }).eq('id', id)
      return new Response(JSON.stringify({ sucesso: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GET /analisar/:id — analyze refund in Stripe
    if (req.method === 'GET' && path.startsWith('/analisar/')) {
      const id = path.split('/analisar/')[1]
      const { data: task } = await supabase.from('email_tasks').select('*').eq('id', id).single()
      if (!task) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'Tarefa não encontrada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const emailRaw = task.email_from
      const emailClean = emailRaw.includes('<') ? emailRaw.split('<')[1].replace('>', '').trim() : emailRaw.trim()
      const analise = await analisarReembolso(emailClean)

      return new Response(JSON.stringify({ sucesso: true, analise }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST /reembolsar/:id — execute refund
    if (req.method === 'POST' && path.startsWith('/reembolsar/')) {
      const id = path.split('/reembolsar/')[1]
      const { cobranca_id, assinatura_id } = await req.json()

      const resultado = await executarReembolso(cobranca_id, assinatura_id)
      if (resultado.sucesso) {
        await supabase.from('email_tasks').update({ status: 'done' }).eq('id', id)
      }

      return new Response(JSON.stringify(resultado), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
