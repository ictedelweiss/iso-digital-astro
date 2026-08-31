/**
 * Shared input validation helpers.
 *
 * Signatures are stored as raw strings and later interpolated into document
 * HTML (`<img src="...">`), so an unvalidated value is a stored-XSS vector.
 * Everything accepted from a client is checked here before it is persisted.
 */

/** Accept PNG or JPEG data URLs only — never `javascript:`, `http:`, or SVG. */
const DATA_IMAGE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

/** ~384 KB of binary once decoded; real signature PNGs are a few KB. */
const MAX_SIGNATURE_LENGTH = 512_000;

export function isValidSignature(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_SIGNATURE_LENGTH) return false;
  return DATA_IMAGE_RE.test(value);
}

/** Trim and bound a free-text field. */
export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  // Strip control characters; keep normal whitespace and unicode letters.
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength);
}

export function sanitizeEmail(value: unknown, maxLength = 254): string {
  const email = sanitizeText(value, maxLength).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

/** Escape for safe interpolation into HTML attribute or text position. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] as string
  );
}

/** Standard JSON responses so handlers stop leaking `err.message`. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
}
