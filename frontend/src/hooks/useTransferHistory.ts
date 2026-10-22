import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { WasteTransfer } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { cacheKeys } from '@/lib/cacheKeys'

export function useTransferHistory(wasteId: number | bigint | undefined) {
  const { config } = useContract()

  const { data, isLoading, isError } = useQuery<WasteTransfer[]>({
    queryKey: cacheKeys.transferHistory(wasteId?.toString()),
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getWasteTransferHistory(BigInt(wasteId as number))
    },
    enabled: wasteId !== undefined,
  })

  return {
    history: data ?? [],
    isLoading,
    isError,
  }
}
