import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h1 className="text-4xl font-bold">{t('notFound.title')}</h1>
      <p className="text-muted-foreground">{t('notFound.message')}</p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
      >
        {t('notFound.goHome')}
      </Link>
    </div>
  )
}
