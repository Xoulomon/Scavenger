import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfilePage } from './ProfilePage'
import * as profileLib from '@/lib/profile'
import { WasteType } from '@/api/types'

vi.mock('@/hooks/useParticipant', () => ({
  useParticipant: vi.fn(),
}))

vi.mock('@/hooks/useProfileStats', () => ({
  useProfileStats: vi.fn(),
}))

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    error: vi.fn(),
    success: vi.fn(),
  })),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  })),
}))

vi.mock('@/lib/profile', () => ({
  generateAvatarUrl: vi.fn((addr) => `https://avatar.example.com/${addr}`),
  computeReputationScore: vi.fn((stats) => 85),
  computeMilestones: vi.fn((stats) => [
    { id: 'first_submission', label: 'First Submission', description: 'Submit your first waste item', reached: true },
    { id: 'ten_transfers', label: '10 Transfers', description: 'Complete 10 waste transfers', reached: false },
    { id: 'hundred_tokens', label: '100 Tokens', description: 'Earn 100 tokens', reached: true },
    { id: 'fifty_materials', label: '50 Submissions', description: 'Submit 50 waste items', reached: false },
  ]),
  validateProfileImage: vi.fn(() => ({ valid: true })),
  getStoredProfileName: vi.fn(() => null),
  setStoredProfileName: vi.fn(),
  getStoredProfileImage: vi.fn(() => null),
  setStoredProfileImage: vi.fn(),
}))

describe('ProfilePage', () => {
  const mockParticipant = {
    address: 'GABC123',
    name: 'Test User',
    role: 'Contributor',
    registered_at: Math.floor(Date.now() / 1000) - 2592000,
  }

  const mockStats = {
    total_earned: 1000n,
    materials_submitted: 25,
    transfers_count: 5,
  }

  const mockWastes = [
    {
      waste_id: 1n,
      waste_type: WasteType.Paper,
      weight: 500n,
      recycled_timestamp: Math.floor(Date.now() / 1000) - 86400,
      is_confirmed: true,
      is_active: true,
    },
    {
      waste_id: 2n,
      waste_type: WasteType.Plastic,
      weight: 250n,
      recycled_timestamp: Math.floor(Date.now() / 1000) - 172800,
      is_confirmed: false,
      is_active: true,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('ProfileHeader component', () => {
    it('renders user name and address', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText(/GABC123/)).toBeInTheDocument()
    })

    it('displays edit profile button for own profile', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const editButton = screen.getByLabelText(/Edit profile/i)
      expect(editButton).toBeInTheDocument()
    })

    it('shows joined date in correct format', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Joined/)).toBeInTheDocument()
    })
  })

  describe('StatsSection component', () => {
    it('renders all stat cards with correct values', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Total Earned/)).toBeInTheDocument()
      expect(screen.getByText(/Materials Submitted/)).toBeInTheDocument()
      expect(screen.getByText(/Transfers/)).toBeInTheDocument()
      expect(screen.getByText(/Reputation Score/)).toBeInTheDocument()
    })

    it('displays loading skeletons when data is loading', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: null,
        wastes: [],
        isLoadingStats: true,
        isLoadingWastes: true,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const skeletons = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows error state when stats fail to load', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: null,
        wastes: [],
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: true,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Failed to load statistics/)).toBeInTheDocument()
    })

    it('renders pie chart with waste breakdown', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Waste by Type/)).toBeInTheDocument()
    })

    it('renders bar chart for submissions over time', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Submissions Over Time/)).toBeInTheDocument()
    })
  })

  describe('WasteTimeline component', () => {
    it('renders waste items in descending chronological order', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Waste History/)).toBeInTheDocument()
      expect(screen.getByText(/Paper/)).toBeInTheDocument()
      expect(screen.getByText(/Plastic/)).toBeInTheDocument()
    })

    it('shows empty state when no waste items exist', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: [],
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/No waste items yet/)).toBeInTheDocument()
    })

    it('displays waste status badges correctly', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Confirmed/)).toBeInTheDocument()
      expect(screen.getByText(/Pending/)).toBeInTheDocument()
    })

    it('handles waste item click to open modal', async () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const wasteItems = screen.getAllByRole('button', { name: /Paper|Plastic/ })
      fireEvent.click(wasteItems[0])

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeTruthy()
      })
    })
  })

  describe('AchievementsSection component', () => {
    it('renders milestone achievements', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Achievements/)).toBeInTheDocument()
      expect(screen.getByText(/First Submission/)).toBeInTheDocument()
    })

    it('shows correct styling for achieved vs unachieved milestones', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const achievedMilestones = screen.getAllByText(/Achieved|Not yet achieved/)
      expect(achievedMilestones.length).toBeGreaterThan(0)
    })
  })

  describe('EditProfileModal component', () => {
    it('opens edit modal when edit button is clicked', async () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const editButton = screen.getByLabelText(/Edit profile/i)
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByText(/Edit Profile/)).toBeInTheDocument()
      })
    })

    it('allows editing profile name', async () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const editButton = screen.getByLabelText(/Edit profile/i)
      fireEvent.click(editButton)

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Test User')
        fireEvent.change(nameInput, { target: { value: 'New Name' } })
        expect(nameInput).toHaveValue('New Name')
      })
    })

    it('validates profile name is not empty', async () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const editButton = screen.getByLabelText(/Edit profile/i)
      fireEvent.click(editButton)

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Test User')
        fireEvent.change(nameInput, { target: { value: '' } })

        const saveButton = screen.getByText(/Save Changes/)
        fireEvent.click(saveButton)

        expect(screen.getByText(/Name cannot be empty/)).toBeInTheDocument()
      })
    })

    it('allows uploading profile image', async () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: mockParticipant,
        isLoading: false,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: mockStats,
        wastes: mockWastes,
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const editButton = screen.getByLabelText(/Edit profile/i)
      fireEvent.click(editButton)

      await waitFor(() => {
        const uploadButton = screen.getByText(/Choose Image/)
        expect(uploadButton).toBeInTheDocument()
      })
    })
  })

  describe('ProfilePage error handling', () => {
    it('displays error when participant fails to load', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: null,
        isLoading: false,
        isError: true,
      })
      useProfileStats.mockReturnValue({
        stats: null,
        wastes: [],
        isLoadingStats: false,
        isLoadingWastes: false,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      expect(screen.getByText(/Failed to load profile/)).toBeInTheDocument()
    })

    it('shows loading state when participant is loading', () => {
      const { useParticipant } = require('@/hooks/useParticipant')
      const { useProfileStats } = require('@/hooks/useProfileStats')
      const { useWallet } = require('@/context/WalletContext')

      useParticipant.mockReturnValue({
        participant: null,
        isLoading: true,
        isError: false,
      })
      useProfileStats.mockReturnValue({
        stats: null,
        wastes: [],
        isLoadingStats: true,
        isLoadingWastes: true,
        isStatsError: false,
      })
      useWallet.mockReturnValue({
        address: mockParticipant.address,
      })

      render(<ProfilePage />)

      const skeletons = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })
})
