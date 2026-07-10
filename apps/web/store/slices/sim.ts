/**
 * Semantic Identity Monitor slice
 *
 * @module store/slices/sim
 * @description Zustand slice responsible for basin metrics, trajectory data,
 * concept axes, anomalies, and SIM data export.
 *
 * @downstream Calls: api/client for /sim/* endpoints
 */

import api from "../../api/client";
import type { StateCreator } from "zustand";
import type { AppState } from "../types";

/** Global basin statistics returned by /sim/basin */
export interface SIMGlobalMetrics {
  sampleCount?: number;
  meanDistance?: number;
  outlierThreshold?: number;
  computedAt?: string;
  [key: string]: unknown;
}

/** Latest entry basin info */
export interface SIMLatestEntry {
  isOutlier?: boolean;
  distance?: number;
  zScore?: number;
  [key: string]: unknown;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/** Top-level basin metrics object stored in the slice */
export interface SIMBasinMetrics {
  global?: SIMGlobalMetrics;
  latestByType?: Record<string, SIMLatestEntry>;
  typeBasinReference?: Record<string, SIMGlobalMetrics>;
  outliersFlaggedByType?: Record<string, number>;
  crossType?: Record<string, unknown>;
  freshness?: Record<string, unknown>;
  outlierCount?: number;
  [key: string]: unknown;
}

/** A single trajectory point from /sim/basin/trajectory */
export interface SIMTrajectoryPoint {
  id: number | string;
  timestamp: string;
  distance: number;
  zScore: number;
  type: string;
  table?: string;
  content?: string;
  [key: string]: unknown;
}

/** A concept axis from /sim/axes */
export interface SIMAxis {
  id: number;
  name?: string;
  description?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

/** An anomaly flag from /sim/anomalies */
export interface SIMAnomaly {
  id?: number;
  type?: string;
  resolved?: boolean;
  [key: string]: unknown;
}

export interface SIMSlice {
  // State
  simBasinMetrics: SIMBasinMetrics | null;
  simTrajectoryPoints: SIMTrajectoryPoint[];
  simLoading: boolean;
  simError: string | null;
  simAxes: SIMAxis[];
  simAxesLoading: boolean;
  simAnomalies: SIMAnomaly[];

  // Setters
  setSIMBasinMetrics: (metrics: SIMBasinMetrics | null) => void;
  setSIMLoading: (loading: boolean) => void;
  setSIMError: (error: string | null) => void;

  // Actions
  fetchBasinMetrics: () => Promise<void>;
  computeBasin: () => Promise<Record<string, unknown>>;
  fetchTrajectory: (
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  fetchAxes: () => Promise<void>;
  createAxis: (
    axisData: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  updateAxisAction: (
    axisId: number,
    updates: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  deleteAxisAction: (axisId: number) => Promise<Record<string, unknown>>;
  fetchAnomalies: (options?: Record<string, unknown>) => Promise<void>;
  exportSIMData: (options?: Record<string, unknown>) => Promise<void>;
}

export const createSIMSlice: StateCreator<AppState, [], [], SIMSlice> = (
  set,
  get,
) => ({
  /** @type {SIMBasinMetrics|null} Latest basin payload from /sim/basin */
  simBasinMetrics: null as SIMBasinMetrics | null,

  /** @type {SIMTrajectoryPoint[]} Trajectory points for visualization */
  simTrajectoryPoints: [] as SIMTrajectoryPoint[],

  /** @type {boolean} Loading flag for basin fetch */
  simLoading: false,

  /** @type {string|null} Last error message */
  simError: null as string | null,

  /** @type {SIMAxis[]} Concept axes from /sim/axes */
  simAxes: [] as SIMAxis[],

  /** @type {boolean} Loading flag for axes fetch */
  simAxesLoading: false,

  /** @type {SIMAnomaly[]} Anomaly flags from /sim/anomalies */
  simAnomalies: [] as SIMAnomaly[],

  setSIMBasinMetrics: (metrics: SIMBasinMetrics | null) =>
    set({ simBasinMetrics: metrics }),
  setSIMLoading: (loading: boolean) => set({ simLoading: loading }),
  setSIMError: (error: string | null) => set({ simError: error }),

  /**
   * Fetches current basin metrics summary.
   * @returns {Promise<void>}
   */
  fetchBasinMetrics: async () => {
    set({ simLoading: true, simError: null });
    try {
      const data = await api.get("/sim/basin");
      set({ simBasinMetrics: data, simLoading: false });
    } catch (err: unknown) {
      set({
        simError: err instanceof Error ? err.message : String(err),
        simLoading: false,
      });
    }
  },

  /**
   * Triggers recompute of basin metrics.
   * @returns {Promise<Object>} API response
   */
  computeBasin: async () => {
    set({ simError: null });
    try {
      const data = await api.post("/sim/basin/compute", {});
      if (data.success) {
        set((state) => ({
          simBasinMetrics: {
            ...(state.simBasinMetrics ?? {}),
            global: data.global as SIMGlobalMetrics,
          } as SIMBasinMetrics,
        }));
      }
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ simError: message });
      return { success: false, error: message };
    }
  },

  /**
   * Fetches trajectory points with optional filters.
   * @param {{limit?: number, entryTypes?: string|string[]}} [options]
   * @returns {Promise<Object>}
   */
  fetchTrajectory: async (options: Record<string, unknown> = {}) => {
    set({ simError: null });
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set("limit", String(options.limit));
      if (options.entryTypes) {
        const value = Array.isArray(options.entryTypes)
          ? options.entryTypes.join(",")
          : String(options.entryTypes);
        if (value) params.set("entryTypes", value);
      }
      const query = params.toString();
      const data = await api.get(
        `/sim/basin/trajectory${query ? `?${query}` : ""}`,
      );

      set((state) => ({
        simTrajectoryPoints: (data.points as SIMTrajectoryPoint[]) || [],
        simBasinMetrics: data.metrics
          ? ({
              ...(state.simBasinMetrics ?? {}),
              global: data.metrics as SIMGlobalMetrics,
            } as SIMBasinMetrics)
          : state.simBasinMetrics,
      }));
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ simError: message });
      return { success: false, error: message };
    }
  },

  /**
   * Fetches all concept axes from /sim/axes.
   * @returns {Promise<void>}
   */
  fetchAxes: async () => {
    set({ simAxesLoading: true, simError: null });
    try {
      const data = await api.get("/sim/axes");
      set({
        simAxes: (data.axes as SIMAxis[]) || [],
        simAxesLoading: false,
      });
    } catch (err: unknown) {
      set({
        simError: err instanceof Error ? err.message : String(err),
        simAxesLoading: false,
      });
    }
  },

  /**
   * Creates a new concept axis via POST /sim/axes.
   * @param {{name: string, description?: string, positiveExamples?: string[], negativeExamples?: string[]}} axisData
   * @returns {Promise<Object>} API response with created axis id
   */
  createAxis: async (axisData: Record<string, unknown>) => {
    set({ simError: null });
    try {
      const data = await api.post("/sim/axes", axisData);
      if (data.success) {
        // Re-fetch axes to get the full list with the new entry
        await get().fetchAxes();
      }
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ simError: message });
      return { success: false, error: message };
    }
  },

  /**
   * Updates an existing concept axis via PUT /sim/axes/:id.
   * @param {number} axisId
   * @param {Object} updates - Fields to update (name, description, positiveExamples, negativeExamples, isActive)
   * @returns {Promise<Object>} API response
   */
  updateAxisAction: async (
    axisId: number,
    updates: Record<string, unknown>,
  ) => {
    set({ simError: null });
    try {
      const data = await api.put(`/sim/axes/${axisId}`, updates);
      // Re-fetch axes to reflect changes
      await get().fetchAxes();
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ simError: message });
      return { success: false, error: message };
    }
  },

  /**
   * Deletes a concept axis via DELETE /sim/axes/:id.
   * @param {number} axisId
   * @returns {Promise<Object>} API response
   */
  deleteAxisAction: async (axisId: number) => {
    set({ simError: null });
    try {
      const data = await api.delete(`/sim/axes/${axisId}`);
      if (data.success) {
        // Remove from local state immediately
        set((state) => ({
          simAxes: state.simAxes.filter((a) => a.id !== axisId),
        }));
      }
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ simError: message });
      return { success: false, error: message };
    }
  },

  /**
   * Fetches anomaly flags from /sim/anomalies.
   * @param {{unresolvedOnly?: boolean, limit?: number}} [options]
   * @returns {Promise<void>}
   */
  fetchAnomalies: async (options: Record<string, unknown> = {}) => {
    set({ simError: null });
    try {
      const params = new URLSearchParams();
      if (options.unresolvedOnly) params.set("unresolved", "true");
      if (options.limit) params.set("limit", String(options.limit));
      const query = params.toString();
      const data = await api.get(`/sim/anomalies${query ? `?${query}` : ""}`);
      set({ simAnomalies: (data.anomalies as SIMAnomaly[]) || [] });
    } catch (err: unknown) {
      set({ simError: err instanceof Error ? err.message : String(err) });
    }
  },

  /**
   * Exports SIM data via /sim/export. Supports JSON download and CSV conversion.
   * @param {{format?: 'json'|'csv', includeEmbeddings?: boolean}} [options]
   * @returns {Promise<void>} Triggers browser download
   */
  exportSIMData: async (options: Record<string, unknown> = {}) => {
    set({ simError: null });
    try {
      const params = new URLSearchParams();
      if (options.includeEmbeddings) params.set("embeddings", "true");
      const query = params.toString();
      const data: Record<string, unknown> = await api.get(`/sim/export${query ? `?${query}` : ""}`);

      const format = options.format || "json";
      let blob: Blob;
      let filename: string;

      if (format === "csv") {
        // Convert trajectory array to CSV
        const rows = data.trajectory || [];
        if (rows.length === 0) {
          set({ simError: "No trajectory data to export" });
          return;
        }
        const headers = Object.keys(rows[0]).filter((k) => k !== "embedding");
        const csvLines = [headers.join(",")];
        for (const row of rows) {
          csvLines.push(
            headers
              .map((h) => {
                const val = row[h];
                if (val === null || val === undefined) return "";
                const str = String(val);
                return str.includes(",") ||
                  str.includes('"') ||
                  str.includes("\n")
                  ? `"${str.replace(/"/g, '""')}"`
                  : str;
              })
              .join(","),
          );
        }
        blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
        filename = `sim-export-${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        filename = `sim-export-${new Date().toISOString().slice(0, 10)}.json`;
      }

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      set({ simError: err instanceof Error ? err.message : String(err) });
    }
  },
});
