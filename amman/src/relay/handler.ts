import {
  AccountSaveResult,
  AmmanVersion,
  LoadKeypairResult,
  SnapshotSaveResult,
  ValidatorPidResult,
  VoidResult,
  VOID_REPLY,
} from '@miraplex/amman-client'
import {
  KILL_AMMAN_EXIT_CODE,
  PersistedAccountInfo,
  RelayReply,
  RelayAccountState,
  AccountStatesResult,
} from '@miraplex/amman-client'
import { Keypair, PublicKey } from '@solarti/web3.js'
import { AccountProvider } from '../accounts/providers'
import { AccountStates } from '../accounts/state'
import { AccountPersister, mapPersistedAccountInfos } from '../assets'
import { scopedLog } from '../utils/log'
import {
  restartValidator,
  restartValidatorWithAccountOverrides,
  restartValidatorWithSnapshot,
} from '../validator'
import { AmmanStateInternal } from '../validator/types'
import { AMMAN_VERSION } from './types'

const { logDebug } = scopedLog('relay')

export class RelayHandler {
  constructor(
    readonly accountProvider: AccountProvider,
    readonly accountPersister: AccountPersister,
    readonly snapshotPersister: AccountPersister,
    readonly ammanState: AmmanStateInternal,
    private _accountStates: AccountStates,
    // Keyed pubkey:label
    private readonly _allKnownLabels: Record<string, string> = {}
  ) {}

  // -----------------
  // Account States
  // -----------------
  get accountStates() {
    return this._accountStates
  }

  private set accountStates(val: AccountStates) {
    // ensure we don't loose any existing subscriptions
    // (namely the relay server listening to account state changes)
    val.listeners = this._accountStates.listeners
    this._accountStates = val
  }

  requestAccountStates(pubkey: string): RelayReply<AccountStatesResult> {
    const states: RelayAccountState[] =
      this.accountStates.get(pubkey)?.relayStates ?? []
    return { result: { pubkey, states: states ?? [] } }
  }

  // -----------------
  // Address Labels
  // -----------------
  get allKnownLabels() {
    return this._allKnownLabels
  }

  updateAddressLabels(labels: Record<string, string>): RelayReply<VoidResult> {
    for (const [key, val] of Object.entries(labels)) {
      this._allKnownLabels[key] = val
    }
    this.accountStates.labelKeypairs(this._allKnownLabels)
    return VOID_REPLY
  }

  // -----------------
  // Amman Version
  // -----------------
  requestAmmanVersion(): RelayReply<AmmanVersion> {
    return { result: AMMAN_VERSION }
  }

  // -----------------
  // Restart Validator
  // -----------------
  async requestRestartValidator(): Promise<RelayReply<void>> {
    try {
      const { persistedAccountInfos, persistedSnapshotAccountInfos, keypairs } =
        await restartValidator(
          this.accountStates,
          this.ammanState,
          this.ammanState.config
        )

      const accountInfos = mapPersistedAccountInfos([
        ...persistedAccountInfos,
        ...persistedSnapshotAccountInfos,
      ])

      this.accountStates = AccountStates.createInstance(
        this.accountProvider.connection,
        this.accountProvider,
        accountInfos,
        keypairs
      )
      return { result: void 0 }
    } catch (err: any) {
      return { err }
    }
  }

  // -----------------
  // Validator Pid
  // -----------------
  requestValidatorPid(): RelayReply<ValidatorPidResult> {
    const pid = this.ammanState.validator.pid
    if (pid == null) {
      return {
        err: 'It seems like no validator is running currently, cannot get pid',
      }
    }
    return { result: pid }
  }

  // -----------------
  // Kill Amman
  // -----------------
  async requestKillAmman(): Promise<RelayReply<VoidResult>> {
    if (this.ammanState.relayServer != null) {
      logDebug('Stopping relay server')
      try {
        await this.ammanState.relayServer.close()
      } catch (err: any) {
        return { err: `amman relay failed to close properly\n${err.toString}` }
      }
    }

    // NOTE: if timing issues arise due to this function returning
    // before the process has finished stopping then we need to add some _wait_
    // code here that only returns once the process cannot be reached anymore
    logDebug('Killing validator')
    process.kill(this.ammanState.validator.pid!, 9)

    logDebug('Scheduling amman exit in next event loop')
    setImmediate(() => {
      logDebug('Exiting amman')
      process.exit(KILL_AMMAN_EXIT_CODE)
    })

    return VOID_REPLY
  }

  // -----------------
  // Save Account
  // -----------------
  async requestAccountSave(
    pubkey: string,
    slot?: number
  ): Promise<RelayReply<AccountSaveResult>> {
    try {
      let data
      if (slot != null) {
        data = this.accountStates.accountDataForSlot(pubkey, slot)
      }
      const accountPath = await this.accountPersister.saveAccount(
        new PublicKey(pubkey),
        this.accountProvider.connection,
        data
      )
      return { result: { pubkey, accountPath } }
    } catch (err: any) {
      return { err: err.toString() }
    }
  }

  // -----------------
  // Snapshot
  // -----------------
  async requestSnapshotSave(
    label: string
  ): Promise<RelayReply<SnapshotSaveResult>> {
    try {
      const addresses = this.accountStates.allAccountAddresses()
      const snapshotDir = await this.snapshotPersister.snapshot(
        label,
        addresses,
        this.allKnownLabels,
        this.accountStates.allKeypairs
      )
      return { result: { snapshotDir } }
    } catch (err: any) {
      return { err: err.toString() }
    }
  }

  async requestLoadSnapshot(label: string): Promise<RelayReply<VoidResult>> {
    try {
      const { persistedAccountInfos, persistedSnapshotAccountInfos, keypairs } =
        await restartValidatorWithSnapshot(
          this.accountStates,
          this.ammanState,
          label
        )

      const accountInfos = mapPersistedAccountInfos([
        ...persistedAccountInfos,
        ...persistedSnapshotAccountInfos,
      ])

      this._accountStates = AccountStates.createInstance(
        this.accountProvider.connection,
        this.accountProvider,
        accountInfos,
        keypairs
      )

      return VOID_REPLY
    } catch (err: any) {
      return { err: err.toString() }
    }
  }

  // -----------------
  // Keypair
  // -----------------
  requestStoreKeypair(
    id: string,
    secretKey: Uint8Array
  ): RelayReply<VoidResult> {
    try {
      const keypair = Keypair.fromSecretKey(secretKey)
      this.accountStates.storeKeypair(id, keypair)
      return VOID_REPLY
    } catch (err: any) {
      return { err: err.toString() }
    }
  }

  requestLoadKeypair(id: string): RelayReply<LoadKeypairResult> {
    const keypair = this.accountStates.getKeypairById(id)
    return { result: { id, keypair: keypair?.secretKey } }
  }

  // -----------------
  // Set Account
  // -----------------
  async requestSetAccount(
    account: PersistedAccountInfo
  ): Promise<RelayReply<VoidResult>> {
    const addresses = this.accountStates.allAccountAddresses()
    try {
      const { persistedAccountInfos, persistedSnapshotAccountInfos, keypairs } =
        await restartValidatorWithAccountOverrides(
          this.accountStates,
          this.ammanState,
          addresses,
          this.allKnownLabels,
          this.accountStates.allKeypairs,
          new Map([[account.pubkey, account]])
        )

      const accountInfos = mapPersistedAccountInfos([
        ...persistedAccountInfos,
        ...persistedSnapshotAccountInfos,
      ])

      this._accountStates = AccountStates.createInstance(
        this.accountProvider.connection,
        this.accountProvider,
        accountInfos,
        keypairs
      )
      return VOID_REPLY
    } catch (err: any) {
      return { err: err.toString() }
    }
  }
}
