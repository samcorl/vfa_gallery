import type { Context } from 'hono'

/**
 * CloudFlare D1 Database binding
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}

export interface D1Result<T = unknown> {
  success: boolean
  results?: T[]
}

export interface D1ExecResult {
  success: boolean
  count?: number
  duration?: number
}

/**
 * CloudFlare R2 bucket binding
 */
export interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object>
  get(key: string): Promise<R2Object | null>
  delete(key: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
  head(key: string): Promise<R2Object>
}

export interface R2PutOptions {
  httpMetadata?: R2HttpMetadata
  customMetadata?: Record<string, string>
}

export interface R2HttpMetadata {
  contentType?: string
  cacheControl?: string
  contentDisposition?: string
  contentEncoding?: string
  expires?: string
}

export interface R2Object {
  key: string
  version?: string
  size: number
  etag: string
  httpEtag?: string
  checksums: R2Checksums
  uploaded: Date
  httpMetadata?: R2HttpMetadata
  customMetadata?: Record<string, string>
  range?: { offset: number; length: number }
  body?: ReadableStream<Uint8Array>
  bodyUsed?: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  blob(): Promise<Blob>
}

export interface R2Checksums {
  md5?: string
  sha1?: string
  sha256?: string
}

export interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
}

export interface R2Objects {
  objects: R2Object[]
  delimitedPrefixes?: string[]
  isTruncated: boolean
  cursor?: string
}

/**
 * CloudFlare Environment Variables
 * All bindings and secrets available in worker context
 */
export interface CloudFlareEnv {
  DB: D1Database
  IMAGE_BUCKET: R2Bucket
  JWT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  ENVIRONMENT: 'development' | 'production'
  RESEND_API_KEY: string
}

/**
 * Hono Context type with CloudFlare environment
 */
export type HonoEnv = {
  Bindings: CloudFlareEnv
  Variables: {
    user?: {
      userId: string
      email: string
      role: 'user' | 'admin'
    }
  }
}

/**
 * Hono Context helper type
 */
export type HonoContext = Context<HonoEnv>
