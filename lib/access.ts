export const PRIVILEGED_EMAILS = ["dinglegexiaomubiao@gmail.com"];

export function isPrivilegedUser(email?: string | null) {
  return !!email && PRIVILEGED_EMAILS.includes(email);
}
