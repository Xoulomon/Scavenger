import type { ParticipantStats } from '../api/types'

// ─── localStorage keys ────────────────────────────────────────────────────────

export const PROFILE_NAME_KEY = (address: string) => `scavngr_profile_${address}`
export const PROFILE_IMAGE_KEY = (address: string) => `scavngr_profile_image_${address}`

// ─── Profile image validation ─────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']
const MAX_FILE_SIZE = 2_097_152 // 2 MB

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export function validateProfileImage(file: { type: string; size: number }): FileValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG and PNG images are allowed.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Image must be 2 MB or smaller.' }
  }
  return { valid: true }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function getStoredProfileName(address: string): string | null {
  return localStorage.getItem(PROFILE_NAME_KEY(address))
}

export function setStoredProfileName(address: string, name: string): void {
  localStorage.setItem(PROFILE_NAME_KEY(address), name)
}

export function getStoredProfileImage(address: string): string | null {
  return localStorage.getItem(PROFILE_IMAGE_KEY(address))
}

export function setStoredProfileImage(address: string, dataUrl: string): void {
  localStorage.setItem(PROFILE_IMAGE_KEY(address), dataUrl)
}

export interface Milestone {
  id: string
  label: string
  description: string
  reached: boolean
}

export function computeReputationScore(stats: ParticipantStats): number {
  return Math.floor(Number(stats.total_earned) / 100 + stats.materials_submitted * 10)
}

export function computeMilestones(stats: ParticipantStats): Milestone[] {
  return [
    {
      id: 'first_submission',
      label: 'First Submission',
      description: 'Submit your first waste item',
      reached: stats.materials_submitted >= 1
    },
    {
      id: 'ten_transfers',
      label: '10 Transfers',
      description: 'Complete 10 waste transfers',
      reached: stats.transfers_count >= 10
    },
    {
      id: 'hundred_tokens',
      label: '100 Tokens',
      description: 'Earn 100 tokens',
      reached: Number(stats.total_earned) >= 100
    },
    {
      id: 'fifty_materials',
      label: '50 Submissions',
      description: 'Submit 50 waste items',
      reached: stats.materials_submitted >= 50
    }
  ]
}

export function generateAvatarUrl(address: string): string {
  const hue = parseInt(address.slice(2, 6), 16) % 360
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${address}&backgroundColor=${hue}`
}
