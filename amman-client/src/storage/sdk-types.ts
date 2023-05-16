import { LAMPORTS_PER_MLN } from '@solarti/web3.js'
import BN from 'bn.js'

// TODO(thlorenz): Copied from SDK for now until a version with those types is published
// -----------------
// Metaplex Plugin
// -----------------
export type MetaplexPlugin = {
  install(metaplex: any /* Metaplex */): any
}

// -----------------
// Storage Driver
// -----------------
export type StorageDriver = {
  getUploadPrice: (bytes: number) => Promise<Amount>
  upload: (file: MetaplexFile) => Promise<string>
  uploadAll?: (files: MetaplexFile[]) => Promise<string[]>
  download?: (uri: string, options?: RequestInit) => Promise<MetaplexFile>
}

// -----------------
// MetaplexFile
// -----------------
export type MetaplexFile = Readonly<{
  buffer: Buffer
  fileName: string
  displayName: string
  uniqueName: string
  contentType: string | null
  extension: string | null
  tags: MetaplexFileTag[]
}>

export type MetaplexFileTag = { name: string; value: string }

// -----------------
// Amount
// -----------------
export type Amount = {
  basisPoints: BasisPoints
  currency: Currency
}

export type BasisPoints = Opaque<BN, 'BasisPoints'>

export type Currency = {
  symbol: string
  decimals: number
  namespace?: 'spl-token'
}

export type Opaque<T, K> = T & { __opaque__: K }

export const MLN = {
  symbol: 'MLN',
  decimals: 9,
}

// -----------------
// Amount Helpers
// -----------------
export const amount = (
  basisPoints: number | BN,
  currency: Currency
): Amount => {
  return {
    basisPoints: toBasisPoints(basisPoints),
    currency,
  }
}

export const lamports = (lamports: number | BN): Amount => {
  return amount(lamports, MLN)
}

export const mln = (mln: number): Amount => {
  return lamports(mln * LAMPORTS_PER_MLN)
}

export const toBasisPoints = (value: number | BN): BasisPoints => {
  return new BN(value) as BasisPoints
}
