import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Role } from '@/api/types'
import { useAppTitle } from '@hooks/useAppTitle'

const ROLE_ROUTES: Record<string, string> = {
  [Role.Recycler]: '/dashboard/recycler',
  [Role.Collector]: '/collect',
  [Role.Manufacturer]: '/manufacturer'
}

export function HomePage() {
  const { t } = useTranslation()
  useAppTitle(t('home.appTitle'))
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const route = user?.role ? ROLE_ROUTES[user.role] : null
    if (route) navigate(route, { replace: true })
  }, [user, navigate])

  return null
}
