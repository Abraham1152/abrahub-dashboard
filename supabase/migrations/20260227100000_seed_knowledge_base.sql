-- Seed: Abrahub business intelligence into ai_knowledge_base
-- Source of truth: Training Document v2 (fev/2026)
-- These docs are injected into ALL AI functions (ai-insights, ads-agent, instagram-webhook, email-agent)

INSERT INTO ai_knowledge_base (name, content) VALUES (
'Abrahub - Produto, Precos e Modelo de Receita (v2/2026)',
$$DOCUMENTO DE INTELIGENCIA DE NEGOCIO - ABRAHUB (SOURCE OF TRUTH - fev/2026)

PRODUTO UNICO: ABRAHUB STUDIO (membership)
- Plano mensal: R$90/mes
- Plano anual: R$1080/ano (equivalente a R$90/mes - paridade de preco, NAO e desconto)
- Anual serve para: liquidez antecipada + menor volatilidade de churn (travado 12 meses)
- NAO existe plano Pro, VIP pago, ou qualquer outro produto ativo hoje
- INVALIDO: R$129,90 / R$1290 / plano Pro - sao dados desatualizados, ignorar
- Escopo deste documento: Abrahub Studio. Ignora Mooze e Expatria.

O QUE INCLUI O STUDIO:
- Materiais de aprendizado, frameworks, prompts e workflows de IA
- Comunidade no Circle (discussao + feedback)
- Desafios mensais (aumentam skill e retencao)
- Updates sobre ferramentas de IA e guias praticos
- Value drops (templates, prompts, releases de workflows)

MODELO DE RECEITA (UNICO):
- Receita mensal: membros mensais x R$90
- Receita anual: membros anuais x R$1080 (caixa antecipado)
- NAO existem upsells, afiliados, cursos separados ou receitas de ferramentas ativas hoje
- Qualquer nova fonte de receita deve ser adicionada explicitamente pelo owner

FORMULAS CRITICAS:
- MRR = (MemberosMensais + MembrosAnuais) x 90
- ARR = MRR x 12
- Net MRR = MRR - reembolsos - chargebacks
- CashIn = (NovosMensais+RenovMensais)x90 + (NovosAnuais+RenovAnuais)x1080
- Churn mensal = MembrosChurnados / MembrosIniciais
- Net Adds = Novos - Churnados

IDENTIDADE E POSICIONAMENTO:
- Abrahub e um ecossistema AI-native de educacao + comunidade
- Foco em formar "AI Filmmakers" e operadores de midia com IA
- Promessa: um criador (ou time pequeno) produz midia profissional em escala orquestrando ferramentas generativas (imagem, video, audio, voz, edicao, automacao)
- YouTube NAO e conteudo - YouTube e infraestrutura de aquisicao
- Estilo de vendas: "invisible pitch" - o conteudo entrega valor e naturalmente leva a oferta

FUNIL DE AQUISICAO:
1. Video no YouTube (cinematico, proof-driven, demonstracoes de resultados)
2. CTA: "Comente AGENTE" -> DM automation / landing page
3. Checkout (mensal ou anual)
4. Onboarding -> first win (24-72h) -> retencao

SINAIS DE INTENT (relevantes para IA de DM/vendas):
- Volume de comentarios CTA (ex: "AGENTE")
- Click-through para checkout
- Taxa de conclusao do checkout
- Ratio mensal vs anual na selecao de plano

MOTOR DE RETENCAO (CRITICO - retencao e o negocio real):
Alavancas ativas:
- Desafios mensais (energia publica + prazos + premiacao)
- Reconhecimento publico (social proof na comunidade)
- Workflow/tool drops (novidade + leverage pratico)
- Feedback loops (membros postam resultados, recebem critica)
- Onboarding claro: first win em 24-72 horas

Sinais de ALTA retencao: completou onboarding, postou resultado em 7 dias, participou de desafio, retorna semanalmente (WAU/MAU alto)
Sinais de RISCO de churn: sem atividade pos-compra, sem primeiro post em 7-14 dias, frequencia de sessao caindo, ignorando anuncios de desafios

KPIS ESSENCIAIS:
- MRR, Net MRR, ARR (saude de receita)
- CashIn mensal (liquidez)
- Churn mensal (saude de retencao)
- 7-day activation rate (eficacia do onboarding)
- WAU/MAU (stickiness)
- Plan mix - AnnualShare (estabilidade de cashflow)
- Failed payments rate (priorizacao de dunning)

ESTRATEGIA DE CONTEUDO:
Temas: dominancia de ferramentas de IA, disrupcao do cinema, one-man media empire, automacao de workflows, narrativas de mudanca cultural
Estrutura do video: Hook -> Authority Build -> Demonstracao -> Arco narrativo -> Soft CTA
Framework de vendas: Proof (mostra resultados antes de explicar) -> Promise (transformacao possivel) -> Plan (como o Studio estrutura o caminho)

EXPANSAO FUTURA (NAO sao receitas ativas - NAO contar em calculos atuais):
- VIP Mentorship (R$2k-5k por coorte)
- Masterclasses (R$27-R$97)
- Afiliados de ferramentas de IA
- SaaS layer de ferramentas
- Certificacao AI Filmmaker
- Expansao LATAM e mercado ingles

PLATAFORMA: Circle (comunidade) | Stripe/Kiwify (pagamentos) | Supabase (infra)
$$
);

INSERT INTO ai_knowledge_base (name, content) VALUES (
'Abrahub - Estrategia, Funil e Estrutura de Custos (2026)',
$$DOCUMENTO ESTRATEGICO - ABRAHUB ECOSYSTEM (2026)
NOTA: Para precos e receita, usar SEMPRE o documento "Produto, Precos e Modelo de Receita (v2/2026)" como source of truth.

OBJETIVO ESTRATEGICO PRIMARIO:
Maximizar LTV por membro mantendo eficiencia de aquisicao via posicionamento de autoridade no YouTube.
Modelo central: Autoridade -> Comunidade -> Receita Recorrente -> (futuro) Upsell -> Ecossistema de Ferramentas

LTV MODEL (referencia):
- Ticket mensal atual: R$90
- Se lifetime medio = 12 meses: LTV ~= R$1.080 por membro
- Se lifetime medio = 18 meses: LTV ~= R$1.620 por membro
- Meta de churn: abaixo de 7% mensal
- Meta de lifetime medio: 12-18 meses

ESTRUTURA DE CUSTOS:
A) Plataforma/Infraestrutura:
- Circle (plataforma de comunidade)
- Supabase (infra/backend)
- Email/CRM tools
- Dominio/analytics
- Stripe: ~4-5% de processamento no Brasil

B) AI Tooling/Credits (podem ser fixo, variavel por uso, ou hibrido):
- Geracao de imagem
- Geracao de video (Kling, Veo, etc.)
- Voz/audio
- APIs de IA (Gemini, etc.)

C) Producao de Conteudo:
- Edicao de video
- Thumbnails/design
- Sound design
- Contratados (se houver)

D) Marketing:
- Trafego pago (se ativo)
- Parcerias com influenciadores
- Software de automacao de DM
- Afiliados (se ativo)

E) Suporte/Operacoes:
- Moderacao de comunidade
- Suporte ao cliente
- Admin

META DE MARGEM: >70% de margem bruta (produto digital)
Modelo de margem: se o Studio NAO subsidia creditos de IA para membros, custo variavel por membro e quase zero.

FUNIL DE VENDAS DETALHADO:
1. Video YouTube de alta autoridade (cinematico)
2. Pitch invisivel embutido
3. CTA: "Comente AGENTE" / Masterclass / Creative Engine
4. Automacao de DM ou landing page
5. Oferta de entrada
6. Sequencia de email de upsell
7. Oferta de upgrade anual

ESTRUTURA DA COMUNIDADE (Circle):
Spaces: Geral, Fixados, Desafios, Jobs, VIP Private Room, Tool Updates
Drivers de retencao: desafios mensais com premios, reconhecimento publico, sistema de gamificacao por nivel, sessoes ao vivo semanais/quinzenais, workflows exclusivos

EXPERIMENTOS DE AQUISICAO (validos):
- Melhorar clareza do CTA em videos com muitas views mas pouca conversao
- Reeditar videos em Shorts/Reels para aumentar volume de topo de funil
- Adicionar "demo sequence" (antes/depois) no minuto 1-2 para maior densidade de prova
- Usar anuncios de desafios como picos de conversao

EXPERIMENTOS DE RETENCAO (validos):
- Sprint "First Win" de 7 dias (reduzir churn precoce)
- Prompts e mini-tarefas semanais (aumentar WAU/MAU)
- Criar pods de accountability para novos membros
- Publicar board de "wins de membros" semanalmente

EXPERIMENTOS DE MONETIZACAO (validos APENAS dentro da oferta atual):
- Selecao anual como default no checkout
- Janelas de bonus empilhados (tempo limitado)
- Price anchoring no conteudo (posicionar valor vs alternativas)
INVALIDOS (ate serem habilitados explicitamente): introducao de tiers Pro/VIP pagos, venda de cursos separados, licencas de ferramentas

EXPANSAO ESTRATEGICA (fases):
Fase 1: Dominancia de autoridade no Brasil em AI Filmmaking
Fase 2: Escala para LATAM
Fase 3: Expansao para mercado ingles
Fase 4: Camada SaaS de integracao de ferramentas
Fase 5: Certificacao AI Filmmaker
Meta final: Posicionar Abrahub como academia de referencia para profissionais de midia AI-native
$$
);
