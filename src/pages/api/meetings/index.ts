import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { meetings, meetingAttendees } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { parseBody, meetingCreateSchema } from '../../../lib/schemas';
import { json, errorResponse } from '../../../lib/validation';
import { recordAudit } from '../../../lib/audit';

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  try {
    const db = drizzle(env.DB);
    const allMeetings = await db.select().from(meetings).orderBy(desc(meetings.createdAt));
    const allAttendees = await db.select().from(meetingAttendees);

    const formattedMeetings = allMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      time: m.time,
      location: m.location,
      leader: m.leader,
      status: m.status,
      attendees: allAttendees
        .filter((a) => a.meetingId === m.id)
        .map((a) => ({
          id: a.id,
          meeting_id: a.meetingId,
          name: a.name,
          division: a.division,
          email: a.email || '',
          signature_path: a.signaturePath,
          created_at: a.createdAt,
        })),
    }));

    return json({ success: true, data: formattedMeetings });
  } catch {
    return errorResponse(500, 'Failed to load meetings.');
  }
};

/**
 * Cryptographically random meeting identifier (M-02).
 *
 * The old value was `MTG-${Math.floor(Math.random() * 10000)}` — ten thousand
 * possibilities, trivially enumerable, and prone to silent collisions. A QR
 * code links straight to this id, so it has to be unguessable.
 */
function generateMeetingId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `MTG-${hex.slice(0, 12)}`;
}

async function uniqueMeetingId(db: any): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateMeetingId();
    const existing = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(eq(meetings.id, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  // 48 bits of entropy makes five collisions effectively impossible.
  return `MTG-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 12)}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return errorResponse(401, 'Unauthorized.');

  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  const parsed = await parseBody(request, meetingCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const db = drizzle(env.DB);
    const body = parsed.data;
    const id = await uniqueMeetingId(db);

    await db.insert(meetings).values({
      id,
      title: body.title,
      date: body.date,
      time: body.time,
      location: body.location,
      leader: body.leader,
    });

    await recordAudit(db, {
      entityType: 'meeting',
      entityId: id,
      action: 'created',
      notes: body.title,
      actor: user,
    });

    return json({ success: true, id }, 201);
  } catch {
    return errorResponse(500, 'Failed to create meeting.');
  }
};
