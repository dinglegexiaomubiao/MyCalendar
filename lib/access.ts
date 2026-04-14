export const ALLOWED_NAMES = ["李", "饶"];

export function hasAccess(name?: string | null) {
  return !!name && ALLOWED_NAMES.includes(name);
}
