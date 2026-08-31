/**
 * Request validation schemas (M-05 fix).
 *
 * Handlers used to call `await request.json()` and write the values straight
 * into Drizzle — no type checks, no length limits, no range checks. A single
 * oversized or wrong-typed field could poison a record or blow the D1 quota.
 *
 * Every endpoint now parses its body against a schema first, and rejects
 * anything unexpected with a 400 rather than storing it.
 */
import { z } from 'zod';
import { isValidSignature } from './validation';

/** Accept PNG/JPEG data URLs only — blocks stored XSS via `<img src>`. */
const signature = z
  .string()
  .max(512_000)
  .refine(isValidSignature, 'Signature must be a PNG or JPEG data URL.');

/** Free text with control characters stripped and a hard length cap. */
const text = (max = 500) =>
  z
    .string()
    .max(max)
    .transform((value) => value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim());

const optionalText = (max = 500) => text(max).optional().nullable();

/** `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`; also blocks junk in date columns. */
const dateString = z
  .string()
  .max(30)
  .regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/, 'Invalid date format.');

const positiveInt = (max: number) => z.coerce.number().int().min(0).max(max);
const positiveNumber = (max: number) => z.coerce.number().min(0).max(max);

/**
 * Optional email address.
 *
 * The forms post an empty string when the field is left blank, so '' is
 * treated as "not supplied" rather than as a malformed address.
 */
const optionalEmail = z
  .string()
  .max(254)
  .optional()
  .nullable()
  .refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Invalid email address.'
  );

/* ------------------------------------------------------------------ *
 * Purchase requisitions
 * ------------------------------------------------------------------ */

const prItemSchema = z.object({
  item_name: text(200),
  qty: positiveNumber(1_000_000),
  unit: text(50),
  price: positiveNumber(1_000_000_000_000),
});

export const prCreateSchema = z.object({
  // The server generates the PR number itself; any client-supplied value is
  // ignored, so the field is optional and must not be required.
  pr_number: text(50).optional(),
  title: text(200),
  department: text(100),
  needed_date: dateString,
  budget_status: z.enum(['Dianggarkan', 'Belum dianggarkan']),
  notes: optionalText(2000),
  requester_signature: signature.optional().nullable(),
  items: z.array(prItemSchema).max(100).default([]),
});

/** `status`, `current_approval_step` and `approvals` are intentionally absent. */
export const prUpdateSchema = z.object({
  title: text(200),
  department: text(100),
  needed_date: dateString,
  budget_status: z.enum(['Dianggarkan', 'Belum dianggarkan']),
  notes: optionalText(2000),
  items: z.array(prItemSchema).max(100).optional(),
});

/* ------------------------------------------------------------------ *
 * Leave requests
 * ------------------------------------------------------------------ */

const leaveNumbers = {
  work_days: positiveInt(366),
  hak_prev: positiveInt(366),
  hak_curr: positiveInt(366),
  total_hak: positiveInt(732),
  taken_until: positiveInt(732),
  sisa_curr: positiveInt(732),
  request_days: positiveInt(366),
  sisa_after: positiveInt(732),
};

export const leaveCreateSchema = z.object({
  department: text(100),
  start_date: dateString,
  end_date: dateString,
  purpose: text(1000),
  ...leaveNumbers,
  signature_pemohon: signature.optional().nullable(),
});

export const leaveUpdateSchema = z.object({
  start_date: dateString,
  end_date: dateString,
  purpose: text(1000),
  work_days: leaveNumbers.work_days,
  request_days: leaveNumbers.request_days,
  sisa_after: leaveNumbers.sisa_after,
});

/* ------------------------------------------------------------------ *
 * Handover forms
 * ------------------------------------------------------------------ */

export const handoverCreateSchema = z.object({
  item_name: text(200),
  handover_date: dateString,
  recipient_name: text(200),
  recipient_email: optionalEmail,
  recipient_department: text(100),
  quantity: z.coerce.number().int().min(1).max(100_000).default(1),
  serial_number: optionalText(100),
  specification: optionalText(1000),
  loan_period: optionalText(100),
  item_condition: optionalText(100),
  notes: optionalText(2000),
  recipient_signature: signature.optional().nullable(),
});

export const handoverUpdateSchema = handoverCreateSchema.partial();

/* ------------------------------------------------------------------ *
 * Meetings
 * ------------------------------------------------------------------ */

export const meetingCreateSchema = z.object({
  title: text(200),
  date: dateString,
  time: z
    .string()
    .max(20)
    .regex(/^\d{1,2}[:.]\d{2}(\s*(AM|PM|WIB|WITA|WIT))?$/i, 'Invalid time format.'),
  location: text(200),
  leader: text(200),
});

export const meetingUpdateSchema = meetingCreateSchema
  .extend({ status: z.enum(['active', 'closed']).optional() })
  .partial();

/* ------------------------------------------------------------------ *
 * Meeting attendance (public endpoint — signed by external guests)
 * ------------------------------------------------------------------ */

export const attendSchema = z.object({
  name: optionalText(200),
  division: optionalText(100),
  email: optionalEmail,
  /** Field name matches the existing client payload. Optional here so server can pull from session / DB when omitted. */
  signaturePath: signature.optional().nullable(),
});

/* ------------------------------------------------------------------ *
 * Assets
 * ------------------------------------------------------------------ */

const assetFields = {
  asset_code: text(50),
  name: text(200),
  category: text(100),
  location: text(200),
  condition: text(50),
  status: text(50),
  serial_number: optionalText(100),
  purchase_date: dateString.optional().nullable(),
  value: positiveNumber(1_000_000_000_000_000).optional().nullable(),
  assigned_to: optionalText(200),
};

export const assetCreateSchema = z.object(assetFields);
export const assetUpdateSchema = z.object(assetFields).partial();

/* ------------------------------------------------------------------ *
 * User
 * ------------------------------------------------------------------ */

/** Field name matches the existing client payload. */
export const saveSignatureSchema = z.object({ signatureData: signature });

export const approvalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: optionalText(1000),
});

/**
 * Parse a JSON request body against a schema.
 *
 * Returns a ready-made 400 Response on failure so handlers stay short and the
 * error never echoes raw internals.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Request body must be valid JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'Validation failed.',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { ok: true, data: result.data };
}
