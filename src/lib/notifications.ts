/**
 * Email notification service via Microsoft 365 Graph API (Mail.Send).
 *
 * Sends multi-step approval notifications to coordinators, finance/approvers,
 * and leadership, as well as final decision updates to document requesters.
 */
import { eq, or } from 'drizzle-orm';
import { users } from '../db/schema';

const MS_CLIENT_ID = '4c3b8737-18da-4627-a039-71580f6aace6';
const MS_TENANT_ID = '6d9ec31b-9635-42f8-a9cc-081a25c4efb5';
const SENDER_EMAIL = 'ict@edelweiss.sch.id';
const APP_URL = 'https://iso-digital.edelweiss.sch.id';

interface SendMailOptions {
  to: string[];
  subject: string;
  htmlBody: string;
}

/**
 * Obtain an application token from Microsoft Entra ID.
 */
async function getGraphToken(env: any): Promise<string | null> {
  const clientSecret =
    env?.MS_CLIENT_SECRET ||
    (typeof process !== 'undefined' ? process.env?.MS_CLIENT_SECRET : undefined);

  if (!clientSecret) {
    console.warn('MS_CLIENT_SECRET is not configured; skipping email notification.');
    return null;
  }

  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MS_CLIENT_ID,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    );

    if (!res.ok) {
      console.error('Failed to acquire Graph API token:', await res.text());
      return null;
    }

    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.error('Error fetching Graph API token:', err);
    return null;
  }
}

/**
 * Send an HTML email via Microsoft Graph API.
 */
export async function sendGraphEmail(env: any, opts: SendMailOptions): Promise<boolean> {
  const validRecipients = (opts.to || [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));

  if (validRecipients.length === 0) return false;

  const token = await getGraphToken(env);
  if (!token) return false;

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: opts.subject,
            body: {
              contentType: 'HTML',
              content: opts.htmlBody,
            },
            toRecipients: validRecipients.map((address) => ({
              emailAddress: { address },
            })),
          },
          saveToSentItems: false,
        }),
      }
    );

    if (!res.ok) {
      console.error('Microsoft Graph sendMail error:', res.status, await res.text());
      return false;
    }

    console.log(`[Email Sent] "${opts.subject}" to: ${validRecipients.join(', ')}`);
    return true;
  } catch (err) {
    console.error('Error during sendGraphEmail:', err);
    return false;
  }
}

/**
 * Helper to build modern email HTML wrapper.
 */
function buildEmailTemplate(args: {
  title: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  messageIntro: string;
  details: { label: string; value: string }[];
  actionUrl?: string;
  actionText?: string;
  footerNote?: string;
}): string {
  const detailRows = args.details
    .map(
      (d) => `
      <tr>
        <td style="padding: 7px 12px; font-weight: 600; color: #475569; width: 140px; font-size: 13px; border-bottom: 1px solid #f1f5f9;">${d.label}</td>
        <td style="padding: 7px 12px; color: #0f172a; font-size: 13px; border-bottom: 1px solid #f1f5f9;">${d.value}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1877f2; padding: 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">YAYASAN SINAR PUTIH EDELWEISS</h1>
              <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Sistem Manajemen Mutu ISO 21001:2018</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 24px;">
              <div style="margin-bottom: 16px;">
                <span style="display: inline-block; background-color: ${args.badgeBg}; color: ${args.badgeColor}; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${args.badgeText}
                </span>
              </div>
              
              <h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #0f172a;">${args.title}</h2>
              <p style="margin: 0 0 16px; font-size: 13px; color: #334155;">${args.messageIntro}</p>

              <!-- Details Table -->
              <table width="100%" style="border-collapse: collapse; background-color: #f8fafc; border-radius: 10px; overflow: hidden; margin-bottom: 24px; border: 1px solid #f1f5f9;">
                ${detailRows}
              </table>

              ${
                args.actionUrl
                  ? `
                <div style="text-align: center; margin: 24px 0 12px;">
                  <a href="${args.actionUrl}" style="display: inline-block; background-color: #1877f2; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(24, 119, 242, 0.2);">
                    ${args.actionText || 'Buka Dokumen di Sistem ISO'}
                  </a>
                </div>
              `
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
              <p style="margin: 0;">${args.footerNote || 'Email ini dikirimkan secara otomatis oleh Sistem Mutu ISO Digital Edelweiss School.'}</p>
              <p style="margin: 4px 0 0;">Mohon untuk tidak membalas langsung ke alamat email ini.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Mode Pengujian: Semua notifikasi email approver diarahkan ke email ini
export const TEST_APPROVER_OVERRIDE_EMAIL: string | null = 'aris.setyawan@edelweiss.sch.id';

/**
 * Query email addresses of users with a specific role.
 */
export async function getApproverEmails(
  db: any,
  role: 'coordinator' | 'approver' | 'admin',
  department?: string
): Promise<string[]> {
  // Override untuk keperluan pengujian proses approval
  if (TEST_APPROVER_OVERRIDE_EMAIL) {
    return [TEST_APPROVER_OVERRIDE_EMAIL];
  }

  try {
    let query = db.select({ email: users.email, department: users.department }).from(users);

    if (role === 'coordinator' && department) {
      const rows = await query.where(eq(users.role, 'coordinator'));
      // Prioritize same department coordinator
      const deptMatches = rows.filter(
        (r: any) => (r.department || '').toLowerCase() === department.toLowerCase()
      );
      if (deptMatches.length > 0) return deptMatches.map((r: any) => r.email).filter(Boolean);
      return rows.map((r: any) => r.email).filter(Boolean);
    }

    const rows = await query.where(eq(users.role, role));
    return rows.map((r: any) => r.email).filter(Boolean);
  } catch (err) {
    console.error('Failed to query approver emails:', err);
    return [];
  }
}

/**
 * Helper to build deep link URLs directly to specific document tabs and IDs.
 */
function getDocDeepLink(docType: string, docId?: number, docNumber?: string): string {
  let tab = 'dashboard';
  if (docType === 'Purchase Requisition') tab = 'purchase-requisition';
  else if (docType === 'Permohonan Cuti') tab = 'leave-request';
  else if (docType === 'Serah Terima Aset') tab = 'handover-form';

  const params = new URLSearchParams();
  params.set('tab', tab);
  if (docId) params.set('id', String(docId));
  if (docNumber) params.set('doc', docNumber);

  return `${APP_URL}/?${params.toString()}`;
}

/**
 * Send notification when a new document is submitted (Step 1 - Koordinator).
 */
export async function notifyNewDocument(
  env: any,
  db: any,
  doc: {
    type: 'Purchase Requisition' | 'Permohonan Cuti' | 'Serah Terima Aset';
    docId?: number;
    docNumber: string;
    title: string;
    requesterName: string;
    requesterEmail: string;
    department: string;
  }
) {
  // Step 1 is always coordinator
  const coordinatorEmails = await getApproverEmails(db, 'coordinator', doc.department);
  if (coordinatorEmails.length === 0) return;

  const html = buildEmailTemplate({
    title: `Pengajuan ${doc.type} Baru`,
    badgeText: 'Menunggu Persetujuan Tahap 1',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    messageIntro: `Yth. Koordinator Unit ${doc.department}, terdapat pengajuan dokumen baru yang memerlukan persetujuan dan verifikasi Anda:`,
    details: [
      { label: 'Jenis Dokumen', value: doc.type },
      { label: 'No. Dokumen', value: doc.docNumber },
      { label: 'Pemohon', value: `${doc.requesterName} (${doc.department})` },
      { label: 'Keperluan / Judul', value: doc.title },
    ],
    actionUrl: getDocDeepLink(doc.type, doc.docId, doc.docNumber),
    actionText: 'Tinjau & Setujui Dokumen',
  });

  await sendGraphEmail(env, {
    to: coordinatorEmails,
    subject: `[ISO Edelweiss] Permohonan Persetujuan: ${doc.docNumber} (${doc.requesterName})`,
    htmlBody: html,
  });
}

/**
 * Send notification on multi-step advancement (Step 1 -> Step 2 -> Step 3) or final decision.
 */
export async function notifyApprovalStepUpdate(
  env: any,
  db: any,
  info: {
    docType: 'Purchase Requisition' | 'Permohonan Cuti' | 'Serah Terima Aset';
    docId?: number;
    docNumber: string;
    title: string;
    department: string;
    requesterName: string;
    requesterEmail: string;
    actorName: string;
    decision: 'approved' | 'rejected';
    nextStep?: number;
    nextRole?: string;
    nextRoleTitle?: string;
    notes?: string | null;
  }
) {
  // If rejected: notify requester
  if (info.decision === 'rejected') {
    if (info.requesterEmail) {
      const html = buildEmailTemplate({
        title: `${info.docType} Ditolak`,
        badgeText: 'Status: Ditolak',
        badgeBg: '#fee2e2',
        badgeColor: '#b91c1c',
        messageIntro: `Yth. ${info.requesterName}, pengajuan dokumen Anda telah ditolak oleh ${info.actorName}:`,
        details: [
          { label: 'Jenis Dokumen', value: info.docType },
          { label: 'No. Dokumen', value: info.docNumber },
          { label: 'Keperluan', value: info.title },
          { label: 'Catatan Penolakan', value: info.notes || '-' },
        ],
        actionUrl: getDocDeepLink(info.docType, info.docId, info.docNumber),
        actionText: 'Lihat Detail di Sistem',
      });

      await sendGraphEmail(env, {
        to: [info.requesterEmail],
        subject: `[ISO Edelweiss] Dokumen Ditolak: ${info.docNumber}`,
        htmlBody: html,
      });
    }
    return;
  }

  // If approved and there is a NEXT step: notify the next approvers!
  if (info.nextStep && info.nextRole) {
    let targetRole: 'coordinator' | 'approver' | 'admin' = 'approver';
    if (info.nextRole.includes('koordinator') || info.nextRole.includes('coordinator')) {
      targetRole = 'coordinator';
    } else if (info.nextRole.includes('ketua') || info.nextRole.includes('admin')) {
      targetRole = 'admin';
    } else {
      targetRole = 'approver';
    }

    const nextApproverEmails = await getApproverEmails(db, targetRole, info.department);
    if (nextApproverEmails.length > 0) {
      const html = buildEmailTemplate({
        title: `Persetujuan ${info.docType} (Tahap ${info.nextStep})`,
        badgeText: `Menunggu Persetujuan: ${info.nextRoleTitle || info.nextRole}`,
        badgeBg: '#e0f2fe',
        badgeColor: '#0369a1',
        messageIntro: `Yth. Bapak/Ibu ${info.nextRoleTitle || 'Approver'}, dokumen berikut telah disetujui pada tahap sebelumnya oleh ${info.actorName} dan saat ini menunggu persetujuan Anda:`,
        details: [
          { label: 'Jenis Dokumen', value: info.docType },
          { label: 'No. Dokumen', value: info.docNumber },
          { label: 'Pemohon', value: `${info.requesterName} (${info.department})` },
          { label: 'Keperluan', value: info.title },
          { label: 'Tahap Saat Ini', value: `Tahap ${info.nextStep} (${info.nextRoleTitle || info.nextRole})` },
        ],
        actionUrl: getDocDeepLink(info.docType, info.docId, info.docNumber),
        actionText: 'Tinjau & Setujui Dokumen',
      });

      await sendGraphEmail(env, {
        to: nextApproverEmails,
        subject: `[ISO Edelweiss] Menunggu Persetujuan Tahap ${info.nextStep}: ${info.docNumber}`,
        htmlBody: html,
      });
    }
  } else {
    // FINAL APPROVAL: Notify the requester that the document is completely approved!
    if (info.requesterEmail) {
      const html = buildEmailTemplate({
        title: `${info.docType} Disetujui Sepenuhnya`,
        badgeText: 'Status: Selesai / Disetujui',
        badgeBg: '#dcfce7',
        badgeColor: '#15803d',
        messageIntro: `Selamat ${info.requesterName}, pengajuan dokumen Anda telah selesai diproses dan disetujui sepenuhnya oleh manajemen Yayasan Sinar Putih Edelweiss:`,
        details: [
          { label: 'Jenis Dokumen', value: info.docType },
          { label: 'No. Dokumen', value: info.docNumber },
          { label: 'Keperluan', value: info.title },
          { label: 'Status Dokumen', value: 'Approved (Resmi & Terotentikasi)' },
        ],
        actionUrl: getDocDeepLink(info.docType, info.docId, info.docNumber),
        actionText: 'Unduh Dokumen ISO PDF',
      });

      await sendGraphEmail(env, {
        to: [info.requesterEmail],
        subject: `[ISO Edelweiss] Dokumen Disetujui: ${info.docNumber}`,
        htmlBody: html,
      });
    }
  }
}
