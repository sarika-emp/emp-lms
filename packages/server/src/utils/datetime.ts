// ============================================================================
// DATETIME
// MySQL DATETIME columns reject the ISO-8601 "YYYY-MM-DDTHH:MM:SS.sssZ" string
// under STRICT_TRANS_TABLES. Format to "YYYY-MM-DD HH:MM:SS" for inserts.
// ============================================================================

export function mysqlDateTime(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
