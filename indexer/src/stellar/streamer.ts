import { rpc, xdr } from '@stellar/stellar-sdk'
import { RawContractEvent } from '../types'

export interface StreamerConfig {
  rpcUrl: string
  contractId: string
  startLedger: number
}

function decodeScVal(val: xdr.ScVal): unknown {
  try {
    switch (val.switch()) {
      case xdr.ScValType.scvU32():
        return val.u32()
      case xdr.ScValType.scvI32():
        return val.i32()
      case xdr.ScValType.scvU64():
        return val.u64().toString()
      case xdr.ScValType.scvI64():
        return val.i64().toString()
      case xdr.ScValType.scvU128(): {
        const parts = val.u128()
        return (
          BigInt(parts.hi().toString()) * BigInt(2 ** 64) +
          BigInt(parts.lo().toString())
        ).toString()
      }
      case xdr.ScValType.scvI128(): {
        const parts = val.i128()
        return (
          BigInt(parts.hi().toString()) * BigInt(2 ** 64) +
          BigInt(parts.lo().toString())
        ).toString()
      }
      case xdr.ScValType.scvBool():
        return val.b()
      case xdr.ScValType.scvSymbol():
        return val.sym().toString()
      case xdr.ScValType.scvString():
        return val.str().toString()
      case xdr.ScValType.scvAddress():
        return val.address().toString()
      case xdr.ScValType.scvVec():
        return val.vec()?.map(decodeScVal) ?? []
      case xdr.ScValType.scvVoid():
        return null
      default:
        return val.toXDR('base64')
    }
  } catch {
    return null
  }
}

const RPC_TIMEOUT_MS = 10_000
const RPC_ATTEMPTS = 3
const RPC_BASE_DELAY_MS = 500

// One server per URL, so repeated calls reuse the same client (#1707).
const servers = new Map<string, rpc.Server>()

function getServer(rpcUrl: string): rpc.Server {
  let server = servers.get(rpcUrl)
  if (!server) {
    server = new rpc.Server(rpcUrl)
    servers.set(rpcUrl, server)
  }
  return server
}

/**
 * Run an RPC call with a per-attempt timeout and exponential backoff between attempts (#1708).
 */
export async function withTimeoutAndRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < RPC_ATTEMPTS; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('RPC request timed out')), RPC_TIMEOUT_MS)
      })
      return await Promise.race([fn(), timeout])
    } catch (error) {
      lastError = error
      if (attempt < RPC_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, RPC_BASE_DELAY_MS * 2 ** attempt))
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

export async function fetchEvents(
  config: StreamerConfig,
  fromLedger: number,
  _toLedger: number
): Promise<RawContractEvent[]> {
  const server = getServer(config.rpcUrl)
  const events: RawContractEvent[] = []

  const response = await withTimeoutAndRetry(() =>
    server.getEvents({
      startLedger: fromLedger,
      filters: [{ type: 'contract', contractIds: [config.contractId] }]
    })
  )

  for (const event of response.events) {
    // In SDK v13, topic is xdr.ScVal[] and value is xdr.ScVal (already parsed)
    const topic = (event.topic as xdr.ScVal[]).map((t: xdr.ScVal) => String(decodeScVal(t) ?? ''))
    const eventType = topic[0] ?? 'unknown'
    const value = decodeScVal(event.value as xdr.ScVal)

    events.push({
      ledgerSequence: event.ledger,
      ledgerCloseTime: new Date(event.ledgerClosedAt),
      transactionHash: event.txHash,
      contractId: config.contractId,
      eventType,
      topic,
      value
    })
  }

  return events
}

export async function getLatestLedger(rpcUrl: string): Promise<number> {
  const server = getServer(rpcUrl)
  const info = await withTimeoutAndRetry(() => server.getLatestLedger())
  return info.sequence
}
