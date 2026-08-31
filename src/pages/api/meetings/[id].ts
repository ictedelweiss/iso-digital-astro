import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { meetings, meetingAttendees } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { parseBody, meetingUpdateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';
import { hasRole } from '../../../lib/session';

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const meetingId = params.id;
  if (!meetingId) return errorResponse(400, 'Invalid meeting ID.');

  const parsed = await parseBody(request, meetingUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;

    const existing = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);
    const meeting = existing[0];
    if (!meeting) return errorResponse(404, 'Meeting not found.');

    if (!hasRole(user, 'coordinator')) {
      return errorResponse(403, 'Only coordinators and above can edit meetings.');
    }

    await db
      .update(meetings)
      .set({
        title: body.title ?? meeting.title,
        date: body.date ?? meeting.date,
        time: body.time ?? meeting.time,
        location: body.location ?? meeting.location,
        leader: body.leader ?? meeting.leader,
        status: body.status ?? meeting.status,
      })
      .where(eq(meetings.id, meetingId));

    await recordAudit(db, {
      entityType: 'meeting',
      entityId: meetingId,
      action: 'updated',
      notes: body.title,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to update meeting.');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const meetingId = params.id;
  if (!meetingId) return errorResponse(400, 'Invalid meeting ID.');

  try {
    const db = drizzle(env.DB);
    if (!hasRole(user, 'admin')) {
      return errorResponse(403, 'Only administrators can delete meetings.');
    }

    const existing = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);
    const meeting = existing[0];
    if (!meeting) return errorResponse(404, 'Meeting not found.');

    // Attendance rows hold names, emails and signatures. Orphaning them would
    // leave personal data with no parent document and no retention rule, so
    // they go with the meeting. The deletion itself is audited.
    await db.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, meetingId));
    await db.delete(meetings).where(eq(meetings.id, meetingId));

    await recordAudit(db, {
      entityType: 'meeting',
      entityId: meetingId,
      action: 'deleted',
      notes: meeting.title,
      actor: user,
    });

    return json({ success: true });
  } catch {
    return errorResponse(500, 'Failed to delete meeting.');
  }
};
