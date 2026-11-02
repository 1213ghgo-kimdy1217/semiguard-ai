/** Legacy cookies are version zero; a password reset invalidates them everywhere. */
export function sessionMatchesUser(session: { authVersion?: number }, user: { authVersion?: number }) {
  const signed = session.authVersion === undefined ? 0 : session.authVersion;
  const current = user.authVersion === undefined ? 0 : user.authVersion;
  return Number.isSafeInteger(signed) && signed >= 0 && Number.isSafeInteger(current) && current >= 0 && signed === current;
}
