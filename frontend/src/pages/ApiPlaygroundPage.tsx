import { useTranslation } from 'react-i18next'
import { ApiPlayground } from '../components/ApiPlayground'
import { ENV } from '../constants/env'

const ApiPlaygroundPage = () => {
  const { t } = useTranslation()

  return (
    <div className="w-full min-w-0 px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8 py-3 xs:py-4 md:py-6 bg-background text-foreground">
      <div className="mx-auto w-full max-w-full md:max-w-5xl min-w-0">
        <ApiPlayground
          baseUrl={ENV.API_BASE_URL}
          title={t('apiPlayground.page.title')}
          description={t('apiPlayground.page.description')}
        />
      </div>
    </div>
  )
}

export default ApiPlaygroundPage
