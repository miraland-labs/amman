import { AmmanRequest, RelayReply } from '@miraplex/amman-client'
import {
  AmmanRelayRoutes,
  ammanRelayRoutes,
} from '@miraplex/amman/src/relay/routes'

import axios, { AxiosError } from 'axios'

export class RestClient {
  constructor(readonly routes: AmmanRelayRoutes) {}

  async request<T>(
    req: AmmanRequest,
    args: any = null
  ): Promise<RelayReply<T> & { status?: number; statusText?: string }> {
    const { method, url } = this.routes.urlAndMethodForRequest(req)
    const data = args == null ? undefined : JSON.stringify(args)
    try {
      return (await axios(url, { method, data })).data
    } catch (error: any) {
      const err = error as AxiosError
      const { status, statusText, data } = err.response!
      const errMsg = (data as { err: string }).err
      return { status, statusText, err: errMsg }
    }
  }
}

export async function restClient(routes = ammanRelayRoutes()) {
  return new RestClient(routes)
}
