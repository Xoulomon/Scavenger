import { describe, expect,it } from 'vitest'

import { Role } from '@/api/types'

import { emptyDraft } from './constants'
import { validateParticipantStep } from './schemas'
import type { FormDraft } from './types'

const draft = (overrides: Partial<FormDraft> = {}): FormDraft => ({ ...emptyDraft, ...overrides })

const doc = { name: 'id.pdf', size: 10, type: 'application/pdf' }

describe('validateParticipantStep', () => {
  it('step 1 requires a role', () => {
    expect(validateParticipantStep(1, draft())).toEqual({
      role: 'Please select a role to continue.',
    })
    expect(validateParticipantStep(1, draft({ role: Role.Recycler }))).toEqual({})
  })

  it('step 2 requires a non-blank display name and a well-formed optional email', () => {
    expect(validateParticipantStep(2, draft({ displayName: '   ' }))).toEqual({
      displayName: 'Display name is required.',
    })
    expect(validateParticipantStep(2, draft({ displayName: 'Ada', email: '' }))).toEqual({})
    expect(
      validateParticipantStep(2, draft({ displayName: 'Ada', email: 'not-an-email' }))
    ).toEqual({ email: 'Please enter a valid email address.' })
  })

  it('step 3 requires an identity document', () => {
    expect(validateParticipantStep(3, draft())).toEqual({
      identityDoc: 'Please upload an identity document.',
    })
    expect(validateParticipantStep(3, draft({ identityDoc: doc }))).toEqual({})
  })

  it('step 4 requires coordinates and agreement to the terms', () => {
    expect(validateParticipantStep(4, draft())).toEqual({
      latitude: 'Latitude is required.',
      longitude: 'Longitude is required.',
      agreedToTerms: 'You must agree to the terms and conditions.',
    })
    expect(
      validateParticipantStep(
        4,
        draft({ latitude: '1', longitude: '2', agreedToTerms: true })
      )
    ).toEqual({})
  })

  it('returns no errors for steps without a schema', () => {
    expect(validateParticipantStep(9, draft())).toEqual({})
  })
})
