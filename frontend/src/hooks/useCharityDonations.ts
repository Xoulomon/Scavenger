import { useState, useEffect, useCallback, useRef } from 'react'
import { useDonateToCharity } from '@/hooks/useDonateToCharity'
import {
  CharityStorage,
  CharityDonation,
  REGISTERED_CHARITIES,
  Charity,
  generateDonationReceipt
} from '@/lib/charityStorage'
import { useRewards } from '@/hooks/useRewards'

export interface DonateInput {
  charity: Charity
  tokenAmount: bigint
  wasteItemIds?: number[]
}

export function useCharityDonations(donorAddress: string | null | undefined) {
  const [donations, setDonations] = useState<CharityDonation[]>([])
  const storageRef = useRef<CharityStorage | null>(null)
  const donateToCharity = useDonateToCharity()
  const { stats } = useRewards()
  const balance = stats?.total_earned ?? 0n

  useEffect(() => {
    if (!donorAddress) {
      setDonations([])
      storageRef.current = null
      return
    }
    storageRef.current = new CharityStorage(donorAddress)
    setDonations(storageRef.current.getAll())
  }, [donorAddress])

  const donate = useCallback(
    async (input: DonateInput): Promise<CharityDonation | null> => {
      if (!storageRef.current || !donorAddress) return null
      await donateToCharity.mutateAsync({ amount: input.tokenAmount, balance })
      const entry = storageRef.current.record({
        charityId: input.charity.id,
        charityName: input.charity.name,
        donorAddress,
        wasteItemIds: input.wasteItemIds ?? [],
        tokenAmount: input.tokenAmount
      })
      setDonations(storageRef.current.getAll())
      return entry
    },
    [donorAddress, donateToCharity, balance]
  )

  const downloadReceipt = useCallback(
    (donation: CharityDonation) => {
      if (!donorAddress) return
      generateDonationReceipt(donation, donorAddress)
    },
    [donorAddress]
  )

  const totalDonated = donations.reduce((sum, d) => sum + d.tokenAmount, 0n)

  return {
    charities: REGISTERED_CHARITIES,
    donations,
    totalDonated,
    balance,
    donate,
    downloadReceipt,
    isPending: donateToCharity.isPending,
    error: donateToCharity.error
  }
}
