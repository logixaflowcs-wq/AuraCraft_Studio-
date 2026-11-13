// FIX(audit-3-D): UUIDs prevent scene identity collisions after delete/re-add operations.
export const createSceneId = (): string => crypto.randomUUID();
