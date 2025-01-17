import {
  AddressLabelsResult,
  AmmanRequest,
  keypairSecretFromObject,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_REQUEST_AMMAN_VERSION,
  MSG_REQUEST_KILL_AMMAN,
  MSG_REQUEST_LOAD_KEYPAIR,
  MSG_REQUEST_LOAD_SNAPSHOT,
  MSG_REQUEST_RESTART_VALIDATOR,
  MSG_REQUEST_SET_ACCOUNT,
  MSG_REQUEST_SNAPSHOT_SAVE,
  MSG_REQUEST_STORE_KEYPAIR,
  MSG_REQUEST_VALIDATOR_PID,
  MSG_UPDATE_ADDRESS_LABELS,
  RelayReply,
} from '@miraplex/amman-client'
import {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse,
  STATUS_CODES,
} from 'http'
import { UnreachableCaseError } from 'ts-essentials'
import { scopedLog } from '../utils/log'
import { RelayHandler } from './handler'
import {
  RelayMethod,
  RELAY_REST_PATH,
  RELAY_REST_PATH_LEN,
  ammanRelayRoutes,
} from './routes'

const { logTrace } = scopedLog('rest-server')

/**
 * The rest server exposes similar functionality that is available via the socket.io interface.
 *
 * The main difference is that only request/response functionality is supported.
 *
 * ### Interface
 *
 * Args to a POST method are expected to be passed in a tuple of varying sizes, aka array.
 *
 * Return values from a POST or GET take on two shapes:
 *
 * #### Return value only indicating success or failure of the operation:
 *
 * ```
 * {
 *   success: boolean // set only on success
 *   err: string      // set onlhy in an error case
 * }
 * ```
 *
 * #### Return value passing along a return arg
 *
 * ```
 * {
 *   result: any      // set only on success
 *   err: string      // set onlhy in an error case
 * }
 *
 * ```
 */
export class RestServer {
  private constructor(
    readonly app: HttpServer,
    readonly handler: RelayHandler
  ) {
    app.on('request', async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url?.trim()

      // /socket.io  handled by the socket io server

      if (!url?.startsWith(`/${RELAY_REST_PATH}`)) return

      logTrace(req.url)

      // cut off the path and the surrounding /s
      const request = url.slice(2 + RELAY_REST_PATH_LEN) as AmmanRequest
      const method = ammanRelayRoutes().methodForRequest(request)

      try {
        switch (request) {
          // -----------------
          // Amman Version
          // -----------------
          case MSG_REQUEST_AMMAN_VERSION: {
            const reply = handler.requestAmmanVersion()
            send(res, reply)
            break
          }
          // -----------------
          // Validator Pid
          // -----------------
          case MSG_REQUEST_VALIDATOR_PID:
            if (!assertMethod(req, res, url, method)) return
            const reply = handler.requestValidatorPid()
            send(res, reply)
            break
          // -----------------
          // Kill Amman
          // -----------------
          case MSG_REQUEST_KILL_AMMAN: {
            if (!assertMethod(req, res, url, method)) return
            const reply = await this.handler.requestKillAmman()
            send(res, reply)
            break
          }
          // -----------------
          // Address Labels
          // -----------------
          case MSG_UPDATE_ADDRESS_LABELS: {
            if (!assertMethod(req, res, url, method)) return
            const [labels] = await reqArgs(req)
            if (labels == null) {
              fail(res, 'Need to provide a record of address labels to update')
            } else {
              const reply = this.handler.updateAddressLabels(labels)
              send(res, reply)
            }
            break
          }
          case MSG_GET_KNOWN_ADDRESS_LABELS: {
            if (!assertMethod(req, res, url, method)) return
            const reply: RelayReply<AddressLabelsResult> = {
              result: { labels: this.handler.allKnownLabels },
            }
            send(res, reply)
            break
          }
          // -----------------
          // Restart Validator
          // -----------------
          case MSG_REQUEST_RESTART_VALIDATOR: {
            if (!assertMethod(req, res, url, method)) return
            const reply = await this.handler.requestRestartValidator()
            send(res, reply)
            break
          }
          // -----------------
          // Account States
          // -----------------
          case MSG_REQUEST_ACCOUNT_STATES: {
            if (!assertMethod(req, res, url, method)) return
            const [pubkeyArg] = await reqArgs(req)

            if (pubkeyArg == null) {
              fail(
                res,
                'Need to provide the public key of the account to fetch states for'
              )
            } else {
              const reply = this.handler.requestAccountStates(pubkeyArg)
              send(res, reply)
            }
            break
          }
          // -----------------
          // Save Account
          // -----------------
          case MSG_REQUEST_ACCOUNT_SAVE: {
            if (!assertMethod(req, res, url, method)) return
            const [pubkeyArg] = await reqArgs(req)
            const reply = await this.handler.requestAccountSave(pubkeyArg)
            send(res, reply)
            break
          }
          // -----------------
          // Snapshot
          // -----------------
          case MSG_REQUEST_SNAPSHOT_SAVE: {
            if (!assertMethod(req, res, url, method)) return
            const [label] = await reqArgs(req)
            const reply = await this.handler.requestSnapshotSave(label)
            send(res, reply)
            break
          }
          case MSG_REQUEST_LOAD_SNAPSHOT: {
            if (!assertMethod(req, res, url, method)) return
            const [label] = await reqArgs(req)
            const reply = await this.handler.requestLoadSnapshot(label)
            send(res, reply)
            break
          }
          // -----------------
          // Keypair
          // -----------------
          case MSG_REQUEST_STORE_KEYPAIR: {
            if (!assertMethod(req, res, url, method)) return
            const [id, secretKey] = await reqArgs(req)
            const secretKeyArray = keypairSecretFromObject(secretKey)
            const reply = this.handler.requestStoreKeypair(id, secretKeyArray)
            send(res, reply)
            break
          }
          case MSG_REQUEST_LOAD_KEYPAIR: {
            if (!assertMethod(req, res, url, method)) return
            const [id] = await reqArgs(req)
            const reply = this.handler.requestLoadKeypair(id)
            send(res, reply)
            break
          }
          // -----------------
          // Set Account
          // -----------------
          case MSG_REQUEST_SET_ACCOUNT: {
            if (!assertMethod(req, res, url, method)) return
            const [account] = await reqArgs(req)
            const reply = this.handler.requestSetAccount(account)
            send(res, reply)
            break
          }
          default:
            const err = new UnreachableCaseError(request)
            fail(res, `Unknown route ${url} ${err.toString()}`, 404)
        }
      } catch (err: any) {
        fail(res, err.toString(), 500)
      }
    })
  }

  static init(app: HttpServer, relayHandler: RelayHandler) {
    return new RestServer(app, relayHandler)
  }
}

// -----------------
// Helpers
// -----------------
function assertMethod(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
  method: RelayMethod
) {
  switch (method) {
    case 'GET':
      return assertGet(req, res, url)
    case 'POST':
      return assertPost(req, res, url)
    default:
      throw new UnreachableCaseError(method)
  }
}
function assertPost(req: IncomingMessage, res: ServerResponse, url: string) {
  if (req.method?.toUpperCase() !== 'POST') {
    fail(res, `${url} needs to be POST`, 405)
    return false
  }
  return true
}

function assertGet(req: IncomingMessage, res: ServerResponse, url: string) {
  if (req.method?.toUpperCase() !== 'GET') {
    fail(res, `${url} needs to be GET`, 405)
    return false
  }
  return true
}

async function reqArgs(req: IncomingMessage): Promise<any[]> {
  const buffers = []
  for await (const chunk of req) {
    buffers.push(chunk)
  }

  const data = Buffer.concat(buffers).toString()
  if (data.length == 0) {
    return []
  }
  try {
    const args = JSON.parse(data)
    logTrace({ args })
    return args
  } catch (err: any) {
    throw new Error(
      `Failed to parse JSON input: ${data.toString()}\n${err.toString()}`
    )
  }
}

function send(res: ServerResponse, payload: any) {
  writeStatusHead(res, 200)
  try {
    const json = JSON.stringify(payload)
    res.end(json)
  } catch (err: any) {
    fail(res, `Failed to stringify payload: ${payload.toString()}`)
  }
}

function fail(res: ServerResponse, msg: string, statusCode = 422) {
  writeStatusHead(res, statusCode)
  res.end(JSON.stringify({ err: `${STATUS_CODES[statusCode]}: ${msg}` }))
}

function writeStatusHead(res: ServerResponse, status: number) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': 2592000, // 30 days
  })
}
