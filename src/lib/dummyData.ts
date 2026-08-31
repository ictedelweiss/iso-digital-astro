import type { Department } from './types';

export const OFFICIAL_DEPARTMENTS: Department[] = [
  'ICT', 'Management', 'SD', 'SMP', 'SMA', 'SMK', 'HRD', 'GA', 'Kurikulum', 'Kesiswaan', 'Finance & Accounting', 'Sarpras'
];

export const SAMPLE_SIGNATURE_1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
export const SAMPLE_SIGNATURE_2 = SAMPLE_SIGNATURE_1;
export const SAMPLE_SIGNATURE_3 = SAMPLE_SIGNATURE_1;

/**
 * Coordinator labels used only for display fallbacks in the create form.
 *
 * These are generic placeholders — no real staff names or email addresses.
 * The authoritative approval chain is built server-side (see lib/approvals.ts),
 * so this map never influences who can approve a document.
 */
export const COORDINATORS_MAP: Record<Department, { name: string, email: string }> = {
  'ICT': { name: 'Koordinator ICT', email: 'koordinator.ict@sekolah-contoh.sch.id' },
  'SD': { name: 'Koordinator SD', email: 'koordinator.sd@sekolah-contoh.sch.id' },
  'Management': { name: 'Koordinator Yayasan', email: 'koordinator.yayasan@sekolah-contoh.sch.id' },
  // fallback for others
  'SMP': { name: 'Koordinator SMP', email: 'koordinator.smp@sekolah-contoh.sch.id' },
  'SMA': { name: 'Koordinator SMA', email: 'koordinator.sma@sekolah-contoh.sch.id' },
  'SMK': { name: 'Koordinator SMK', email: 'koordinator.smk@sekolah-contoh.sch.id' },
  'HRD': { name: 'Koordinator HRD', email: 'koordinator.hrd@sekolah-contoh.sch.id' },
  'GA': { name: 'Koordinator GA', email: 'koordinator.ga@sekolah-contoh.sch.id' },
  'Kurikulum': { name: 'Koordinator Kurikulum', email: 'koordinator.kurikulum@sekolah-contoh.sch.id' },
  'Kesiswaan': { name: 'Koordinator Kesiswaan', email: 'koordinator.kesiswaan@sekolah-contoh.sch.id' },
  'Finance & Accounting': { name: 'Koordinator Keuangan', email: 'koordinator.keuangan@sekolah-contoh.sch.id' },
  'Sarpras': { name: 'Koordinator Sarpras', email: 'koordinator.sarpras@sekolah-contoh.sch.id' },
};

// We return empty arrays for initial mocked data since they are now fetched via API
export const INITIAL_PURCHASE_REQUISITIONS: any[] = [];
export const INITIAL_LEAVE_REQUESTS: any[] = [];
export const INITIAL_HANDOVER_FORMS: any[] = [];
export const INITIAL_MEETINGS: any[] = [];
export const INITIAL_ASSETS: any[] = [];
export const MOCK_USERS: any[] = [];
