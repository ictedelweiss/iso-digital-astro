import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { meetings, meetingAttendees, users } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { parseBody, attendSchema } from '../../../../lib/schemas';
import { errorResponse, json, sanitizeEmail } from '../../../../lib/validation';
import { recordAudit } from '../../../../lib/audit';

/**
 * Public by design: external guests scan a QR code and sign in without an
 * account. Because it is unauthenticated, every field is validated against a
 * schema and identity is taken from the session whenever one exists — never
 * from the request body.
 */
export const POST: APIRoute = async ({ request, params, locals }) => {
  const meetingId = params.id;
  if (!meetingId) return errorResponse(400, 'Meeting ID required.');

  // Validate before touching the database: the signature check is the stored-XSS
  // guard, and rejecting bad input early avoids pointless I/O.
  const parsed = await parseBody(request, attendSchema);
  if (!parsed.ok) {
    const sessionUser = locals.user;
    return json(
      {
        error: 'SIGNATURE_REQUIRED',
        message: sessionUser
          ? 'Tanda tangan digital Anda belum terdaftar. Silakan daftarkan tanda tangan melalui menu profil terlebih dahulu.'
          : 'Data absensi tidak valid. Pastikan nama dan tanda tangan terisi (format PNG/JPEG).',
      },
      400
    );
  }

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(503, 'Database is not available.');

  const db = drizzle(env.DB);
  const body = parsed.data;
  const sessionUser = locals.user;

  try {
    // Confirm the meeting exists (also keeps attendee rows orphan-free).
    const meeting = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);
    if (meeting.length === 0) return errorResponse(404, 'Meeting not found.');

    const userId = sessionUser?.msId ?? null;

    // Internal users: deduplicate on their stable Entra id.
    if (userId) {
      const existing = await db
        .select({ id: meetingAttendees.id })
        .from(meetingAttendees)
        .where(and(eq(meetingAttendees.meetingId, meetingId), eq(meetingAttendees.userId, userId)))
        .limit(1);
      if (existing.length > 0) {
        return json(
          { error: 'DUPLICATE_ATTENDANCE', message: 'Anda sudah mengisi daftar hadir untuk rapat ini.' },
          409
        );
      }
    }

    // External guests: deduplicate on email when one was supplied.
    const guestEmail = sanitizeEmail(body.email);
    if (!userId && guestEmail) {
      const existing = await db
        .select({ id: meetingAttendees.id })
        .from(meetingAttendees)
        .where(and(eq(meetingAttendees.meetingId, meetingId), eq(meetingAttendees.email, guestEmail)))
        .limit(1);
      if (existing.length > 0) {
        return json(
          { error: 'DUPLICATE_ATTENDANCE', message: 'Anda sudah mengisi daftar hadir untuk rapat ini.' },
          409
        );
      }
    }

    let name = '';
    let division = '-';
    let email: string | null = null;
    let signaturePath: string | null = body.signaturePath ?? null;

    // Signed-in users are identified by their directory profile so they cannot
    // submit an attendance under someone else's name.
    if (sessionUser) {
      name = sessionUser.displayName;
      division = sessionUser.department || '-';
      email = sessionUser.email || null;

      // If client didn't supply signaturePath, load from database
      if (!signaturePath && sessionUser.id) {
        const userRow = await db
          .select({ signatureData: users.signatureData, hasSignature: users.hasSignature })
          .from(users)
          .where(eq(users.id, sessionUser.id))
          .limit(1);

        if (userRow[0]?.hasSignature && userRow[0]?.signatureData) {
          signaturePath = userRow[0].signatureData;
        }
      }

      if (!signaturePath) {
        return json(
          {
            error: 'SIGNATURE_REQUIRED',
            message: 'Tanda tangan digital Anda belum terdaftar. Silakan daftarkan tanda tangan melalui menu profil terlebih dahulu.',
          },
          400
        );
      }
    } else {
      if (!body.name) return errorResponse(400, 'Nama wajib diisi.');
      if (!signaturePath) {
        return json(
          {
            error: 'SIGNATURE_REQUIRED',
            message: 'Data absensi tidak valid. Pastikan nama dan tanda tangan terisi (format PNG/JPEG).',
          },
          400
        );
      }
      name = body.name;
      division = body.division || '-';
      email = guestEmail;
    }

    const result = await db
      .insert(meetingAttendees)
      .values({
        meetingId,
        userId,
        name,
        division,
        email,
        signaturePath,
      })
      .returning({ id: meetingAttendees.id });

    await recordAudit(db, {
      entityType: 'meeting',
      entityId: meetingId,
      action: 'created',
      notes: `Attendance: ${name}`,
      actor: sessionUser ?? null,
    });

    return json({ success: true, id: result[0].id }, 201);
  } catch {
    console.error('Failed to record attendance for meeting.');
    return errorResponse(500, 'Gagal menyimpan daftar hadir.');
  }
};
