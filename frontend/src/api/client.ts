import {
  Contract,
  rpc as SorobanRpc,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
  TransactionBuilder,
  BASE_FEE,
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
  ContractError,
} from './types'
import { signTransactionXDR } from '@/lib/wallet'

export interface ClientOptions {
  rpcUrl: string
  networkPassphrase: string
  contractId: string
}

export class ScavengerClient {
  private contract: Contract
  private server: SorobanRpc.Server
  private networkPassphrase: string

  constructor(options: ClientOptions) {
    this.contract = new Contract(options.contractId)
    this.server = new SorobanRpc.Server(options.rpcUrl, { allowHttp: true })
    this.networkPassphrase = options.networkPassphrase
  }

  /**
   * Build, simulate, sign (via Freighter), and submit a Soroban transaction.
   * For read-only calls (no signer), simulation result is returned directly.
   */
  private async invoke<T>(
    method: string,
    args: xdr.ScVal[],
    signer?: string
  ): Promise<T> {
    const operation = this.contract.call(method, ...args)

    if (!signer) {
      // Read-only: simulate only
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

    // Mutating: build → simulate → assemble → sign → submit
    const account = await this.server.getAccount(signer)
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build()

    const sim = await this.server.simulateTransaction(tx)
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw this._parseError(sim.error)
    }

    const assembled = SorobanRpc.assembleTransaction(tx, sim).build()

    const signedTxXdr = await signTransactionXDR(assembled.toXDR(), this.networkPassphrase)
    const signed = TransactionBuilder.fromXDR(signedTxXdr, this.networkPassphrase)
    const sendResult = await this.server.sendTransaction(signed)

    if (sendResult.status === 'ERROR') {
      throw this._parseError(sendResult.errorResult?.toXDR('base64') ?? 'Transaction failed')
    }

    // Poll for confirmation
    const hash = sendResult.hash
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      const status = await this.server.getTransaction(hash)
      if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        const retval = (status as SorobanRpc.Api.GetSuccessfulTransactionResponse).returnValue
        if (!retval) return undefined as T
        return scValToNative(retval) as T
      }
      if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new ContractError('Transaction failed on-chain')
      }
    }
    throw new ContractError('Transaction confirmation timeout')
  }

  private _extractSimResult<T>(sim: SorobanRpc.Api.SimulateTransactionResponse): T {
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw this._parseError(sim.error)
    }
    const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result
    if (!result?.retval) return undefined as T
    return scValToNative(result.retval) as T
  }

  private _parseError(raw: string): ContractError {
    // Try to extract numeric error code from XDR or message
    const match = raw.match(/Error\(Contract, #(\d+)\)/)
    if (match) return new ContractError(`Contract error #${match[1]}`, Number(match[1]))
    return new ContractError(raw)
  }

  // =======================================================
  // Admin
  // =======================================================

  async initializeAdmin(admin: string) {
    return this.invoke<void>('initialize_admin', [new Address(admin).toScVal()], admin)
  }

  async getAdmin(): Promise<string> {
    return this.invoke<string>('get_admin', [])
  }

  async transferAdmin(currentAdmin: string, newAdmin: string) {
    return this.invoke<void>(
      'transfer_admin',
      [new Address(currentAdmin).toScVal(), new Address(newAdmin).toScVal()],
      currentAdmin
    )
  }

  async setCharityContract(admin: string, charityAddress: string) {
    return this.invoke<void>(
      'set_charity_contract',
      [new Address(admin).toScVal(), new Address(charityAddress).toScVal()],
      admin
    )
  }

  async setTokenAddress(admin: string, tokenAddress: string) {
    return this.invoke<void>(
      'set_token_address',
      [new Address(admin).toScVal(), new Address(tokenAddress).toScVal()],
      admin
    )
  }

  async setPercentages(admin: string, collectorPct: number, ownerPct: number) {
    return this.invoke<void>(
      'set_percentages',
      [
        new Address(admin).toScVal(),
        nativeToScVal(collectorPct, { type: 'u32' }),
        nativeToScVal(ownerPct, { type: 'u32' }),
      ],
      admin
    )
  }

  // =======================================================
  // Participants
  // =======================================================

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
        nativeToScVal(lon, { type: 'i128' }),
      ],
      signer
    )
  }

  async getParticipant(address: string): Promise<Participant | null> {
    return this.invoke<Participant | null>('get_participant', [new Address(address).toScVal()])
  }

  async getParticipantInfo(address: string): Promise<{ participant: Participant; stats: ParticipantStats } | null> {
    return this.invoke<{ participant: Participant; stats: ParticipantStats } | null>(
      'get_participant_info',
      [new Address(address).toScVal()]
    )
  }

  async updateRole(address: string, newRole: Role, signer: string) {
    return this.invoke<void>(
      'update_role',
      [new Address(address).toScVal(), nativeToScVal(newRole)],
      signer
    )
  }

  async deregisterParticipant(address: string, signer: string) {
    return this.invoke<void>(
      'deregister_participant',
      [new Address(address).toScVal()],
      signer
    )
  }

  async isParticipantRegistered(address: string): Promise<boolean> {
    return this.invoke<boolean>('is_participant_registered', [new Address(address).toScVal()])
  }

  // =======================================================
  // Waste / Materials
  // =======================================================

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
        nativeToScVal(lon, { type: 'i128' }),
      ],
      signer
    )
  }

  async submitMaterialsBatch(
    submitter: string,
    materials: { wasteType: WasteType; weight: bigint }[],
    signer: string
  ): Promise<Material[]> {
    const vec = nativeToScVal(
      materials.map((m) => ({
        waste_type: nativeToScVal(m.wasteType, { type: 'u32' }),
        weight: nativeToScVal(m.weight, { type: 'u128' }),
      }))
    )
    return this.invoke<Material[]>(
      'submit_materials_batch',
      [new Address(submitter).toScVal(), vec],
      signer
    )
  }

  async verifyMaterial(materialId: bigint, verifier: string, signer: string) {
    return this.invoke<void>(
      'verify_material',
      [nativeToScVal(materialId, { type: 'u64' }), new Address(verifier).toScVal()],
      signer
    )
  }

  async transferWaste(
    wasteId: bigint,
    from: string,
    to: string,
    lat: bigint,
    lon: bigint,
    note: string,
    signer: string
  ) {
    return this.invoke<void>(
      'transfer_waste',
      [
        nativeToScVal(wasteId, { type: 'u128' }),
        new Address(from).toScVal(),
        new Address(to).toScVal(),
        nativeToScVal(lat, { type: 'i128' }),
        nativeToScVal(lon, { type: 'i128' }),
        nativeToScVal(note, { type: 'string' }),
      ],
      signer
    )
  }

  async confirmWasteDetails(wasteId: bigint, confirmer: string, signer: string) {
    return this.invoke<void>(
      'confirm_waste_details',
      [nativeToScVal(wasteId, { type: 'u128' }), new Address(confirmer).toScVal()],
      signer
    )
  }

  async resetWasteConfirmation(wasteId: bigint, owner: string, signer: string) {
    return this.invoke<void>(
      'reset_waste_confirmation',
      [nativeToScVal(wasteId, { type: 'u128' }), new Address(owner).toScVal()],
      signer
    )
  }

  async deactivateWaste(admin: string, wasteId: bigint, signer: string) {
    return this.invoke<void>(
      'deactivate_waste',
      [new Address(admin).toScVal(), nativeToScVal(wasteId, { type: 'u128' })],
      signer
    )
  }

  async getWaste(wasteId: bigint): Promise<Waste | null> {
    return this.invoke<Waste | null>('get_waste', [nativeToScVal(wasteId, { type: 'u128' })])
  }

  async getMaterial(materialId: bigint): Promise<Material | null> {
    return this.invoke<Material | null>('get_material', [nativeToScVal(materialId, { type: 'u64' })])
  }

  async getParticipantWastes(address: string): Promise<bigint[]> {
    return this.invoke<bigint[]>('get_participant_wastes', [new Address(address).toScVal()])
  }

  async getWasteTransferHistory(wasteId: bigint): Promise<WasteTransfer[]> {
    return this.invoke<WasteTransfer[]>('get_waste_transfer_history', [
      nativeToScVal(wasteId, { type: 'u128' }),
    ])
  }

  // =======================================================
  // Incentives
  // =======================================================

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
        nativeToScVal(budget, { type: 'u64' }),
      ],
      signer
    )
  }

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
        nativeToScVal(budget, { type: 'u64' }),
      ],
      signer
    )
  }

  async deactivateIncentive(incentiveId: bigint, rewarder: string, signer: string) {
    return this.invoke<void>(
      'deactivate_incentive',
      [nativeToScVal(incentiveId, { type: 'u64' }), new Address(rewarder).toScVal()],
      signer
    )
  }

  async getIncentiveById(incentiveId: bigint): Promise<Incentive | null> {
    return this.invoke<Incentive | null>('get_incentive_by_id', [
      nativeToScVal(incentiveId, { type: 'u64' }),
    ])
  }

  async getIncentives(wasteType: WasteType): Promise<Incentive[]> {
    return this.invoke<Incentive[]>('get_incentives', [nativeToScVal(wasteType, { type: 'u32' })])
  }

  async getActiveIncentives(): Promise<Incentive[]> {
    return this.invoke<Incentive[]>('get_active_incentives', [])
  }

  async getActiveMfrIncentive(manufacturer: string, wasteType: WasteType): Promise<Incentive | null> {
    return this.invoke<Incentive | null>('get_active_mfr_incentive', [
      new Address(manufacturer).toScVal(),
      nativeToScVal(wasteType, { type: 'u32' }),
    ])
  }

  async donateToCharity(donor: string, amount: bigint, signer: string) {
    return this.invoke<void>(
      'donate_to_charity',
      [new Address(donor).toScVal(), nativeToScVal(amount, { type: 'i128' })],
      signer
    )
  }

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
        new Address(manufacturer).toScVal(),
      ],
      signer
    )
  }

  // =======================================================
  // Stats & Metrics
  // =======================================================

  async getMetrics(): Promise<GlobalMetrics> {
    return this.invoke<GlobalMetrics>('get_metrics', [])
  }

  async getStats(participant: string): Promise<ParticipantStats> {
    return this.invoke<ParticipantStats>('get_stats', [new Address(participant).toScVal()])
  }

  async getSupplyChainStats(): Promise<{ total_wastes: bigint; total_weight: bigint; total_tokens: bigint }> {
    return this.invoke<{ total_wastes: bigint; total_weight: bigint; total_tokens: bigint }>('get_supply_chain_stats', [])
  }

  // =======================================================
  // Legacy aliases kept for backward compatibility
  // =======================================================

  /** @deprecated Use getWaste */
  async getWasteV2(wasteId: bigint): Promise<Waste | null> {
    return this.getWaste(wasteId)
  }

  /** @deprecated Use getParticipantWastes */
  async getParticipantWastesV2(address: string): Promise<bigint[]> {
    return this.getParticipantWastes(address)
  }

  /** @deprecated Use getWasteTransferHistory */
  async getWasteTransferHistoryV2(wasteId: bigint): Promise<WasteTransfer[]> {
    return this.getWasteTransferHistory(wasteId)
  }

  /** @deprecated Use submitMaterial */
  async recycleWaste(
    recycler: string,
    wasteType: WasteType,
    weightGrams: bigint,
    latitude: bigint,
    longitude: bigint,
    signer: string
  ): Promise<bigint> {
    const material = await this.submitMaterial(recycler, wasteType, weightGrams, latitude, longitude, signer)
    return BigInt(material.id)
  }
}
