import {
  Contract,
  rpc as SorobanRpc,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
  TransactionBuilder,
  BASE_FEE
} from '@stellar/stellar-sdk'
import {
  Role,
  WasteType,
  Participant,
  Incentive,
  Material,
  Waste,
  WasteTransfer,
  ParticipantStats,
  GlobalMetrics,
  SupplyChainStats,
  ClientOptions,
  MaterialBatchItem
} from './types'
import { ContractError, TransactionError, TimeoutError } from './errors'
import { SigningStrategy } from './signing'

function defaultPollTimeoutMs(): number {
  return 30000
}

function defaultPollIntervalMs(): number {
  return 1500
}

/**
 * Main client for interacting with the Scavngr Soroban smart contract.
 *
 * Provides typed wrappers for all contract functions, handling
 * transaction building, simulation, signing, submission, and polling.
 *
 * @example
 * ```ts
 * const client = new ScavengerClient({
 *   rpcUrl: 'https://soroban-testnet.stellar.org',
 *   networkPassphrase: 'Test SDF Network ; September 2025',
 *   contractId: 'CC...',
 * })
 *
 * const metrics = await client.getMetrics()
 * console.log(metrics.total_wastes_count)
 * ```
 */
export class ScavengerClient {
  private contract: Contract
  private server: SorobanRpc.Server
  private networkPassphrase: string
  private pollTimeoutMs: number
  private pollIntervalMs: number
  private signingStrategy: SigningStrategy | null = null

  /**
   * Create a new ScavengerClient.
   *
   * @param options - Connection and configuration options.
   */
  constructor(options: ClientOptions) {
    this.contract = new Contract(options.contractId)
    this.server = new SorobanRpc.Server(options.rpcUrl, { allowHttp: true })
    this.networkPassphrase = options.networkPassphrase
    this.pollTimeoutMs = options.pollTimeoutMs ?? defaultPollTimeoutMs()
    this.pollIntervalMs = options.pollIntervalMs ?? defaultPollIntervalMs()
  }

  /**
   * Set a signing strategy for transaction submission.
   *
   * @param strategy - The signing strategy to use (e.g., FreighterSigningStrategy).
   *
   * @example
   * ```ts
   * client.setSigningStrategy(new FreighterSigningStrategy())
   * ```
   */
  setSigningStrategy(strategy: SigningStrategy): void {
    this.signingStrategy = strategy
  }

  /**
   * Get the current signing strategy.
   */
  getSigningStrategy(): SigningStrategy | null {
    return this.signingStrategy
  }

  /**
   * Build, simulate, sign (via the configured signing strategy), and submit a Soroban transaction.
   * For read-only calls (no signer), simulation result is returned directly.
   *
   * @typeParam T - The expected return type.
   * @param method - Contract method name.
   * @param args - Array of ScVal arguments.
   * @param signer - Optional signer address. If omitted, performs a read-only simulation.
   * @returns The decoded return value of type T.
   */
  private async invoke<T>(method: string, args: xdr.ScVal[], signer?: string): Promise<T> {
    const operation = this.contract.call(method, ...args)

    if (!signer) {
      const sim = await this.server.simulateTransaction(
        new TransactionBuilder(
          await this.server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
          { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
        )
          .addOperation(operation)
          .setTimeout(30)
          .build()
      )
      return this._extractSimResult<T>(sim)
    }

    const account = await this.server.getAccount(signer)
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase
    })
      .addOperation(operation)
      .setTimeout(30)
      .build()

    const sim = await this.server.simulateTransaction(tx)
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw this._parseError(sim.error)
    }

    const assembled = SorobanRpc.assembleTransaction(tx, sim).build()

    let signedTxXdr: string
    if (this.signingStrategy) {
      signedTxXdr = await this.signingStrategy.sign(assembled.toXDR(), this.networkPassphrase)
    } else {
      throw new Error(
        'No signing strategy configured. Call setSigningStrategy() or pass a signer address.'
      )
    }

    const signed = TransactionBuilder.fromXDR(signedTxXdr, this.networkPassphrase)
    const sendResult = await this.server.sendTransaction(signed)

    if (sendResult.status === 'ERROR') {
      throw new TransactionError(
        'Transaction submission failed',
        sendResult.hash,
        sendResult.errorResult?.toXDR('base64')
      )
    }

    const hash = sendResult.hash
    const deadline = Date.now() + this.pollTimeoutMs
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, this.pollIntervalMs))
      const status = await this.server.getTransaction(hash)
      if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        const retval = (status as SorobanRpc.Api.GetSuccessfulTransactionResponse).returnValue
        if (!retval) return undefined as T
        return scValToNative(retval) as T
      }
      if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new TransactionError('Transaction failed on-chain', hash)
      }
    }
    throw new TimeoutError(`Transaction confirmation timeout after ${this.pollTimeoutMs}ms`)
  }

  /**
   * Extract result from a simulation response.
   */
  private _extractSimResult<T>(sim: SorobanRpc.Api.SimulateTransactionResponse): T {
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw this._parseError(sim.error)
    }
    const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result
    if (!result?.retval) return undefined as T
    return scValToNative(result.retval) as T
  }

  /**
   * Parse a Soroban error string into a ContractError.
   */
  private _parseError(raw: string): ContractError {
    const match = raw.match(/Error\(Contract, #(\d+)\)/)
    if (match) return new ContractError(`Contract error #${match[1]}`, Number(match[1]))
    return new ContractError(raw)
  }

  // =======================================================
  // Admin
  // =======================================================

  /**
   * Initialize the contract admin.
   * @param admin - Admin Stellar address.
   */
  async initializeAdmin(admin: string): Promise<void> {
    return this.invoke<void>('initialize_admin', [new Address(admin).toScVal()], admin)
  }

  /**
   * Get the current admin address.
   * @returns Admin address string.
   */
  async getAdmin(): Promise<string> {
    return this.invoke<string>('get_admin', [])
  }

  /**
   * Transfer admin role to a new address.
   * @param currentAdmin - Current admin address (signer).
   * @param newAdmin - New admin address.
   */
  async transferAdmin(currentAdmin: string, newAdmin: string): Promise<void> {
    return this.invoke<void>(
      'transfer_admin',
      [new Address(currentAdmin).toScVal(), new Address(newAdmin).toScVal()],
      currentAdmin
    )
  }

  /**
   * Set the charity contract address.
   * @param admin - Admin address (signer).
   * @param charityAddress - Charity contract address.
   */
  async setCharityContract(admin: string, charityAddress: string): Promise<void> {
    return this.invoke<void>(
      'set_charity_contract',
      [new Address(admin).toScVal(), new Address(charityAddress).toScVal()],
      admin
    )
  }

  /**
   * Set the token contract address.
   * @param admin - Admin address (signer).
   * @param tokenAddress - Token contract address.
   */
  async setTokenAddress(admin: string, tokenAddress: string): Promise<void> {
    return this.invoke<void>(
      'set_token_address',
      [new Address(admin).toScVal(), new Address(tokenAddress).toScVal()],
      admin
    )
  }

  /**
   * Set reward split percentages.
   * @param admin - Admin address (signer).
   * @param collectorPct - Percentage for collectors (0-100).
   * @param ownerPct - Percentage for owners (0-100).
   */
  async setPercentages(admin: string, collectorPct: number, ownerPct: number): Promise<void> {
    return this.invoke<void>(
      'set_percentages',
      [
        new Address(admin).toScVal(),
        nativeToScVal(collectorPct, { type: 'u32' }),
        nativeToScVal(ownerPct, { type: 'u32' })
      ],
      admin
    )
  }

  // =======================================================
  // Participants
  // =======================================================

  /**
   * Register a new participant.
   * @param address - Participant's Stellar address.
   * @param role - Participant role.
   * @param name - Display name.
   * @param lat - Latitude coordinate.
   * @param lon - Longitude coordinate.
   * @param signer - Signer address.
   * @returns The registered participant.
   */
  async registerParticipant(
    address: string,
    role: Role,
    name: string,
    lat: number,
    lon: number,
    signer: string
  ): Promise<Participant> {
    return this.invoke<Participant>(
      'register_participant',
      [
        new Address(address).toScVal(),
        nativeToScVal(role),
        nativeToScVal(name, { type: 'string' }),
        nativeToScVal(lat, { type: 'i128' }),
        nativeToScVal(lon, { type: 'i128' })
      ],
      signer
    )
  }

  /**
   * Get participant details by address.
   * @param address - Participant's Stellar address.
   * @returns Participant or null if not found.
   */
  async getParticipant(address: string): Promise<Participant | null> {
    return this.invoke<Participant | null>('get_participant', [new Address(address).toScVal()])
  }

  /**
   * Get participant info with stats.
   * @param address - Participant's Stellar address.
   * @returns Participant with stats or null.
   */
  async getParticipantInfo(
    address: string
  ): Promise<{ participant: Participant; stats: ParticipantStats } | null> {
    return this.invoke<{
      participant: Participant
      stats: ParticipantStats
    } | null>('get_participant_info', [new Address(address).toScVal()])
  }

  /**
   * Update a participant's role.
   * @param address - Participant address.
   * @param newRole - New role.
   * @param signer - Signer address.
   */
  async updateRole(address: string, newRole: Role, signer: string): Promise<void> {
    return this.invoke<void>(
      'update_role',
      [new Address(address).toScVal(), nativeToScVal(newRole)],
      signer
    )
  }

  /**
   * Deregister a participant.
   * @param address - Participant address.
   * @param signer - Signer address.
   */
  async deregisterParticipant(address: string, signer: string): Promise<void> {
    return this.invoke<void>('deregister_participant', [new Address(address).toScVal()], signer)
  }

  /**
   * Check if a participant is registered.
   * @param address - Stellar address to check.
   * @returns `true` if registered.
   */
  async isParticipantRegistered(address: string): Promise<boolean> {
    return this.invoke<boolean>('is_participant_registered', [new Address(address).toScVal()])
  }

  // =======================================================
  // Waste / Materials
  // =======================================================

  /**
   * Submit a new material (waste item).
   * @param submitter - Submitter address.
   * @param wasteType - Type of waste.
   * @param weight - Weight in grams.
   * @param lat - Latitude coordinate.
   * @param lon - Longitude coordinate.
   * @param signer - Signer address.
   * @returns The created material.
   */
  async submitMaterial(
    submitter: string,
    wasteType: WasteType,
    weight: bigint,
    lat: bigint,
    lon: bigint,
    signer: string
  ): Promise<Material> {
    return this.invoke<Material>(
      'submit_material',
      [
        new Address(submitter).toScVal(),
        nativeToScVal(wasteType, { type: 'u32' }),
        nativeToScVal(weight, { type: 'u128' }),
        nativeToScVal(lat, { type: 'i128' }),
        nativeToScVal(lon, { type: 'i128' })
      ],
      signer
    )
  }

  /**
   * Submit multiple materials in a single transaction.
   * @param submitter - Submitter address.
   * @param materials - Array of material items to submit.
   * @param signer - Signer address.
   * @returns Array of created materials.
   */
  async submitMaterialsBatch(
    submitter: string,
    materials: MaterialBatchItem[],
    signer: string
  ): Promise<Material[]> {
    const vec = nativeToScVal(
      materials.map((m) => ({
        waste_type: nativeToScVal(m.wasteType, { type: 'u32' }),
        weight: nativeToScVal(m.weight, { type: 'u128' })
      }))
    )
    return this.invoke<Material[]>(
      'submit_materials_batch',
      [new Address(submitter).toScVal(), vec],
      signer
    )
  }

  /**
   * Verify a material's authenticity.
   * @param materialId - Material ID to verify.
   * @param verifier - Verifier address.
   * @param signer - Signer address.
   */
  async verifyMaterial(materialId: bigint, verifier: string, signer: string): Promise<void> {
    return this.invoke<void>(
      'verify_material',
      [nativeToScVal(materialId, { type: 'u64' }), new Address(verifier).toScVal()],
      signer
    )
  }

  /**
   * Transfer waste to another participant.
   * @param wasteId - Waste ID.
   * @param from - Current owner address.
   * @param to - Recipient address.
   * @param lat - Latitude coordinate.
   * @param lon - Longitude coordinate.
   * @param note - Transfer note.
   * @param signer - Signer address.
   */
  async transferWaste(
    wasteId: bigint,
    from: string,
    to: string,
    lat: bigint,
    lon: bigint,
    note: string,
    signer: string
  ): Promise<void> {
    return this.invoke<void>(
      'transfer_waste',
      [
        nativeToScVal(wasteId, { type: 'u128' }),
        new Address(from).toScVal(),
        new Address(to).toScVal(),
        nativeToScVal(lat, { type: 'i128' }),
        nativeToScVal(lon, { type: 'i128' }),
        nativeToScVal(note, { type: 'string' })
      ],
      signer
    )
  }

  /**
   * Confirm waste details.
   * @param wasteId - Waste ID.
   * @param confirmer - Confirmer address.
   * @param signer - Signer address.
   */
  async confirmWasteDetails(wasteId: bigint, confirmer: string, signer: string): Promise<void> {
    return this.invoke<void>(
      'confirm_waste_details',
      [nativeToScVal(wasteId, { type: 'u128' }), new Address(confirmer).toScVal()],
      signer
    )
  }

  /**
   * Reset waste confirmation status.
   * @param wasteId - Waste ID.
   * @param owner - Owner address.
   * @param signer - Signer address.
   */
  async resetWasteConfirmation(wasteId: bigint, owner: string, signer: string): Promise<void> {
    return this.invoke<void>(
      'reset_waste_confirmation',
      [nativeToScVal(wasteId, { type: 'u128' }), new Address(owner).toScVal()],
      signer
    )
  }

  /**
   * Deactivate a waste item (admin only).
   * @param admin - Admin address (signer).
   * @param wasteId - Waste ID.
   * @param signer - Signer address.
   */
  async deactivateWaste(admin: string, wasteId: bigint, signer: string): Promise<void> {
    return this.invoke<void>(
      'deactivate_waste',
      [new Address(admin).toScVal(), nativeToScVal(wasteId, { type: 'u128' })],
      signer
    )
  }

  /**
   * Get waste details by ID.
   * @param wasteId - Waste ID.
   * @returns Waste or null if not found.
   */
  async getWaste(wasteId: bigint): Promise<Waste | null> {
    return this.invoke<Waste | null>('get_waste', [nativeToScVal(wasteId, { type: 'u128' })])
  }

  /**
   * Get material details by ID.
   * @param materialId - Material ID.
   * @returns Material or null if not found.
   */
  async getMaterial(materialId: bigint): Promise<Material | null> {
    return this.invoke<Material | null>('get_material', [
      nativeToScVal(materialId, { type: 'u64' })
    ])
  }

  /**
   * Get all waste IDs for a participant.
   * @param address - Participant address.
   * @returns Array of waste IDs.
   */
  async getParticipantWastes(address: string): Promise<bigint[]> {
    return this.invoke<bigint[]>('get_participant_wastes', [new Address(address).toScVal()])
  }

  /**
   * Get transfer history for a waste item.
   * @param wasteId - Waste ID.
   * @returns Array of waste transfers.
   */
  async getWasteTransferHistory(wasteId: bigint): Promise<WasteTransfer[]> {
    return this.invoke<WasteTransfer[]>('get_waste_transfer_history', [
      nativeToScVal(wasteId, { type: 'u128' })
    ])
  }

  // =======================================================
  // Incentives
  // =======================================================

  /**
   * Create a new incentive (reward program).
   * @param rewarder - Rewarder address (signer).
   * @param wasteType - Target waste type.
   * @param rewardPoints - Points per unit.
   * @param budget - Total budget.
   * @param signer - Signer address.
   * @returns The created incentive.
   */
  async createIncentive(
    rewarder: string,
    wasteType: WasteType,
    rewardPoints: bigint,
    budget: bigint,
    signer: string
  ): Promise<Incentive> {
    return this.invoke<Incentive>(
      'create_incentive',
      [
        new Address(rewarder).toScVal(),
        nativeToScVal(wasteType, { type: 'u32' }),
        nativeToScVal(rewardPoints, { type: 'u64' }),
        nativeToScVal(budget, { type: 'u64' })
      ],
      signer
    )
  }

  /**
   * Update an existing incentive.
   * @param incentiveId - Incentive ID.
   * @param rewarder - Rewarder address (signer).
   * @param rewardPoints - Updated points.
   * @param budget - Updated budget.
   * @param signer - Signer address.
   * @returns The updated incentive.
   */
  async updateIncentive(
    incentiveId: bigint,
    rewarder: string,
    rewardPoints: bigint,
    budget: bigint,
    signer: string
  ): Promise<Incentive> {
    return this.invoke<Incentive>(
      'update_incentive',
      [
        nativeToScVal(incentiveId, { type: 'u64' }),
        new Address(rewarder).toScVal(),
        nativeToScVal(rewardPoints, { type: 'u64' }),
        nativeToScVal(budget, { type: 'u64' })
      ],
      signer
    )
  }

  /**
   * Deactivate an incentive.
   * @param incentiveId - Incentive ID.
   * @param rewarder - Rewarder address (signer).
   * @param signer - Signer address.
   */
  async deactivateIncentive(incentiveId: bigint, rewarder: string, signer: string): Promise<void> {
    return this.invoke<void>(
      'deactivate_incentive',
      [nativeToScVal(incentiveId, { type: 'u64' }), new Address(rewarder).toScVal()],
      signer
    )
  }

  /**
   * Get incentive by ID.
   * @param incentiveId - Incentive ID.
   * @returns Incentive or null.
   */
  async getIncentiveById(incentiveId: bigint): Promise<Incentive | null> {
    return this.invoke<Incentive | null>('get_incentive_by_id', [
      nativeToScVal(incentiveId, { type: 'u64' })
    ])
  }

  /**
   * Get incentives for a specific waste type.
   * @param wasteType - Waste type filter.
   * @returns Array of incentives.
   */
  async getIncentives(wasteType: WasteType): Promise<Incentive[]> {
    return this.invoke<Incentive[]>('get_incentives', [nativeToScVal(wasteType, { type: 'u32' })])
  }

  /**
   * Get all active incentives.
   * @returns Array of active incentives.
   */
  async getActiveIncentives(): Promise<Incentive[]> {
    return this.invoke<Incentive[]>('get_active_incentives', [])
  }

  /**
   * Get active incentive for a specific manufacturer and waste type.
   * @param manufacturer - Manufacturer address.
   * @param wasteType - Waste type.
   * @returns Incentive or null.
   */
  async getActiveMfrIncentive(
    manufacturer: string,
    wasteType: WasteType
  ): Promise<Incentive | null> {
    return this.invoke<Incentive | null>('get_active_mfr_incentive', [
      new Address(manufacturer).toScVal(),
      nativeToScVal(wasteType, { type: 'u32' })
    ])
  }

  /**
   * Donate tokens to charity.
   * @param donor - Donor address (signer).
   * @param amount - Amount to donate.
   * @param signer - Signer address.
   */
  async donateToCharity(donor: string, amount: bigint, signer: string): Promise<void> {
    return this.invoke<void>(
      'donate_to_charity',
      [new Address(donor).toScVal(), nativeToScVal(amount, { type: 'i128' })],
      signer
    )
  }

  /**
   * Distribute rewards for a waste item under an incentive.
   * @param wasteId - Waste ID.
   * @param incentiveId - Incentive ID.
   * @param manufacturer - Manufacturer address (signer).
   * @param signer - Signer address.
   * @returns Total reward amount distributed.
   */
  async distributeRewards(
    wasteId: bigint,
    incentiveId: bigint,
    manufacturer: string,
    signer: string
  ): Promise<bigint> {
    return this.invoke<bigint>(
      'distribute_rewards',
      [
        nativeToScVal(wasteId, { type: 'u128' }),
        nativeToScVal(incentiveId, { type: 'u64' }),
        new Address(manufacturer).toScVal()
      ],
      signer
    )
  }

  // =======================================================
  // Stats & Metrics
  // =======================================================

  /**
   * Get global ecosystem metrics.
   * @returns GlobalMetrics object.
   */
  async getMetrics(): Promise<GlobalMetrics> {
    return this.invoke<GlobalMetrics>('get_metrics', [])
  }

  /**
   * Get statistics for a specific participant.
   * @param participant - Participant address.
   * @returns ParticipantStats object.
   */
  async getStats(participant: string): Promise<ParticipantStats> {
    return this.invoke<ParticipantStats>('get_stats', [new Address(participant).toScVal()])
  }

  /**
   * Get supply chain aggregated statistics.
   * @returns SupplyChainStats object.
   */
  async getSupplyChainStats(): Promise<SupplyChainStats> {
    return this.invoke<SupplyChainStats>('get_supply_chain_stats', [])
  }
}
