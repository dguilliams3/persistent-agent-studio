/**
 * Runtime Environment Contract
 *
 * @module @persistence/core/runtime-env
 * @description Platform-agnostic interface that packages consume.
 *
 * The platform layer (Cloudflare, Node, etc.) constructs a RuntimeEnv at startup
 * with validation — required fields are REQUIRED, not optional.
 *
 * Package functions receive narrow params (db, personaId), NOT the full RuntimeEnv.
 * RuntimeEnv is top-level handoff only: platform -> router -> destructure for handlers.
 *
 * @upstream Constructed by: platform bootstrap (platforms/cloudflare/src/index.ts)
 * @downstream Consumed by: route dispatch, service initialization
 * @pattern Contract interface — platform constructs, packages consume via narrow destructuring
 *
 * @antipattern
 * // WRONG: Passing RuntimeEnv deep into package functions
 * async function getHistory(env: RuntimeEnv) { ... }
 *
 * // CORRECT: Destructure at the boundary, pass narrow params
 * const { db } = env;
 * const history = await getHistory(db, personaId);
 */

/**
 * Minimal D1Database interface — duplicated from @persistence/db to avoid
 * circular dependency (core -> db -> core). If the D1Database shape changes
 * in @persistence/db/personas, update this copy.
 *
 * @antipattern Do NOT import from @persistence/db here — it creates a cycle.
 */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: {
    last_row_id: number;
    changes: number;
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

interface D1ExecResult {
  count: number;
  duration: number;
}

/**
 * Minimal R2Bucket interface for platform-agnostic usage.
 * Full type available via @cloudflare/workers-types in platform packages.
 */
export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string | Blob, options?: Record<string, unknown>): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
  list(options?: Record<string, unknown>): Promise<{ objects: R2Object[]; truncated: boolean; cursor?: string }>;
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  body?: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

/**
 * Minimal Ai interface for platform-agnostic usage.
 * Full type available via @cloudflare/workers-types in platform packages.
 */
export interface Ai {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

/**
 * @description Grouped secrets with different security lifecycle than resources.
 *
 * Required secrets are non-optional — platform validates at startup and throws
 * if any are missing. Optional secrets enable graceful degradation of features.
 */
export interface RuntimeSecrets {
  anthropicApiKey: string;
  telegramBotToken: string;
  adminPassword: string;
  replicateApiToken?: string;
  elevenLabsApiKey?: string;
  jwtSecret?: string;
}

/**
 * @description Platform-agnostic runtime environment.
 *
 * Flat interface with concrete types. Secrets are nested because they have
 * a different security lifecycle than resource bindings.
 *
 * Property names are permanent; underlying types are evolvable. When a new
 * platform needs local execution, write one adapter implementing D1Database's
 * shape for better-sqlite3. Zero package changes.
 */
export interface RuntimeEnv {
  /** D1 database binding */
  db: D1Database;

  /** R2 object storage binding (images, audio, exports) */
  bucket: R2Bucket;

  /** Cloudflare Workers AI binding (Whisper, embeddings, image gen) */
  ai: Ai;

  /** Grouped credentials — different lifecycle than resource bindings */
  secrets: RuntimeSecrets;

  /** Extend request lifetime beyond response (Cloudflare ctx.waitUntil) */
  waitUntil?: (promise: Promise<unknown>) => void;
}
