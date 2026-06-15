// ============================================================================
// SQL SORT SAFETY
// ORDER BY column/direction cannot be parameter-bound, so any sort/order that
// originates from the request must be whitelisted before it is interpolated
// into a raw query. Anything not on the allowlist falls back to a safe
// default. This closes the time-based blind injection via ?sort= / ?order=.
// ============================================================================

/**
 * Resolve a request-supplied sort column against an allowlist.
 * @param requested  the raw value from req.query.sort (may be anything)
 * @param allowed    the columns this query is allowed to sort by
 * @param fallback   used when `requested` is missing or not allowed
 */
export function safeSortColumn(
  requested: unknown,
  allowed: readonly string[],
  fallback: string,
): string {
  return typeof requested === "string" && allowed.includes(requested)
    ? requested
    : fallback;
}

/** Resolve a sort direction to exactly "ASC" or "DESC". */
export function safeSortOrder(requested: unknown): "ASC" | "DESC" {
  return String(requested).toLowerCase() === "asc" ? "ASC" : "DESC";
}
