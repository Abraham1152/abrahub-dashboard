export default function PrivacyPage() {
  const lastUpdated = '21 de fevereiro de 2026'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">A</div>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">ABRAhub Studio</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Politica de Privacidade
        </h1>
        <p className="text-sm text-gray-400 dark:text-neutral-500 mb-10">
          Ultima atualizacao: {lastUpdated}
        </p>

        <div className="space-y-8 text-gray-600 dark:text-neutral-300 leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              1. Introducao
            </h2>
            <p>
              Esta Politica de Privacidade descreve como o aplicativo <strong>Dashboard ABRAhub</strong> ("nos", "nosso")
              coleta, utiliza e protege as informacoes obtidas atraves da integracao com a plataforma Meta
              (Instagram e Facebook Ads). Ao utilizar nosso aplicativo, voce concorda com as praticas descritas nesta politica.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              2. Dados que coletamos
            </h2>
            <p className="mb-3">Atraves das APIs do Instagram e Meta, coletamos os seguintes dados:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Informacoes do perfil:</strong> nome de usuario, ID da conta, foto de perfil,
                numero de seguidores e contagem de publicacoes.
              </li>
              <li>
                <strong>Publicacoes (midia):</strong> imagens, legendas, metricas de engajamento
                (curtidas, comentarios, alcance) e data de publicacao.
              </li>
              <li>
                <strong>Comentarios:</strong> texto do comentario, nome de usuario do autor e
                data/hora do comentario em publicacoes da conta conectada.
              </li>
              <li>
                <strong>Mensagens diretas:</strong> enviamos mensagens diretas em resposta a comentarios
                conforme regras de automacao configuradas pelo proprietario da conta. Nao armazenamos
                o conteudo de mensagens recebidas.
              </li>
              <li>
                <strong>Dados de anuncios (Ads):</strong> campanhas, conjuntos de anuncios, anuncios individuais,
                metricas de desempenho (impressoes, cliques, alcance, conversoes, custo por resultado),
                orcamento e periodo de veiculacao.
              </li>
              <li>
                <strong>Insights e metricas avancadas:</strong> dados agregados de desempenho do perfil,
                alcance de publicacoes, impressoes e dados demograficos do publico.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              3. Como utilizamos os dados
            </h2>
            <p className="mb-3">Os dados coletados sao utilizados exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Exibicao de metricas:</strong> apresentar estatisticas de desempenho das
                publicacoes no painel do dashboard.
              </li>
              <li>
                <strong>Automacao de respostas:</strong> detectar palavras-chave em comentarios e
                responder automaticamente com mensagens pre-configuradas pelo proprietario da conta
                (respostas publicas e/ou mensagens diretas).
              </li>
              <li>
                <strong>Gerenciamento de anuncios:</strong> visualizar, monitorar e gerenciar campanhas
                de anuncios no Instagram e Facebook, incluindo metricas de desempenho, orcamento
                e otimizacao de campanhas.
              </li>
              <li>
                <strong>Registro de atividade:</strong> manter um historico de acoes automatizadas
                para auditoria e controle pelo proprietario da conta.
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              4. Armazenamento e seguranca
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Os dados sao armazenados em servidores seguros fornecidos pela <strong>Supabase</strong>
                (infraestrutura AWS), com criptografia em transito (TLS/SSL) e em repouso.
              </li>
              <li>
                O acesso ao banco de dados e protegido por Row Level Security (RLS) e autenticacao
                obrigatoria.
              </li>
              <li>
                Tokens de acesso da API do Instagram sao armazenados como variaveis de ambiente
                seguras (secrets), nunca expostos no codigo-fonte ou no frontend.
              </li>
              <li>
                Nao compartilhamos, vendemos ou transferimos dados a terceiros.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              5. Compartilhamento de dados
            </h2>
            <p>
              <strong>Nao compartilhamos dados pessoais com terceiros.</strong> Os dados coletados sao
              utilizados exclusivamente dentro do aplicativo para as finalidades descritas acima.
              Os unicos servicos que processam dados sao:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Meta/Instagram API:</strong> para leitura de dados e envio de respostas.</li>
              <li><strong>Supabase:</strong> para armazenamento seguro do banco de dados.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              6. Retencao de dados
            </h2>
            <p>
              Os dados de publicacoes e metricas sao atualizados periodicamente e mantidos enquanto a
              conta estiver conectada. O historico de comentarios processados e mantido para evitar
              acoes duplicadas. O proprietario da conta pode solicitar a exclusao de todos os dados
              a qualquer momento.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              7. Direitos do usuario
            </h2>
            <p className="mb-3">Voce tem o direito de:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Acessar</strong> todos os dados que armazenamos sobre sua conta.</li>
              <li><strong>Corrigir</strong> informacoes incorretas ou desatualizadas.</li>
              <li><strong>Excluir</strong> seus dados permanentemente, incluindo historico de automacoes.</li>
              <li><strong>Revogar</strong> o acesso do aplicativo a qualquer momento desconectando a conta
                nas configuracoes do Instagram.</li>
            </ul>
            <p className="mt-3">
              Para exercer esses direitos, entre em contato conosco pelo email indicado abaixo.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              8. Exclusao de dados
            </h2>
            <p>
              Conforme exigido pela Meta Platform, oferecemos um mecanismo de exclusao de dados.
              Para solicitar a exclusao completa dos seus dados, envie um email para{' '}
              <a href="mailto:suporte@abrahub.com" className="text-blue-500 hover:text-blue-400 underline">
                suporte@abrahub.com
              </a>{' '}
              com o assunto "Exclusao de dados". Processaremos sua solicitacao em ate 30 dias.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              9. Permissoes utilizadas
            </h2>
            <p className="mb-3">Nosso aplicativo utiliza as seguintes permissoes das APIs do Instagram e Meta:</p>
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-neutral-800">
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">Permissao</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">Finalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_basic</td>
                    <td className="px-4 py-3">Ler perfil, publicacoes e metricas da conta</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_manage_comments</td>
                    <td className="px-4 py-3">Ler e responder comentarios nas publicacoes</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_manage_messages</td>
                    <td className="px-4 py-3">Enviar mensagens diretas em resposta a comentarios</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_manage_insights</td>
                    <td className="px-4 py-3">Acessar metricas avancadas e insights do perfil</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">ads_read</td>
                    <td className="px-4 py-3">Ler campanhas, metricas e relatorios de anuncios</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">ads_management</td>
                    <td className="px-4 py-3">Gerenciar campanhas, orcamentos e configuracoes de anuncios</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">pages_read_engagement</td>
                    <td className="px-4 py-3">Ler metricas de engajamento da pagina vinculada</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">business_management</td>
                    <td className="px-4 py-3">Acessar configuracoes da conta business no Meta</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              10. Alteracoes nesta politica
            </h2>
            <p>
              Podemos atualizar esta Politica de Privacidade periodicamente. Quaisquer alteracoes
              serao publicadas nesta pagina com a data de atualizacao revisada.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              11. Contato
            </h2>
            <p>
              Se voce tiver duvidas sobre esta Politica de Privacidade ou sobre o tratamento dos
              seus dados, entre em contato:
            </p>
            <div className="mt-3 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 space-y-1">
              <p><strong>ABRAhub Studio</strong></p>
              <p>
                Email:{' '}
                <a href="mailto:suporte@abrahub.com" className="text-blue-500 hover:text-blue-400 underline">
                  suporte@abrahub.com
                </a>
              </p>
              <p>
                Instagram:{' '}
                <a href="https://instagram.com/abrahubstudio" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">
                  @abrahubstudio
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-neutral-800 text-center text-sm text-gray-400 dark:text-neutral-500">
          <p>ABRAhub Studio &copy; {new Date().getFullYear()} — Todos os direitos reservados</p>
        </div>
      </main>
    </div>
  )
}
