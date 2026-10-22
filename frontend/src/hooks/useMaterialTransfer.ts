import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ScavengerClient } from '@/api/client'
import type { Waste, WasteTransfer } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { submitWasteTransfer } from '@/features/transfers/service'
import { networkConfig } from '@/lib/stellar'

function useClient() {
  const { config } = useContract()
  return () =>
    new ScavengerClient({
      rpcUrl: config.rpcUrl,
      networkPassphrase: networkConfig.networkPassphrase,
      contractId: config.contractId,
    })
}

export function useParticipantWastes() {
  const { address } = useWallet()
  const makeClient = useClient()

  return useQuery<Waste[]>({
    queryKey: ['participant-wastes', address],
    queryFn: async () => {
      if (!address) return []
      const client = makeClient()
      const ids = await client.getParticipantWastes(address)
      const results = await Promise.all(
        ids.slice(-50).map((id) => client.getWaste(BigInt(id as unknown as number)))
      )
      return results.filter((w): w is Waste => w !== null && w.is_active)
    },
    enabled: !!address,
    staleTime: 30_000,
  })
}

export function useWasteTransferHistory(wasteId: bigint | null) {
  const makeClient = useClient()

  return useQuery<WasteTransfer[]>({
    queryKey: ['waste-transfer-history', wasteId?.toString()],
    queryFn: async () => {
      if (wasteId === null) return []
      return makeClient().getWasteTransferHistory(wasteId)
    },
    enabled: wasteId !== null,
    staleTime: 15_000,
  })
}

export function useTransferWaste() {
  const { address } = useWallet()
  const makeClient = useClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      wasteId,
      to,
      note,
    }: {
      wasteId: bigint
      to: string
      note: string
    }) =>
      submitWasteTransfer(makeClient(), {
        wasteId,
        from: address ?? '',
        to,
        note,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant-wastes'] })
      qc.invalidateQueries({ queryKey: ['waste-transfer-history'] })
    },
  })
}
