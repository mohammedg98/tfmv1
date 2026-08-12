/**
 * Normalize a user-facing dataset name for storage (PostgreSQL table name).
 * - lowercase
 * - spaces → underscores
 * - collapse repeated underscores
 * - trim leading/trailing underscores
 */
export function normalizeDatasetName(raw) {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const RESERVED = [
  "null",
  "undefined",
  "select",
  "insert",
  "delete",
  "update",
  "drop",
  "create",
];

/**
 * Validate the name the user types (spaces + mixed case allowed).
 * Returns an error message, or "" if OK.
 */
export function validateDatasetNameInput(raw) {
  if (!raw || !String(raw).trim()) {
    return "Dataset name is required!";
  }

  const trimmed = String(raw).trim();

  // Allow letters, digits, underscore and spaces while typing
  if (!/^[a-zA-Z_][a-zA-Z0-9_ ]{0,62}$/.test(trimmed)) {
    return "Use letters, numbers, spaces or underscores. Must start with a letter. Max ~50 characters after cleanup.";
  }

  const normalized = normalizeDatasetName(trimmed);
  if (!normalized) {
    return "Dataset name is required!";
  }
  if (normalized[0] >= "0" && normalized[0] <= "9") {
    return "Name cannot start with a number (after cleanup).";
  }
  if (!/^[a-z_][a-z0-9_]{0,49}$/.test(normalized)) {
    return "After cleanup, only letters, numbers and underscores are kept (max 50 characters).";
  }
  if (RESERVED.includes(normalized)) {
    return "This name is reserved and cannot be used";
  }

  return "";
}
