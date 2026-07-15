export const MAX_QUOTE_RESEND_RECIPIENTS = 5;

export function normalizeQuoteResendEmails(
  emails: unknown,
  emailRegex: RegExp,
): { ok: true; emails: string[] } | { ok: false; error: string } {
  if (!Array.isArray(emails)) {
    return { ok: false, error: 'emails debe ser un arreglo' };
  }

  const normalized = emails
    .map((email) => (typeof email === 'string' ? email.trim() : ''))
    .filter(Boolean);

  if (normalized.length === 0) {
    return { ok: false, error: 'Debes ingresar al menos un correo electrónico' };
  }

  if (normalized.length > MAX_QUOTE_RESEND_RECIPIENTS) {
    return { ok: false, error: 'Máximo 5 correos electrónicos' };
  }

  const unique = new Map<string, string>();
  for (const email of normalized) {
    if (!emailRegex.test(email)) {
      return { ok: false, error: `El correo ${email} no es válido` };
    }
    const key = email.toLowerCase();
    if (unique.has(key)) {
      return { ok: false, error: 'No repitas correos electrónicos' };
    }
    unique.set(key, email);
  }

  return { ok: true, emails: Array.from(unique.values()) };
}
