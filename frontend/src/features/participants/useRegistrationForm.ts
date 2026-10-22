import { useCallback, useEffect, useMemo,useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'

import { useAuth } from '@/context/AuthContext'
import { useWallet } from '@/context/WalletContext'
import { useRegisterParticipant } from '@/hooks/useRegisterParticipant'
import { roleLabel } from '@/lib/helpers'

import { ACCEPTED_DOC_TYPES, ACCEPTED_SELFIE_TYPES, MAX_FILE_SIZE, TOTAL_STEPS } from './constants'
import { formatFileSize } from './format'
import { validateParticipantStep } from './schemas'
import { clearDraft,loadDraft, saveDraft } from './storage'
import type { FormDraft, ValidationErrors } from './types'

/**
 * State and behaviour for the multi-step participant registration wizard:
 * the persisted draft, per-step navigation and validation, geolocation,
 * file dropzones and submission. The page renders this and nothing else.
 */
export function useRegistrationForm() {
  const { address, isConnected, connect, isLoading: walletLoading, error: walletError } = useWallet()
  const { login } = useAuth()
  const registerMutation = useRegisterParticipant()

  // ---- Form state (persisted to localStorage) ----
  const [draft, setDraft] = useState<FormDraft>(loadDraft)
  const [step, setStep] = useState(1)
  const [identityFile, setIdentityFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [isSuccess, setIsSuccess] = useState(false)

  const stepContainerRef = useRef<HTMLDivElement>(null)

  // Persist draft on change
  useEffect(() => {
    saveDraft(draft)
  }, [draft])

  // Focus management on step change
  useEffect(() => {
    stepContainerRef.current?.focus()
  }, [step])

  // ---- Draft updater ----
  const updateDraft = useCallback(<K extends keyof FormDraft>(key: K, value: FormDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // ---- Geolocation ----
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((prev) => ({
          ...prev,
          latitude: String(Math.round(pos.coords.latitude * 1e6)),
          longitude: String(Math.round(pos.coords.longitude * 1e6)),
        }))
        setGeoLoading(false)
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access denied. Please enter coordinates manually.'
            : 'Unable to retrieve location. Please enter coordinates manually.'
        )
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Auto-request geolocation when reaching step 4
  useEffect(() => {
    if (step === 4 && !draft.latitude && !draft.longitude) {
      requestGeolocation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ---- File dropzones ----
  const onDocDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      if (file.size > MAX_FILE_SIZE) {
        setValidationErrors((prev) => ({
          ...prev,
          identityDoc: `File exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.`,
        }))
        return
      }
      setIdentityFile(file)
      updateDraft('identityDoc', { name: file.name, size: file.size, type: file.type })
    },
    [updateDraft]
  )

  const docDropzone = useDropzone({
    onDrop: onDocDrop,
    accept: ACCEPTED_DOC_TYPES,
    maxFiles: 1,
    multiple: false,
  })

  const onSelfieDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      if (file.size > MAX_FILE_SIZE) {
        setValidationErrors((prev) => ({
          ...prev,
          selfiePhoto: `File exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.`,
        }))
        return
      }
      setSelfieFile(file)
      updateDraft('selfiePhoto', { name: file.name, size: file.size, type: file.type })
    },
    [updateDraft]
  )

  const selfieDropzone = useDropzone({
    onDrop: onSelfieDrop,
    accept: ACCEPTED_SELFIE_TYPES,
    maxFiles: 1,
    multiple: false,
  })

  const removeIdentityDoc = useCallback(() => {
    setIdentityFile(null)
    updateDraft('identityDoc', null)
  }, [updateDraft])

  const removeSelfie = useCallback(() => {
    setSelfieFile(null)
    updateDraft('selfiePhoto', null)
  }, [updateDraft])

  // ---- Navigation ----
  const goNext = useCallback(() => {
    const errors = validateParticipantStep(step, draft)
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }, [step, draft])

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1))
    setValidationErrors({})
  }, [])

  // ---- Submit ----
  const handleSubmit = useCallback(() => {
    const errors = validateParticipantStep(4, draft)
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!address || !draft.role || !draft.displayName.trim()) return

    const lat = parseInt(draft.latitude, 10) || 0
    const lon = parseInt(draft.longitude, 10) || 0

    registerMutation.mutate(
      {
        address,
        role: draft.role,
        name: draft.displayName.trim(),
        lat,
        lon,
      },
      {
        onSuccess: (participant) => {
          clearDraft()
          login({ address, role: participant.role, name: participant.name })
          setIsSuccess(true)
        },
      }
    )
  }, [address, draft, login, registerMutation])

  // ---- Summary data for step 4 ----
  const summaryItems = useMemo(
    () => [
      { label: 'Role', value: draft.role ? roleLabel(draft.role) : '-' },
      { label: 'Display Name', value: draft.displayName || '-' },
      { label: 'Email', value: draft.email || 'Not provided' },
      { label: 'Phone', value: draft.phone || 'Not provided' },
      { label: 'Bio', value: draft.bio || 'Not provided' },
      { label: 'ID Document', value: draft.identityDoc?.name || '-' },
      { label: 'Selfie', value: draft.selfiePhoto?.name || 'Not provided' },
    ],
    [draft]
  )

  return {
    // wallet
    address,
    isConnected,
    connect,
    walletLoading,
    walletError,
    // draft + field updates
    draft,
    updateDraft,
    validationErrors,
    // wizard
    step,
    stepContainerRef,
    goNext,
    goBack,
    isSuccess,
    // submission
    registerMutation,
    handleSubmit,
    summaryItems,
    // KYC files
    identityFile,
    selfieFile,
    docDropzone,
    selfieDropzone,
    removeIdentityDoc,
    removeSelfie,
    // geolocation
    geoLoading,
    geoError,
    requestGeolocation,
  }
}

export type RegistrationForm = ReturnType<typeof useRegistrationForm>
