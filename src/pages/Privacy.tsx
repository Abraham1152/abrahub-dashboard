import { useTranslation } from '@/i18n/useTranslation'

export default function PrivacyPage() {
  const { t, lang } = useTranslation()
  const lastUpdated = lang === 'en' ? 'February 21, 2026' : '21 de fevereiro de 2026'

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
          {t('privacy.title')}
        </h1>
        <p className="text-sm text-gray-400 dark:text-neutral-500 mb-10">
          {t('privacy.last_update')} {lastUpdated}
        </p>

        <div className="space-y-8 text-gray-600 dark:text-neutral-300 leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s1_title')}
            </h2>
            <p>{t('privacy.s1_text')}</p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s2_title')}
            </h2>
            <p className="mb-3">{t('privacy.s2_intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('privacy.s2_profile')}</li>
              <li>{t('privacy.s2_media')}</li>
              <li>{t('privacy.s2_comments')}</li>
              <li>{t('privacy.s2_messages')}</li>
              <li>{t('privacy.s2_ads')}</li>
              <li>{t('privacy.s2_insights')}</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s3_title')}
            </h2>
            <p className="mb-3">{t('privacy.s3_intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('privacy.s3_metrics')}</li>
              <li>{t('privacy.s3_automation')}</li>
              <li>{t('privacy.s3_ads')}</li>
              <li>{t('privacy.s3_log')}</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s4_title')}
            </h2>
            <p>{t('privacy.s4_text')}</p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s5_title')}
            </h2>
            <p>{t('privacy.s5_text')}</p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s6_title')}
            </h2>
            <p>{t('privacy.s6_text')}</p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s7_title')}
            </h2>
            <p className="mb-3">{t('privacy.s7_intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('privacy.s7_access')}</li>
              <li>{t('privacy.s7_correct')}</li>
              <li>{t('privacy.s7_delete')}</li>
              <li>{t('privacy.s7_revoke')}</li>
            </ul>
            <p className="mt-3">{t('privacy.s7_contact')}</p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s8_title')}
            </h2>
            <p>
              {t('privacy.s8_text')}{' '}
              <a href="mailto:suporte@abrahub.com" className="text-blue-500 hover:text-blue-400 underline">
                suporte@abrahub.com
              </a>{' '}
              {t('privacy.s8_subject')}
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s9_title')}
            </h2>
            <p className="mb-3">{t('privacy.s9_intro')}</p>
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-neutral-800">
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('privacy.s9_col_permission')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">{t('privacy.s9_col_purpose')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_basic</td>
                    <td className="px-4 py-3">{t('privacy.s9_basic')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_manage_comments</td>
                    <td className="px-4 py-3">{t('privacy.s9_comments')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_manage_messages</td>
                    <td className="px-4 py-3">{t('privacy.s9_messages')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">instagram_business_manage_insights</td>
                    <td className="px-4 py-3">{t('privacy.s9_insights')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">ads_read</td>
                    <td className="px-4 py-3">{t('privacy.s9_ads_read')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">ads_management</td>
                    <td className="px-4 py-3">{t('privacy.s9_ads_mgmt')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">pages_read_engagement</td>
                    <td className="px-4 py-3">{t('privacy.s9_pages')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">business_management</td>
                    <td className="px-4 py-3">{t('privacy.s9_business')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s10_title')}
            </h2>
            <p>{t('privacy.s10_text')}</p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {t('privacy.s11_title')}
            </h2>
            <p>{t('privacy.s11_text')}</p>
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
          <p>{t('privacy.footer')} &copy; {new Date().getFullYear()}</p>
        </div>
      </main>
    </div>
  )
}
