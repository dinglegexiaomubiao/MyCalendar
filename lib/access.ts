export const ALLOWED_NAMES = ["李", "饶"];

export const PRIVILEGED_EMAILS = ["dinglegexiaomubiao@gmail.com"];

export function hasAccess(name?: string | null) {
  return !!name && ALLOWED_NAMES.includes(name);
}

export function isPrivilegedUser(email?: string | null) {
  return !!email && PRIVILEGED_EMAILS.includes(email);
}
