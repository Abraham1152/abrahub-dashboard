-- =============================================
-- Seed Knowledge Base with Ads Strategy Documents
-- =============================================

INSERT INTO ai_knowledge_base (name, content) VALUES
(
  'Estrategia de Midia Paga - Visao Geral',
  $$Negocio: ABRAhub Studio - Comunidade + Cursos de Midia com IA
Tipo: Infoproduto / Comunidade Digital
Publico-Alvo: Gen Z + Millennials (18-40 anos), Brasil/LATAM
Objetivo: Vendas de cursos e assinaturas da comunidade
Orcamento: Ate R$5.000/mes
Landing Page: abrahub.com/comunidade
Preco Mensal: R$89/mes | Preco Anual: R$1.080/ano (R$534 com 50% off lancamento)

PLATAFORMAS:
- Meta Ads (Instagram/Facebook): 80% do budget (R$4.000/mes) - canal principal
- Google Ads (Search): 20% do budget (R$1.000/mes) - captura demanda existente

FUNIL META ADS:
- TOF (Topo): 30% - Interesse em IA, Lookalike, Reels Ads
- MOF (Meio): 30% - Retargeting video viewers e engajados IG
- BOF (Fundo): 40% - Retargeting pagina vendas, checkout abandonado, lista email

FUNIL GOOGLE ADS:
- Brand: 10% - Protecao de marca "abrahub"
- Non-Brand High Intent: 70% - "curso de IA", "criar conteudo com IA"
- Non-Brand Discovery: 20% - "como usar chatgpt", "ferramentas ia criadores"

MENSAGENS:
- Topo: "A IA esta mudando a forma de criar conteudo. Voce vai ficar para tras?"
- Meio: Prova social com resultados de alunos
- Fundo: Urgencia + escassez + oferta direta

REGRAS DE DECISAO:
- 3x Kill Rule: CPA > 3x target por 7 dias = pausar
- 20% Scale Rule: ROAS > target por 5 dias = aumentar budget 20%
- Creative Fatigue: CTR cair >30% em 7 dias = trocar criativo
- Learning Phase: Minimo 50 conversoes/semana para sair do learning$$
),
(
  'Arquitetura de Campanhas - Nomenclatura e Estrutura',
  $$CONVENCAO DE NOMENCLATURA:
Padrao: [Plataforma]_[Objetivo]_[Funil]_[Audiencia]_[Data]
Exemplos: META_CONV_TOF_InteresseIA_2026Q1, GADS_SEARCH_Brand_ABRAhub_2026Q1

META ADS - 4 CAMPANHAS:
1. META_CONV_TOF_Prospecting - R$1.200/mes (~R$40/dia)
   - Ad Set 1: Interesse IA+Tech (18-40, Brasil)
   - Ad Set 2: Lookalike 1% Engajados IG
   - Ad Set 3: Lookalike 1% Compradores (ativar apos 100+ compras)

2. META_CONV_MOF_Retargeting - R$1.200/mes (~R$40/dia)
   - Ad Set 1: Video Viewers 50%+ (7-30d)
   - Ad Set 2: IG Profile Engajados (30d)

3. META_CONV_BOF_HotAudience - R$1.600/mes (~R$53/dia)
   - Ad Set 1: Visitantes pagina vendas (7d)
   - Ad Set 2: Checkout abandonado (14d)
   - Ad Set 3: Lista de emails

4. META_CONV_ASC_Testing - Advantage+ Shopping (ativar apos 50+ conversoes)

GOOGLE ADS - 3 CAMPANHAS:
1. GADS_SEARCH_Brand - R$100/mes - keywords marca
2. GADS_SEARCH_NonBrand_HighIntent - R$700/mes - "curso ia", "criar conteudo ia"
3. GADS_SEARCH_NonBrand_Discovery - R$200/mes - "como usar chatgpt"

NEGATIVE KEYWORDS: gratis, gratuito, free, download, pdf, torrent, emprego, vaga$$
),
(
  'Plano de Orcamento - Budget e CPA Targets',
  $$TICKET MEDIO:
- Mensal: R$89/mes (LTV 12m: R$1.068)
- Anual: R$1.080/ano normal, R$534 com 50% off lancamento
- Blend: ~R$485 receita primeiro mes, LTV ~R$1.073

DISTRIBUICAO MENSAL (R$5.000):
- Meta Ads: 80% = R$4.000/mes (~R$133/dia)
- Google Ads: 20% = R$1.000/mes (~R$33/dia)

CPA TARGETS:
- CPA maximo sustentavel (1/3 LTV): R$357
- CPA operacional recomendado: R$80-120
- CPA agressivo (escala): R$50-80
- Break-even imediato (plano mensal): R$89

PACING:
- Mes 1-2 (Learning): CPA R$120-180, ROAS 1.0-1.5x, ~30-45 conversoes
- Mes 3-4 (Otimizacao): CPA R$80-120, ROAS 2.0x, ~44-67 conversoes
- Mes 5-6 (Escala): CPA R$50-80, ROAS 3.0x, ~64-105 conversoes

REGRAS:
- 3x Kill Rule: CPA > R$270 apos gastar R$180+ = PAUSAR
- 20% Scale Rule: CPA < target por 5+ dias = +20% budget
- Min R$30/dia por ad set (Meta), max 4 ad sets simultaneos
- Min R$10/dia por ad group (Google), max 3 ad groups simultaneos
- Escalar para R$10K+ quando ROAS > 2.5x sustentado por 30+ dias$$
),
(
  'Brief Criativo - Pilares e Producao',
  $$PROPOSTA DE VALOR: "Aprenda a criar conteudo profissional de midia usando IA - mesmo sem experiencia tecnica"

5 PILARES DE CONTEUDO:
1. DOR: "O mercado mudou. Quem nao domina IA vai ficar para tras."
   - Hooks: "Voce ainda cria video do jeito antigo?", "Agencias estao demitindo editores"
2. PROVA SOCIAL: "Veja o que nossos membros estao criando"
   - Compilacao resultados alunos, depoimentos, antes/depois
3. DEMONSTRACAO: "Veja como funciona. E mais facil do que voce imagina"
   - Demo ferramentas, tour comunidade, speed-run prompt>resultado
4. OFERTA: "Entre agora com 50% OFF. Vagas limitadas"
   - Urgencia, garantia 7 dias, quebra objecao
5. EDUCACAO: "Aprenda algo valioso agora"
   - Tutoriais, listas ferramentas, dicas praticas

FORMATOS PRIORITARIOS:
- P1: Reels verticais 15-30s (Meta) - 5-10 pecas
- P2: Imagens estaticas 1:1 (Meta/Google) - 10-15 pecas
- P3: Carroseis 5-7 slides (Meta) - 3-5 pecas
- P4: UGC/depoimento video (Meta) - 3-5 pecas

CADENCIA: 2-3 novos criativos a cada 2 semanas
FADIGA: trocar quando CTR cair >30% do pico$$
),
(
  'Setup de Tracking - Pixel e Conversoes',
  $$FLUXO DE TRACKING:
Visitante > abrahub.com/comunidade
  > Meta Pixel: PageView, ViewContent
  > Google Tag: page_view
  > Clica "Garantir minha vaga"
    > Meta Pixel: InitiateCheckout
    > Google Tag: begin_checkout
  > Thank You Page
    > Meta Pixel: Purchase (value, BRL)
    > Google Tag: conversion (value, BRL)
    > Meta CAPI: Purchase (server-side backup)

META PIXEL EVENTOS:
- PageView (automatico)
- ViewContent: content_name="Comunidade ABRAhub", value=89, BRL
- InitiateCheckout: no clique "Garantir minha vaga"
- Purchase: na thank-you page, value dinamico (89 ou 534 ou 1080)

META CAPI: Configurar pela plataforma de checkout (Hotmart/Kiwify nativo)
- EMQ target > 6.0
- Deduplicacao via event_id

GOOGLE ADS:
- gtag.js em todas as paginas
- Enhanced Conversions ativado
- Conversao "Purchase" com valor dinamico e transaction_id

UTM PARAMETERS:
- Meta: ?utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}
- Google: ?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}$$
),
(
  'Roadmap de Implementacao - Timeline 12 Semanas',
  $$FASE 1 - FUNDACAO (Semanas 1-2):
- Instalar Meta Pixel + Google Tag
- Configurar CAPI e Enhanced Conversions
- Verificar tracking com Pixel Helper e Tag Assistant
- Criar audiencias custom (engajados IG, video viewers)
- Preparar 6+ criativos iniciais (reutilizar videos IG)
- Montar estrutura de campanhas

FASE 2 - LANCAMENTO (Semanas 3-4):
- Lancar Meta TOF + Google Brand primeiro
- Depois Meta MOF + Google Non-Brand High Intent
- Depois Meta BOF + Google Discovery
- NAO fazer mudancas nos primeiros 3-5 dias
- Monitorar diariamente: CPM, CTR, CPC, CPA

FASE 3 - OTIMIZACAO (Semanas 5-8):
- Pausar ad sets com CPA > 3x target (3x Kill Rule)
- Escalar winners em 20%
- Trocar criativos com fadiga
- Negativar termos ruins no Google
- Considerar Advantage+ Shopping (se 50+ conversoes)

FASE 4 - ESCALA (Semanas 9-12):
- Escalar campanhas vencedoras (+20% a cada 5 dias)
- Ativar Broad match + Smart Bidding no Google
- Considerar TikTok Ads (se budget > R$7.5K)
- Report trimestral completo

CHECKPOINTS:
- Semana 4: Pixel registrando? CPA < R$200? CTR > 1%?
- Semana 8: ROAS > 1.5x? 50+ conversoes no pixel? Winners claros?
- Semana 12: ROAS > 2.5x? CPA < R$100? Pronto para escalar?$$
);
