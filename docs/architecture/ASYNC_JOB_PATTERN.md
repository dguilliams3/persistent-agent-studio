# Async Job Pattern

**Created:** 2026-01-27
**Status:** Vision Document

This document describes how to handle asynchronous external operations that span multiple thinking cycles.

---

## The Problem

Some operations take too long to wait for in a single cycle:

- **Image generation** (Replicate SDXL/FLUX) - 10-60 seconds
- **Batch API** (Anthropic) - minutes to hours
- **Long audio generation** (ElevenLabs) - several seconds
- **Local generation** (PONY) - variable, depends on the user's laptop

If we block and wait, Clio can't do anything else. The cycle times out. Bad UX.

---

## The Solution: Fire and Forget with Callbacks

```
Cycle N:                              Cycle N+1, N+2, ...:
─────────                             ────────────────────
Start async job                       Check pending jobs
    │                                     │
    ▼                                     ▼
Get job_id back                      Poll each job's status
    │                                     │
    ▼                                     │
Save to pending_jobs table           ┌────┴────┐
    │                                │         │
    ▼                                ▼         ▼
Log "request" to history          Succeeded   Still running
    │                                │         │
    ▼                                ▼         ▼
END CYCLE (don't block!)        Execute      Check again
                                callback      next cycle
                                    │
                                    ▼
                              Log "result"
                              Send to Telegram
                              Clean up job
```

---

## Core Types

```typescript
// packages/services/src/core/types.ts

export type JobStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface AsyncJob<T> {
  id: string;
  status: JobStatus;
  result?: T;
  error?: string;
  progress?: number;  // 0-100, if service supports it
}

export interface PendingJob {
  id: number;                    // DB row ID
  jobId: string;                 // External service's job ID
  service: string;               // 'replicate', 'batch', 'pony', etc.
  jobType: string;               // 'image', 'summarize', 'tts', etc.
  params: Record<string, unknown>; // Original request params
  callback: JobCallback;         // What to do when done
  startedAt: string;             // ISO timestamp
  timeoutAt: string;             // When to give up
  lastCheckedAt?: string;        // Last poll time
  attempts: number;              // Poll attempt count
}

export interface JobCallback {
  action: string;                // 'send_telegram', 'log_history', etc.
  params: Record<string, unknown>; // { chatId, historyType, etc. }
}
```

---

## The AsyncJobService Interface

Every async service implements this:

```typescript
// packages/services/src/core/async-job.ts

export interface AsyncJobService<TInput, TOutput> {
  /**
   * Start an async job. Returns immediately with job ID.
   * Does NOT wait for completion.
   */
  startJob(input: TInput): Promise<{ jobId: string }>;

  /**
   * Check job status. Returns current state.
   * Call this to poll for completion.
   */
  checkJob(jobId: string): Promise<AsyncJob<TOutput>>;

  /**
   * Optional: Cancel a running job.
   */
  cancelJob?(jobId: string): Promise<void>;
}
```

---

## Example: Replicate Implementation

```typescript
// packages/services/src/replicate/client.ts

import type { AsyncJobService, AsyncJob } from '../core/async-job';
import type { ReplicateInput, ImageResult } from './types';

export class ReplicateService implements AsyncJobService<ReplicateInput, ImageResult> {
  constructor(private token: string) {}

  async startJob(input: ReplicateInput): Promise<{ jobId: string }> {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: input.modelVersion,
        input: input.params,
      }),
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const data = await response.json();
    return { jobId: data.id };
  }

  async checkJob(jobId: string): Promise<AsyncJob<ImageResult>> {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${jobId}`,
      { headers: { 'Authorization': `Token ${this.token}` } }
    );

    const data = await response.json();

    return {
      id: jobId,
      status: this.mapStatus(data.status),
      result: data.status === 'succeeded' ? {
        url: data.output?.[0],
        metadata: data.metrics,
      } : undefined,
      error: data.error,
    };
  }

  private mapStatus(replicateStatus: string): JobStatus {
    switch (replicateStatus) {
      case 'starting':
      case 'processing':
        return 'processing';
      case 'succeeded':
        return 'succeeded';
      case 'failed':
        return 'failed';
      case 'canceled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}
```

---

## Job Tracking (Database)

Jobs are persisted so they survive across cycles:

```typescript
// packages/db/src/jobs.ts (new file)

export interface CreateJobParams {
  jobId: string;
  service: string;
  jobType: string;
  params: Record<string, unknown>;
  callback: JobCallback;
  timeoutMinutes?: number;  // Default: 10
}

export async function createPendingJob(
  db: D1Database,
  params: CreateJobParams
): Promise<number> {
  const timeoutAt = new Date(
    Date.now() + (params.timeoutMinutes ?? 10) * 60 * 1000
  ).toISOString();

  const result = await db.prepare(`
    INSERT INTO pending_jobs (job_id, service, job_type, params, callback, started_at, timeout_at, attempts)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 0)
  `).bind(
    params.jobId,
    params.service,
    params.jobType,
    JSON.stringify(params.params),
    JSON.stringify(params.callback),
    timeoutAt
  ).run();

  return result.meta.last_row_id;
}

export async function getPendingJobs(
  db: D1Database,
  service?: string
): Promise<PendingJob[]> {
  const query = service
    ? 'SELECT * FROM pending_jobs WHERE completed_at IS NULL AND service = ?'
    : 'SELECT * FROM pending_jobs WHERE completed_at IS NULL';

  const result = await db.prepare(query)
    .bind(...(service ? [service] : []))
    .all();

  return result.results.map(row => ({
    ...row,
    params: JSON.parse(row.params),
    callback: JSON.parse(row.callback),
  }));
}

export async function markJobComplete(
  db: D1Database,
  id: number,
  result: unknown
): Promise<void> {
  await db.prepare(`
    UPDATE pending_jobs
    SET completed_at = datetime('now'), result = ?
    WHERE id = ?
  `).bind(JSON.stringify(result), id).run();
}

export async function markJobFailed(
  db: D1Database,
  id: number,
  error: string
): Promise<void> {
  await db.prepare(`
    UPDATE pending_jobs
    SET completed_at = datetime('now'), error = ?
    WHERE id = ?
  `).bind(error, id).run();
}

export async function incrementAttempts(
  db: D1Database,
  id: number
): Promise<void> {
  await db.prepare(`
    UPDATE pending_jobs
    SET attempts = attempts + 1, last_checked_at = datetime('now')
    WHERE id = ?
  `).bind(id).run();
}
```

---

## Job Orchestration

At the start of each cycle (or periodically), check pending jobs:

```typescript
// Could live in platform layer or a new @persistence/jobs package

export async function processPendingJobs(
  db: D1Database,
  services: ServiceRegistry,  // { replicate: ReplicateService, ... }
  callbacks: CallbackRegistry // { send_telegram: (params) => ..., ... }
): Promise<void> {
  const pendingJobs = await getPendingJobs(db);
  const now = new Date();

  for (const job of pendingJobs) {
    // Check timeout
    if (new Date(job.timeoutAt) < now) {
      await markJobFailed(db, job.id, 'Timeout');
      await logHistory({ type: 'job_timeout', content: `Job ${job.jobId} timed out` });
      continue;
    }

    // Get the appropriate service
    const service = services[job.service];
    if (!service) {
      console.error(`Unknown service: ${job.service}`);
      continue;
    }

    // Check job status
    await incrementAttempts(db, job.id);
    const status = await service.checkJob(job.jobId);

    if (status.status === 'succeeded') {
      // Execute callback
      const callbackFn = callbacks[job.callback.action];
      if (callbackFn) {
        await callbackFn({ ...job.callback.params, result: status.result });
      }
      await markJobComplete(db, job.id, status.result);
    } else if (status.status === 'failed') {
      await markJobFailed(db, job.id, status.error ?? 'Unknown error');
    }
    // If still processing, do nothing - check again next cycle
  }
}
```

---

## Usage in Tool Handlers

```typescript
// packages/tools/src/definitions/art/handler.ts

export const handler: ToolHandler<ArtParams> = async (params, ctx) => {
  const { prompt, model } = params;
  const { db, env } = ctx;

  // Start the job (returns immediately)
  const replicate = new ReplicateService(env.REPLICATE_API_TOKEN);
  const { jobId } = await replicate.startJob({
    modelVersion: getModelVersion(model),
    params: { prompt },
  });

  // Save for later processing
  await createPendingJob(db, {
    jobId,
    service: 'replicate',
    jobType: 'image',
    params: { prompt, model },
    callback: {
      action: 'send_telegram_image',
      params: { chatId: ctx.telegramChatId },
    },
    timeoutMinutes: 5,
  });

  // Log the request
  await logHistory({
    db,
    type: HISTORY_TYPES.ART_REQUEST,
    content: `Requested image: "${prompt}" via ${model}`,
  });

  // Return immediately - don't wait!
  return {
    success: true,
    type: 'art_requested',
    data: { jobId, message: 'Image generation started' },
  };
};
```

---

## Callback Registry

```typescript
// Platform layer - defines what callbacks can do

const callbacks: CallbackRegistry = {
  send_telegram_image: async ({ chatId, result }) => {
    await sendTelegramPhoto(token, chatId, result.url);
    await logHistory({ type: 'art_result', content: `Generated image: ${result.url}` });
  },

  send_telegram_message: async ({ chatId, result }) => {
    await sendTelegramMessage(token, chatId, result.text);
  },

  log_history_only: async ({ historyType, result }) => {
    await logHistory({ type: historyType, content: JSON.stringify(result) });
  },
};
```

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS pending_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,           -- External service's job ID
  service TEXT NOT NULL,          -- 'replicate', 'batch', 'pony'
  job_type TEXT NOT NULL,         -- 'image', 'summarize', 'tts'
  params TEXT NOT NULL,           -- JSON: original request params
  callback TEXT NOT NULL,         -- JSON: { action, params }
  started_at TEXT NOT NULL,
  timeout_at TEXT NOT NULL,
  last_checked_at TEXT,
  attempts INTEGER DEFAULT 0,
  completed_at TEXT,              -- NULL = still pending
  result TEXT,                    -- JSON: success result
  error TEXT,                     -- Error message if failed
  persona_id INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_pending_jobs_status ON pending_jobs(completed_at, service);
```

---

## Benefits

1. **Non-blocking cycles** - Clio doesn't wait for slow operations
2. **Resilient** - Jobs persist across worker restarts
3. **Observable** - Can query pending_jobs to see what's in flight
4. **Flexible** - Callbacks define what happens on completion
5. **Timeout handling** - Jobs don't hang forever
6. **Separation of concerns** - Services don't know about Telegram/history
