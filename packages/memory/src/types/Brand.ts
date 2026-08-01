/**
 * Branded type utility for compile-time ID safety.
 *
 * The __brand property doesn't exist at runtime, but TypeScript
 * tracks it at compile time. This prevents accidentally passing
 * a HistoryId where a SummaryId is expected.
 *
 * @pattern branded-types — phantom type for nominal typing
 * @antipattern Do NOT use branded types for non-ID values
 */
export type Brand<T, B> = T & { readonly __brand: B };
