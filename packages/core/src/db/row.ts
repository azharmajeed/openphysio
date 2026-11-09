/** uuid for synced rows. */
export const newId = (): string => crypto.randomUUID();

/** Sync columns for a fresh row: spread into an insert. */
export const newRow = (now = Date.now()) => ({ id: newId(), updatedAt: now, deletedAt: null });
