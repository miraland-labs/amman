import {
  StorageDriver,
  Metaplex,
  MetaplexFile,
  MetaplexPlugin,
} from '@lorisleiva/js-next-alpha'

import { strict as assert } from 'assert'
import BN from 'bn.js'
import path from 'path'
import {
  logInfo as ammanLogInfo,
  logDebug as ammanLogDebug,
  logTrace as ammanLogTrace,
} from '../utils'
import {
  assertValidPathSegmentWithoutSpaces,
  canAccessSync,
  ensureDirSync,
} from '../utils/fs'
import { AMMAN_STORAGE_ROOT, AMMAN_STORAGE_URI } from './consts'
import { promises as fs } from 'fs'

const DEFAULT_COST_PER_BYTE = new BN(1)

export type AmmanMockStorageDriverOptions = {
  costPerByte?: BN | number
  logInfo?: (...data: any[]) => void
  logDebug?: (...data: any[]) => void
  logTrace?: (...data: any[]) => void
}

export class AmmanMockStorageDriver extends StorageDriver {
  private cache: Record<string, MetaplexFile> = {}

  readonly baseUrl: string
  readonly storageDir: string

  constructor(
    metaplex: Metaplex,
    readonly storageId: string,
    readonly uploadRoot: string,
    readonly costPerByte: BN,
    readonly logInfo: (...data: any[]) => void,
    readonly logDebug: (...data: any[]) => void,
    readonly logTrace: (...data: any[]) => void
  ) {
    super(metaplex)
    assertValidPathSegmentWithoutSpaces(
      storageId,
      'please select a different storage id'
    )
    this.storageDir = path.join(AMMAN_STORAGE_ROOT, storageId)

    ensureDirSync(this.storageDir)
    assert(
      canAccessSync(this.uploadRoot),
      `uploadRoot '${uploadRoot}' must be accessible, but is not`
    )

    this.baseUrl = AmmanMockStorageDriver.getStorageUri(storageId)
    this.logInfo(`Amman Storage Driver with '${storageId}' initialized`)
    this.logDebug({
      uploadRoot,
      storageDir: this.storageDir,
      baseUrl: this.baseUrl,
    })
  }

  static readonly create = (
    storageId: string,
    uploadRoot: string,
    options: AmmanMockStorageDriverOptions = {}
  ): MetaplexPlugin => {
    const {
      costPerByte = DEFAULT_COST_PER_BYTE,
      logInfo = ammanLogInfo,
      logDebug = ammanLogDebug,
      logTrace = ammanLogTrace,
    } = options
    return {
      install: (metaplex: Metaplex) =>
        metaplex.setStorage(
          new AmmanMockStorageDriver(
            metaplex,
            storageId,
            uploadRoot,
            new BN(costPerByte),
            logInfo,
            logDebug,
            logTrace
          )
        ),
    }
  }

  static readonly getStorageUri = (storageId: string) =>
    `${AMMAN_STORAGE_URI}/${storageId}`

  public async getPrice(file: MetaplexFile): Promise<BN> {
    return new BN(file.buffer.byteLength).mul(this.costPerByte)
  }

  public async upload(file: MetaplexFile): Promise<string> {
    this.logTrace(file)
    const resourceUri = file.uniqueName
    const uri = `${this.baseUrl}/${resourceUri}`

    const fullDst = path.join(this.storageDir, resourceUri)

    // JSON files include inline metadata instead of referencing an image to upload
    if (file.contentType === 'application/json') {
      await fs.writeFile(fullDst, file.toBuffer())
    } else {
      // Copy from upload dir into storage
      const fullSrc = path.join(this.uploadRoot, file.fileName)
      await fs.copyFile(fullSrc, fullDst)
    }
    this.logDebug(
      `Uploaded ${file.displayName}:${file.uniqueName} to ${fullDst}`
    )

    this.cache[uri] = file

    return uri
  }

  public async download(uri: string): Promise<MetaplexFile> {
    const file = this.cache[uri]
    assert(file != null, `file '${uri}' not found`)
    return file
  }

  public async downloadJson<T extends object>(uri: string): Promise<T> {
    const file = await this.download(uri)
    return JSON.parse(file.toString())
  }
}