import { emptyDraft,STORAGE_KEY } from './constants'
import type { FormDraft } from './types'

export function loadDraft(): FormDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...emptyDraft }
    const parsed = JSON.parse(raw) as Partial<FormDraft>
    return { ...emptyDraft, ...parsed }
  } catch {
    return { ...emptyDraft }
  }
}

export function saveDraft(draft: FormDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // storage full — silently ignore
  }
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY)
}
