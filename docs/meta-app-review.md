# Meta App Review - Textos Prontos para Submissao

## Informacoes do App

- **Nome:** Dashboard ABRAhub
- **Categoria:** Business and Pages
- **URL da Politica de Privacidade:** https://[SEU-DOMINIO]/privacy
- **URL de Exclusao de Dados:** https://[SEU-DOMINIO]/privacy (secao 8)

---

## Permissao: instagram_business_basic

### Como o app usa essa permissao (preencher no formulario):

> O Dashboard ABRAhub e uma ferramenta interna de gerenciamento de redes sociais para a conta @abrahubstudio. Utilizamos a permissao instagram_business_basic para:
>
> 1. Exibir informacoes do perfil (nome de usuario, foto, contagem de seguidores) no painel de controle.
> 2. Listar todas as publicacoes da conta com suas metricas (curtidas, comentarios, alcance) em um grid visual.
> 3. Permitir que o proprietario da conta monitore o desempenho de cada publicacao em um unico lugar.
>
> Esta permissao e usada apenas para a conta do proprietario do app. Nenhum dado de outros usuarios e coletado ou armazenado.

### Instrucoes para o Revisor:

> 1. Acesse [URL-DO-DASHBOARD]
> 2. Faca login com as credenciais de teste fornecidas
> 3. No menu lateral, clique em "Insta Ninja"
> 4. Observe o grid de publicacoes carregadas do Instagram com thumbnails e metricas
> 5. No topo da pagina, veja as estatisticas gerais (automacoes ativas, publicacoes monitoradas)

---

## Permissao: instagram_business_manage_comments

### Como o app usa essa permissao (preencher no formulario):

> O Dashboard ABRAhub utiliza a permissao instagram_business_manage_comments para implementar um sistema de automacao de respostas a comentarios. O funcionamento:
>
> 1. O proprietario da conta configura regras de automacao por publicacao, definindo palavras-chave de ativacao (ex: "eu quero", "link", "agente").
> 2. O sistema monitora periodicamente os comentarios nas publicacoes configuradas.
> 3. Quando um comentario contem uma palavra-chave configurada, o sistema responde automaticamente com uma mensagem pre-definida (ex: "Ja te enviei no direct!").
> 4. Todas as acoes sao registradas em um log de atividade para auditoria.
>
> Apenas comentarios em publicacoes da propria conta sao lidos. Nenhum comentario de outras contas e acessado. As respostas automaticas sao configuradas exclusivamente pelo proprietario da conta.

### Instrucoes para o Revisor:

> 1. Acesse [URL-DO-DASHBOARD] e faca login
> 2. No menu lateral, clique em "Insta Ninja"
> 3. Clique no botao "Configurar Automacao" em qualquer publicacao
> 4. No modal que abre, observe:
>    - Campo de palavras-chave: digite uma keyword e pressione Enter para adicionar
>    - Campo de respostas: adicione mensagens que serao usadas como resposta publica
>    - Toggle "Ativo": ativa/desativa a automacao
> 5. Clique em "Salvar Automacao"
> 6. Na aba "Log de Atividade", veja o historico de comentarios processados com status

---

## Permissao: instagram_business_manage_messages

### Como o app usa essa permissao (preencher no formulario):

> O Dashboard ABRAhub utiliza a permissao instagram_business_manage_messages como complemento ao sistema de automacao de comentarios. Alem de responder publicamente, o sistema pode enviar uma mensagem direta (DM) privada ao usuario que comentou. O funcionamento:
>
> 1. O proprietario configura uma mensagem de DM e opcionalmente um link e/ou botoes com URLs.
> 2. Quando um comentario ativa a automacao (match de keyword), alem da resposta publica, o sistema envia uma DM privada ao autor do comentario usando a API de Private Replies (recipient: comment_id).
> 3. A DM pode conter texto, link e ate 3 botoes com URLs (ex: link para produto, canal, etc).
> 4. Todas as DMs enviadas sao registradas no log de atividade.
>
> As DMs sao enviadas apenas em resposta a comentarios na propria conta, respeitando o limite de 1 DM por comentario e a janela de 7 dias da API. O proprietario tem controle total sobre o conteudo das mensagens.

### Instrucoes para o Revisor:

> 1. Acesse [URL-DO-DASHBOARD] e faca login
> 2. No menu lateral, clique em "Insta Ninja"
> 3. Clique no botao "Configurar Automacao" em qualquer publicacao
> 4. No modal, role ate a secao "Mensagem DM (privada)":
>    - Campo de texto da mensagem DM
>    - Campo de link (opcional)
>    - Botao "+ Adicionar Botao" para criar botoes com URL e titulo
>    - Visualizacao de como a DM aparece para o usuario
> 5. Configure uma mensagem e salve
> 6. Na aba "Log de Atividade", as acoes mostram badges "REPLY" e "DM" indicando o que foi executado

---

## Credenciais de Teste

> **URL:** [URL-DO-DASHBOARD]
> **Email:** [CRIAR-CONTA-DE-TESTE]
> **Senha:** [SENHA-DE-TESTE]
>
> NOTA: Nao forneca credenciais de super admin. Crie uma conta de teste com acesso limitado.

---

## Roteiro do Screencast (gravar com Loom/OBS)

### Video 1: instagram_business_basic (1-2 min)
1. Abra o dashboard e faca login
2. Clique em "Insta Ninja" no menu
3. Mostre o grid de posts carregando do Instagram
4. Mostre as metricas (curtidas, comentarios) em cada post
5. Mostre as estatisticas no topo da pagina
6. Narre: "O app carrega as publicacoes e metricas do meu perfil Instagram para monitoramento"

### Video 2: instagram_business_manage_comments (2-3 min)
1. No grid de posts, clique em "Configurar Automacao"
2. Adicione keywords (ex: "eu quero", "link")
3. Adicione respostas publicas (ex: "Ja te enviei no direct!")
4. Ative a automacao e salve
5. Mostre a aba "Log de Atividade"
6. Narre: "Quando alguem comenta uma keyword no meu post, o sistema responde automaticamente com uma mensagem configurada"

### Video 3: instagram_business_manage_messages (2-3 min)
1. Abra o modal de automacao novamente
2. Preencha a mensagem DM
3. Adicione um link
4. Adicione um botao com URL e titulo
5. Mostre o preview da DM
6. Salve e mostre o log
7. Narre: "Alem da resposta publica, o sistema envia uma mensagem direta privada com link e botoes ao usuario que comentou"

---

## Checklist antes de submeter

- [ ] Icone do app configurado (1024x1024)
- [ ] URL da Politica de Privacidade acessivel publicamente
- [ ] Categoria do app definida
- [ ] Screencasts gravados e hospedados (YouTube/Loom unlisted)
- [ ] Conta de teste criada (nao-admin)
- [ ] Textos de justificativa preenchidos para cada permissao
- [ ] Instrucoes para revisor preenchidas
