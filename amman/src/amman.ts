import * as AmmanClient from '@miraplex/amman-client'

export { tmpLedgerDir } from './utils'
export { Change } from './accounts/state'
export * from './types'

// -----------------
// Forwarding some amman-client exports
// -----------------
export {
  AmmanAccountRendererMap,
  LOCALHOST,
  assertConfirmedTransaction, // MI added for test case
  assertTransactionSummary // MI added for test case
} from '@miraplex/amman-client'

/**
 * @deprecated Use from _amman-client_ directly via `import { Amman } from '@miraplex/amman-client'`
 */
export const Amman = AmmanClient.Amman
