import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { getNetworkPassphrase } from '@/lib/stellar'
import { cacheKeys } from '@/lib/cacheKeys'

function useClient() {
  const { config } = useContract()
  return new ScavengerClient({
    contractId: config.contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: getNetworkPassphrase(config.network),
  })
}

export function useActiveIncentives() {
  const client = useClient()
  return useQuery({
    queryKey: cacheKeys.activeIncentives(),
    queryFn: () => client.getActiveIncentives(),
    staleTime: 5 * 60_000,
  })
}
