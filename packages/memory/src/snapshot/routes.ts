/**
 * Personality Snapshot Export/Import Route Handlers
 *
 * Enables complete personality backup, transfer, and experimentation.
 * Supports selective export and multiple import modes (replace/merge/branch).
 *
 * All handlers use Basin Pattern (db as param) — platform-agnostic.
 *
 * @module @persistence/memory/snapshot/routes
 *
 * SNAPSHOT FORMAT VERSION: 2.0
 *
 * DB ACCESS PATTERN:
 * Most DB operations in this module go through @persistence/db helpers (getState,
 * setState, logHistory, etc.). The gallery import handler (`handleImportGallery`)
 * uses `db.$client.prepare().bind().run()` directly for the UPDATE history SET
 * statement because it operates on a row ID known only at import time, outside
 * the Drizzle schema's normal insert path.
 *
 * @antipattern DO NOT call `db.prepare()` — DrizzleD1 is a Drizzle wrapper,
 *   not a raw D1Database. Use `db.$client.prepare()` for raw SQL.
 *
 * @upstream Called by: Platform route registry
 * @downstream Calls: @persistence/db (state, history, branches, etc.),
 *                     @persistence/memory/snapshot (checksum, validation, constants)
 */

import type { DrizzleD1 } from "@persistence/db";
import {
  getState,
  setState,
  getHistory,
  getColdStorage,
  getNotebook,
  getNotebookIndex,
  getObservations,
  getObservationIndex,
  getSummaries,
  getReminders,
  getAllReminders,
  addColdStorage,
  saveNote,
  saveObservation,
  addSummary,
  addReminder,
  getBranches,
  getActiveBranch,
  getOverrides,
  getSyntheticMemories,
  createBranch,
  getActivePersonaId,
  logHistory,
} from "@persistence/db";

import {
  SNAPSHOT_VERSION,
  MAX_EXPORT_SIZE_BYTES,
  DEFAULT_EXPORT_HISTORY_LIMIT,
  IMAGE_PLACEHOLDER,
  EXPORTABLE_STATE_KEYS,
  calculateChecksum,
  validateSnapshotFormat,
  verifyChecksum,
} from "./index";

/**
 * Minimal env shape needed by personality route handlers.
 * Platform passes the full Env; we only require these fields.
 */
interface PersonalityEnv {
  WORKER_URL?: string;
  ADMIN_PASSWORD?: string;
  [key: string]: unknown;
}

/**
 * Image resize function signature.
 * Injected by platform layer since image processing may be platform-specific.
 */
export type ResizeImageFn = (
  imageBase64: string,
  maxDimension: number,
  quality: number,
) => {
  base64: string;
  width: number;
  height: number;
  error?: string;
};

/**
 * Platform-specific dependencies injected into handlers that need them.
 * Avoids importing platform utilities directly.
 */
export interface SnapshotDeps {
  resizeImage: ResizeImageFn;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function findImagesInHistory(history: any[], profilePicture: any) {
  const images = [];

  for (const entry of history) {
    const imageData = entry.internal?.startsWith("data:image")
      ? entry.internal
      : entry.content?.startsWith("data:image")
        ? entry.content
        : null;

    if (
      imageData &&
      (entry.type === "art_result" || entry.type === "user_art")
    ) {
      images.push({
        id: `hist_${entry.id}`,
        entry,
        imageData,
        sourceType: "history",
        sourceId: entry.id,
        imageType: entry.type,
        createdAt: entry.created_at,
      });
    }
  }

  if (profilePicture) {
    images.push({
      id: "profile",
      entry: null,
      imageData: profilePicture,
      sourceType: "media",
      sourceId: null,
      imageType: "profile_picture",
      createdAt: null,
    });
  }

  return images;
}

function extractImageRefs(history: any[], profilePicture: any) {
  const images = findImagesInHistory(history, profilePicture);

  return images.map((img) => ({
    id: img.id,
    sourceType: img.sourceType,
    sourceId: img.sourceId,
    imageType: img.imageType,
    createdAt: img.createdAt,
    prompt: img.imageType === "art_result" ? img.entry?.content : null,
  }));
}

function buildGalleryExport(history: any[], profilePicture: any) {
  const images = findImagesInHistory(history, profilePicture);

  let totalSizeBytes = 0;
  const galleryImages = images.map((img) => {
    const sizeBytes = Math.round(img.imageData.length * 0.75);
    totalSizeBytes += sizeBytes;

    return {
      id: img.id,
      sourceType: img.sourceType,
      sourceId: img.sourceId,
      imageType: img.imageType,
      createdAt: img.createdAt,
      prompt: img.imageType === "art_result" ? img.entry?.content : null,
      mimeType: img.imageData.match(/^data:([^;]+);/)?.[1] || "image/jpeg",
      sizeBytes,
      base64: img.imageData,
    };
  });

  return {
    manifest: {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      imageCount: galleryImages.length,
      totalSizeBytes,
      format: "json-base64",
    },
    images: galleryImages,
  };
}

function detectImagePlaceholderField(entry: any) {
  if (
    typeof entry?.content === "string" &&
    entry.content === IMAGE_PLACEHOLDER
  ) {
    return "content";
  }
  if (
    typeof entry?.internal === "string" &&
    entry.internal === IMAGE_PLACEHOLDER
  ) {
    return "internal";
  }
  return null;
}

function parseExportedHistoryId(entryId: any) {
  if (typeof entryId === "number" && Number.isFinite(entryId)) {
    return entryId;
  }
  if (typeof entryId === "string") {
    const parsed = Number.parseInt(entryId, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// =============================================================================
// EXPORT HANDLERS
// =============================================================================

export async function handleExportPersonality(
  db: DrizzleD1,
  request: Request,
  url: URL,
  env: PersonalityEnv,
) {
  try {
    let options: Record<string, any> = {
      includeHistory: true,
      historyLimit: null as number | null,
      includeAllHistory: false,
      includeSummaries: true,
      includeMedia: false,
      includeGallery: false,
      galleryLimit: null as number | null,
      includeBranches: false,
      name: "Unnamed Export",
      description: "",
    };

    if (request.method === "POST") {
      const body = (await request.json()) as any;
      options = { ...options, ...body };
    } else {
      if (url.searchParams.has("includeMedia")) {
        options.includeMedia = url.searchParams.get("includeMedia") === "true";
      }
      if (url.searchParams.has("includeGallery")) {
        options.includeGallery =
          url.searchParams.get("includeGallery") === "true";
      }
      if (url.searchParams.has("includeBranches")) {
        options.includeBranches =
          url.searchParams.get("includeBranches") === "true";
      }
      if (url.searchParams.has("includeAllHistory")) {
        options.includeAllHistory =
          url.searchParams.get("includeAllHistory") === "true";
      }
      if (url.searchParams.has("historyLimit")) {
        options.historyLimit = parseInt(url.searchParams.get("historyLimit")!);
      }
      if (url.searchParams.has("galleryLimit")) {
        options.galleryLimit = parseInt(url.searchParams.get("galleryLimit")!);
      }
      if (url.searchParams.has("name")) {
        options.name = url.searchParams.get("name");
      }
    }

    const snapshot: Record<string, any> = {
      meta: {
        version: SNAPSHOT_VERSION,
        exportedAt: new Date().toISOString(),
        sourceHost:
          env.WORKER_URL ||
          "https://your-worker.workers.dev",
        name: options.name,
        description: options.description,
      },
      state: {} as Record<string, any>,
      memories: {
        history: [] as any[],
        coldStorage: [] as any[],
        notebook: [] as any[],
        observations: [] as any[],
        summaries: [] as any[],
        reminders: [] as any[],
        imageRefs: [] as any[],
      },
      media: {
        profilePicture: null as any,
        gallery: [] as any[],
      },
      branches: {
        list: [] as any[],
        overrides: [] as any[],
        synthetics: [] as any[],
        activeBranch: "main",
      },
      systemPrompt: {
        template: "default",
        customizations: {},
      },
    };

    for (const key of EXPORTABLE_STATE_KEYS) {
      const value = await getState(db, key);
      if (value !== null) {
        snapshot.state[key] = value;
      }
    }

    if (options.includeHistory) {
      const historyLimit = options.includeAllHistory
        ? 999999
        : options.historyLimit && options.historyLimit > 0
          ? options.historyLimit
          : DEFAULT_EXPORT_HISTORY_LIMIT;

      let history = await getHistory(db, historyLimit);
      snapshot.memories.history = history.map((h) => {
        if (!options.includeMedia && h.internal?.startsWith("data:image")) {
          return { ...h, internal: "[image data excluded]" };
        }
        return h;
      });
    }

    snapshot.memories.coldStorage = await getColdStorage(db);
    snapshot.memories.notebook = await getNotebook(db);
    snapshot.memories.observations = await getObservations(db);

    if (options.includeSummaries) {
      snapshot.memories.summaries = await getSummaries(db);
    }

    snapshot.memories.reminders = await getAllReminders(db);

    const allHistoryForRefs = await getHistory(db, 999999);
    const profilePicture = await getState(db, "profile_picture");
    snapshot.memories.imageRefs = extractImageRefs(
      allHistoryForRefs,
      profilePicture,
    );

    if (options.includeGallery) {
      let galleryEntries = allHistoryForRefs.filter(
        (h) =>
          (h.type === "art_result" || h.type === "user_art") &&
          h.internal?.startsWith("data:image"),
      );
      if (options.galleryLimit && options.galleryLimit > 0) {
        galleryEntries = galleryEntries.slice(-options.galleryLimit);
      }
      snapshot.media.gallery = galleryEntries.map((h) => ({
        id: h.id,
        type: h.type,
        content: h.content,
        image: h.internal,
        created_at: h.created_at,
      }));
    }

    if (options.includeBranches) {
      snapshot.branches.list = await getBranches(db);
      const activeBranch = await getActiveBranch(db);
      snapshot.branches.activeBranch = activeBranch?.name || "main";

      for (const branch of snapshot.branches.list) {
        if (branch.name !== "main") {
          const overrides = await getOverrides(db, branch.id);
          const synthetics = await getSyntheticMemories(db, branch.id);
          snapshot.branches.overrides.push(
            ...overrides.map((o) => ({ ...o, branchName: branch.name })),
          );
          snapshot.branches.synthetics.push(
            ...synthetics.map((s) => ({ ...s, branchName: branch.name })),
          );
        }
      }
    }

    const checksum = await calculateChecksum(snapshot);
    snapshot.meta.checksum = `sha256:${checksum}`;

    const jsonString = JSON.stringify(snapshot);
    if (jsonString.length > MAX_EXPORT_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          error: "Export too large",
          size: jsonString.length,
          maxSize: MAX_EXPORT_SIZE_BYTES,
          suggestion: "Try reducing historyLimit or excluding media",
        }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${options.name.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().slice(0, 10)}.personality.json"`,
      },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function handleExportGallery(
  db: DrizzleD1,
  request: Request,
  url: URL,
  env: PersonalityEnv,
) {
  try {
    const allHistory = await getHistory(db, 999999);
    const profilePicture = await getState(db, "profile_picture");

    const gallery = buildGalleryExport(allHistory, profilePicture);

    if (gallery.images.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No images found",
          message: "Gallery is empty - no images to export",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const jsonString = JSON.stringify(gallery);

    if (jsonString.length > MAX_EXPORT_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          error: "Gallery export too large",
          size: jsonString.length,
          maxSize: MAX_EXPORT_SIZE_BYTES,
          imageCount: gallery.images.length,
          suggestion:
            "Gallery exports are limited to 50MB. Consider archiving older images.",
        }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    const filename = `gallery-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("Gallery export error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// =============================================================================
// IMPORT HANDLERS
// =============================================================================

export async function handleImportGallery(
  db: DrizzleD1,
  request: Request,
  deps?: SnapshotDeps,
) {
  try {
    const bodyText = await request.text();
    if (!bodyText) {
      return new Response(JSON.stringify({ error: "Request body is empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (bodyText.length > MAX_EXPORT_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          error: "Gallery import exceeds size limit",
          size: bodyText.length,
          maxSize: MAX_EXPORT_SIZE_BYTES,
        }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    let gallery;
    try {
      gallery = JSON.parse(bodyText);
    } catch (error: unknown) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body",
          message: error instanceof Error ? error.message : String(error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      !gallery ||
      typeof gallery !== "object" ||
      !gallery.manifest ||
      !Array.isArray(gallery.images)
    ) {
      return new Response(
        JSON.stringify({
          error: "Invalid gallery format",
          message: "Gallery must include manifest and images[]",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (gallery.images.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Gallery includes no images to import",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const pendingRaw = await getState(db, "pending_image_refs");
    if (!pendingRaw) {
      return new Response(
        JSON.stringify({
          error: "No pending imageRefs to hydrate. Import personality first.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let pendingState;
    try {
      pendingState = JSON.parse(pendingRaw);
    } catch (error: unknown) {
      console.error("Invalid pending_image_refs JSON:", error);
      return new Response(
        JSON.stringify({
          error:
            "Pending imageRefs state is corrupted. Re-import personality snapshot.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const pendingRefs = Array.isArray(pendingState?.refs)
      ? pendingState.refs
      : [];
    if (pendingRefs.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No pending imageRefs to hydrate. Import personality first.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const pendingMap = new Map(pendingRefs.map((ref: any) => [ref.id, ref]));
    const matchedIds = new Set();
    const restoredHistory = [];
    const warnings = [];
    let restoredProfilePicture = false;
    let unmatchedGalleryImages = 0;

    for (const image of gallery.images) {
      if (!image?.id) {
        warnings.push("Encountered gallery image without an id.");
        unmatchedGalleryImages++;
        continue;
      }

      const pendingRef = pendingMap.get(image.id) as
        | Record<string, any>
        | undefined;
      if (!pendingRef) {
        unmatchedGalleryImages++;
        continue;
      }

      if (matchedIds.has(image.id)) {
        continue;
      }

      if (
        !image.base64 ||
        typeof image.base64 !== "string" ||
        !image.base64.startsWith("data:image")
      ) {
        warnings.push(
          `Image ${image.id} is missing base64 data or format is invalid.`,
        );
        unmatchedGalleryImages++;
        continue;
      }

      if (pendingRef.target === "history") {
        if (!pendingRef.historyId) {
          warnings.push(
            `Pending ref ${image.id} is missing historyId. Re-import personality snapshot.`,
          );
          unmatchedGalleryImages++;
          continue;
        }
        const field = pendingRef.field === "content" ? "content" : "internal";
        const raw = db.$client;
        await raw
          .prepare(`UPDATE history SET ${field} = ? WHERE id = ?`)
          .bind(image.base64, pendingRef.historyId)
          .run();
        restoredHistory.push({
          id: image.id,
          historyId: pendingRef.historyId,
          field,
          imageType: pendingRef.imageType,
        });
        matchedIds.add(image.id);
      } else if (pendingRef.target === "profile") {
        // Use injected resizeImage if available, otherwise store as-is
        let thumbnailBase64 = image.base64;
        if (deps?.resizeImage) {
          const thumbnail = deps.resizeImage(image.base64, 256, 70);
          thumbnailBase64 = thumbnail.base64 || image.base64;
        }
        const timestamp = new Date().toISOString();
        await setState(db, "profile_picture", image.base64);
        await setState(db, "profile_picture_thumbnail", thumbnailBase64);
        await setState(db, "profile_picture_timestamp", timestamp);
        restoredProfilePicture = true;
        matchedIds.add(image.id);
      } else {
        warnings.push(
          `Unknown pending target "${pendingRef.target}" for image ${image.id}.`,
        );
        unmatchedGalleryImages++;
      }
    }

    const remainingRefs = pendingRefs.filter(
      (ref: any) => !matchedIds.has(ref.id),
    );
    const updatedPendingState =
      remainingRefs.length > 0
        ? {
            version: "1.0",
            updatedAt: new Date().toISOString(),
            refs: remainingRefs,
          }
        : {
            version: "1.0",
            updatedAt: null,
            refs: [],
          };

    await setState(
      db,
      "pending_image_refs",
      remainingRefs.length > 0 ? JSON.stringify(updatedPendingState) : null,
    );

    const responseBody = {
      success: true,
      imagesProcessed: gallery.images.length,
      imagesRestored: matchedIds.size,
      restoredHistoryEntries: restoredHistory,
      restoredProfilePicture,
      unmatchedGalleryImages,
      pendingImageRefs: updatedPendingState,
      warnings,
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Gallery import error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function handleImportPersonality(
  db: DrizzleD1,
  request: Request,
  url: URL,
  env: PersonalityEnv,
) {
  try {
    const mode = url.searchParams.get("mode") || "branch";
    const snapshot = (await request.json()) as any;
    const snapshotImageRefs = Array.isArray(snapshot.memories?.imageRefs)
      ? snapshot.memories.imageRefs
      : [];
    const imageRefIndex = new Map(
      snapshotImageRefs.map((ref: any) => [ref.id, ref]),
    );

    const validation = validateSnapshotFormat(snapshot);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: "Invalid snapshot format",
          details: validation.errors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const checksumValid = await verifyChecksum(snapshot);
    if (!checksumValid) {
      return new Response(
        JSON.stringify({
          error: "Checksum verification failed",
          message: "Snapshot may have been modified or corrupted",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!["replace", "merge", "branch"].includes(mode)) {
      return new Response(
        JSON.stringify({
          error: "Invalid import mode",
          validModes: ["replace", "merge", "branch"],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (mode === "replace") {
      const body = (await request.clone().json()) as Record<string, any>;
      if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
        return new Response(
          JSON.stringify({
            error: "Replace mode requires ADMIN_PASSWORD",
            message: 'Include {"password": "<ADMIN_PASSWORD>"} in request body',
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const result: Record<string, any> = {
      mode,
      imported: {
        state: 0,
        history: 0,
        coldStorage: 0,
        notebook: 0,
        observations: 0,
        summaries: 0,
        reminders: 0,
      },
      warnings: [] as string[],
      imageRefsImported: 0,
      pendingImageRefs: {
        version: "1.0",
        updatedAt: null as string | null,
        refs: [] as any[],
      },
    };

    switch (mode) {
      case "replace":
        return new Response(
          JSON.stringify({
            error: "Replace mode not yet implemented",
            message: "Use branch or merge mode instead",
          }),
          { status: 501, headers: { "Content-Type": "application/json" } },
        );

      case "merge": {
        const pendingRefs = [];
        for (const entry of snapshot.memories.history || []) {
          try {
            const insertResult = await logHistory({
              db,
              type: entry.type,
              content: entry.content,
              internal: entry.internal,
            });
            result.imported.history++;

            const placeholderField = detectImagePlaceholderField(entry);
            if (placeholderField) {
              const exportHistoryId = parseExportedHistoryId(entry.id);
              if (exportHistoryId === null) {
                result.warnings.push(
                  "Image placeholder detected but history entry id was missing or invalid.",
                );
              } else {
                const refKey = `hist_${exportHistoryId}`;
                const matchingRef = imageRefIndex.get(refKey);
                if (matchingRef) {
                  pendingRefs.push({
                    ...matchingRef,
                    target: "history",
                    historyId: insertResult!.id,
                    field: placeholderField,
                    sourceExportId: exportHistoryId,
                  });
                } else {
                  result.warnings.push(
                    `Image placeholder found for history entry ${exportHistoryId} but no matching imageRef exists in snapshot.`,
                  );
                }
              }
            }
          } catch (e: unknown) {
            result.warnings.push(
              `Failed to import history entry: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        for (const entry of snapshot.memories.coldStorage || []) {
          try {
            await addColdStorage(db, entry.content, entry.context);
            result.imported.coldStorage++;
          } catch (e: unknown) {
            result.warnings.push(
              `Failed to import cold storage entry: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        for (const entry of snapshot.memories.notebook || []) {
          try {
            await saveNote(db, entry.title, entry.content, entry.summary);
            result.imported.notebook++;
          } catch (e: unknown) {
            result.warnings.push(
              `Failed to import notebook entry: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        for (const entry of snapshot.memories.observations || []) {
          try {
            await saveObservation(
              db,
              entry.title,
              entry.content,
              entry.summary,
            );
            result.imported.observations++;
          } catch (e: unknown) {
            result.warnings.push(
              `Failed to import observation: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        if (snapshot.memories.summaries) {
          for (const entry of snapshot.memories.summaries) {
            try {
              await addSummary(
                db,
                entry.summary,
                entry.message_count,
                entry.covered_range,
              );
              result.imported.summaries++;
            } catch (e: unknown) {
              result.warnings.push(
                `Failed to import summary: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        }

        for (const entry of snapshot.memories.reminders || []) {
          if (!entry.dismissed_at) {
            try {
              await addReminder(db, entry.content, entry.condition);
              result.imported.reminders++;
            } catch (e: unknown) {
              result.warnings.push(
                `Failed to import reminder: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        }

        for (const [key, value] of Object.entries(snapshot.state || {})) {
          if (
            (EXPORTABLE_STATE_KEYS as readonly string[]).includes(key) &&
            value !== null
          ) {
            await setState(db, key, String(value));
            result.imported.state++;
          }
        }
        const profileRef = imageRefIndex.get("profile");
        if (profileRef) {
          pendingRefs.push({
            ...profileRef,
            target: "profile",
          });
        }

        const pendingState =
          pendingRefs.length > 0
            ? {
                version: "1.0",
                updatedAt: new Date().toISOString(),
                refs: pendingRefs,
              }
            : {
                version: "1.0",
                updatedAt: null,
                refs: [],
              };

        await setState(
          db,
          "pending_image_refs",
          pendingRefs.length > 0 ? JSON.stringify(pendingState) : null,
        );
        result.imageRefsImported = pendingRefs.length;
        result.pendingImageRefs = pendingState;
        break;
      }

      case "branch": {
        const branchName = `imported-${new Date().toISOString().slice(0, 10)}`;
        try {
          await createBranch(
            db,
            branchName,
            `Imported from ${snapshot.meta?.name || "unknown"}`,
          );
          result.branchCreated = branchName;
          result.warnings.push(
            "Branch mode created empty branch. Use merge mode to import memories.",
          );
        } catch (e: unknown) {
          if (
            e instanceof Error
              ? e.message
              : String(e).includes("UNIQUE constraint")
          ) {
            result.warnings.push(`Branch ${branchName} already exists`);
          } else {
            throw e;
          }
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function handleValidateSnapshot(db: DrizzleD1, request: Request) {
  try {
    const snapshot = (await request.json()) as any;

    const formatValidation = validateSnapshotFormat(snapshot);
    const checksumValid = snapshot.meta?.checksum
      ? await verifyChecksum(snapshot)
      : null;

    const stats = {
      historyCount: snapshot.memories?.history?.length || 0,
      coldStorageCount: snapshot.memories?.coldStorage?.length || 0,
      notebookCount: snapshot.memories?.notebook?.length || 0,
      observationsCount: snapshot.memories?.observations?.length || 0,
      summariesCount: snapshot.memories?.summaries?.length || 0,
      remindersCount: snapshot.memories?.reminders?.length || 0,
      galleryCount: snapshot.media?.gallery?.length || 0,
      branchCount: snapshot.branches?.list?.length || 0,
    };

    const jsonSize = JSON.stringify(snapshot).length;

    return new Response(
      JSON.stringify({
        valid: formatValidation.valid,
        errors: formatValidation.errors,
        checksumValid,
        stats,
        estimatedSize: jsonSize,
        version: snapshot.meta?.version,
        exportedAt: snapshot.meta?.exportedAt,
        sourceHost: snapshot.meta?.sourceHost,
        name: snapshot.meta?.name,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        valid: false,
        errors: [
          `Failed to parse snapshot: ${error instanceof Error ? error.message : String(error)}`,
        ],
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function handlePreviewImport(db: DrizzleD1, request: Request) {
  try {
    const snapshot = (await request.json()) as any;

    const validation = validateSnapshotFormat(snapshot);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: "Invalid snapshot format",
          details: validation.errors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const currentHistory = await getHistory(db);
    const currentColdStorage = await getColdStorage(db);
    const currentNotebook = await getNotebookIndex(db);
    const currentObservations = await getObservationIndex(db);
    const currentSummaries = await getSummaries(db);
    const currentReminders = await getReminders(db);

    const preview = {
      current: {
        history: currentHistory.length,
        coldStorage: currentColdStorage.length,
        notebook: currentNotebook.length,
        observations: currentObservations.length,
        summaries: currentSummaries.length,
        reminders: currentReminders.length,
      },
      incoming: {
        history: snapshot.memories?.history?.length || 0,
        coldStorage: snapshot.memories?.coldStorage?.length || 0,
        notebook: snapshot.memories?.notebook?.length || 0,
        observations: snapshot.memories?.observations?.length || 0,
        summaries: snapshot.memories?.summaries?.length || 0,
        reminders: snapshot.memories?.reminders?.length || 0,
      },
      afterMerge: {
        history:
          currentHistory.length + (snapshot.memories?.history?.length || 0),
        coldStorage:
          currentColdStorage.length +
          (snapshot.memories?.coldStorage?.length || 0),
        notebook:
          currentNotebook.length + (snapshot.memories?.notebook?.length || 0),
        observations:
          currentObservations.length +
          (snapshot.memories?.observations?.length || 0),
        summaries:
          currentSummaries.length + (snapshot.memories?.summaries?.length || 0),
        reminders:
          currentReminders.length +
          (snapshot.memories?.reminders?.filter((r: any) => !r.dismissed_at)
            ?.length || 0),
      },
      snapshotMeta: snapshot.meta,
    };

    return new Response(JSON.stringify(preview), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
