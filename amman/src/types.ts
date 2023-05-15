import { AccountInfo } from '@solarti/web3.js'
import { SnapshotConfig } from './assets'
import { RelayConfig } from './relay/types'
import { StorageConfig } from './storage'
import { ValidatorConfig } from './validator/types'

export {
  RelayAccountState,
  AccountDiff,
} from '@miraplex/amman-client'

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer I>
    ? Array<DeepPartial<I>>
    : DeepPartial<T[P]>
}

/**
 * Amman Config
 *
 * @property validatorConfig Validator configuration
 * @property relayConfig Relay configuration
 * @property storageConfig Mock Storage configuration
 * @property streamTransactionLogs if `true` the `miraland logs` command is
 * spawned and its output piped through a prettifier, defaults to run except when in a CI environment
 */
export type AmmanConfig = {
  validator?: ValidatorConfig
  relay?: RelayConfig
  storage?: StorageConfig
  snapshot?: SnapshotConfig
  streamTransactionLogs?: boolean
  assetsFolder?: string
}

export type AmmanAccount = {
  pretty(): Record<string, any>
}

/**
 * The type that an account provider needs to implement so that amman can deserialize account data.
 * @category diagnostics
 */
export type AmmanAccountProvider = {
  byteSize: number | ((args: any) => void)
  fromAccountInfo(
    accountInfo: AccountInfo<Buffer>,
    offset?: number
  ): [AmmanAccount, number]
}
