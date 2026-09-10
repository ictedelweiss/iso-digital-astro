import type { Department } from './types';

export const OFFICIAL_DEPARTMENTS: Department[] = [
  'ICT', 'Management', 'SD', 'SMP', 'SMA', 'SMK', 'HRD', 'GA', 'Kurikulum', 'Kesiswaan', 'Finance & Accounting', 'Sarpras'
];

export const SAMPLE_SIGNATURE_1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
export const SAMPLE_SIGNATURE_2 = SAMPLE_SIGNATURE_1;
export const SAMPLE_SIGNATURE_3 = SAMPLE_SIGNATURE_1;

export const DEFAULT_OFFICIALS = {
  ketuaYayasan: 'Juarsa Oemardikarta',
  hrd: 'Auria Stadita Insani',
  ict: 'Aris Setyawan',
  accounting: 'Titis Rahmawati Wijiastuti',
  finance: 'Ni Ketut Swastitri',
};

export const COORDINATORS_MAP: Record<string, { name: string; email: string }> = {
  'KB/TK': { name: 'Armitridesi Shinta Marito', email: 'armitridesi.marito@edelweiss.sch.id' },
  'SD': { name: 'Miske Ferlani Lumintaintang, S.Pd', email: 'miske.ferlani@edelweiss.sch.id' },
  'SMP': { name: 'Yudha Hadi Purnama, S.T., M.Pd', email: 'yudha.punama@edelweiss.sch.id' },
  'PKBM': { name: 'Nadya Khusnul Khotimah', email: 'nadya.khotimah@edelweiss.sch.id' },
  'GA': { name: 'Anggraeni Novianti', email: 'anggraeni.novianti@edelweiss.sch.id' },
  'Customer Service Officer': { name: 'Permata Chitra Haelda Manik, S.Pd., M.Pd', email: 'permata.manik@edelweiss.sch.id' },
  'Finance & Accounting': { name: 'Ni Ketut Swastitri', email: 'ketut.swastitri@edelweiss.sch.id' },
  'HRD': { name: 'Auria Stadita Insani', email: 'auria.insani@edelweiss.sch.id' },
  'ICT': { name: 'Aris Setyawan', email: 'aris.setyawan@edelweiss.sch.id' },
  'Management': { name: 'Medina Marpaung', email: 'medina.marpaung@edelweiss.sch.id' },
  'Marketing': { name: 'Permata Chitra Haelda Manik, S.Pd., M.Pd', email: 'permata.manik@edelweiss.sch.id' },
  'Operator': { name: 'Anggraeni Novianti', email: 'anggraeni.novianti@edelweiss.sch.id' },
  'Kurikulum': { name: 'Febriana', email: 'febriana@edelweiss.sch.id' },
  'Kesiswaan': { name: 'Ade Ayu Puspitawati, S.Pd', email: 'ayu.puspitawati@edelweiss.sch.id' },
  'Sarpras': { name: 'Anggraeni Novianti', email: 'anggraeni.novianti@edelweiss.sch.id' },
};

export function getDepartmentCoordinator(dept?: string): string {
  if (!dept) return 'Auria Stadita Insani';
  const clean = dept.trim();
  if (COORDINATORS_MAP[clean]) {
    return COORDINATORS_MAP[clean].name;
  }
  const d = clean.toLowerCase();
  if (d.includes('sd')) return 'Miske Ferlani Lumintaintang, S.Pd';
  if (d.includes('smp')) return 'Yudha Hadi Purnama, S.T., M.Pd';
  if (d.includes('tk') || d.includes('kb')) return 'Armitridesi Shinta Marito';
  if (d.includes('hrd') || d.includes('sdm')) return 'Auria Stadita Insani';
  if (d.includes('ga') || d.includes('general')) return 'Anggraeni Novianti';
  if (d.includes('ict') || d.includes('it')) return 'Aris Setyawan';
  if (d.includes('marketing') || d.includes('customer') || d.includes('cso')) return 'Permata Chitra Haelda Manik, S.Pd., M.Pd';
  if (d.includes('accounting')) return 'Titis Rahmawati Wijiastuti';
  if (d.includes('finance')) return 'Ni Ketut Swastitri';
  if (d.includes('management') || d.includes('yayasan')) return 'Medina Marpaung';
  if (d.includes('operator')) return 'Anggraeni Novianti';
  return 'Miske Ferlani Lumintaintang, S.Pd';
}

/**
 * Check whether a person (name, email, department, or explicit role) is a Coordinator.
 */
export function isUserCoordinator(
  name?: string,
  email?: string,
  dept?: string,
  role?: string
): boolean {
  if (role === 'coordinator') return true;
  if (!name && !email) return false;

  const n = (name || '').toLowerCase().trim();
  const e = (email || '').toLowerCase().trim();

  // 1. Check against COORDINATORS_MAP
  for (const info of Object.values(COORDINATORS_MAP)) {
    const coordName = info.name.toLowerCase().trim();
    const coordEmail = info.email.toLowerCase().trim();

    if (n && (coordName === n || coordName.includes(n) || n.includes(coordName))) return true;
    if (e && (coordEmail === e || coordEmail.includes(e))) return true;

    // Check base name without degrees (e.g. "Miske Ferlani" vs "Miske Ferlani Lumintaintang, S.Pd")
    const baseCoord = coordName.split(',')[0].trim();
    const baseUser = n.split(',')[0].trim();
    if (baseCoord && baseUser && (baseCoord === baseUser || baseCoord.includes(baseUser) || baseUser.includes(baseCoord))) {
      return true;
    }
  }

  // 2. If department is provided, check if user matches department coordinator
  if (dept && n) {
    const deptCoord = getDepartmentCoordinator(dept).toLowerCase().trim();
    const baseDeptCoord = deptCoord.split(',')[0].trim();
    const baseUser = n.split(',')[0].trim();
    if (baseDeptCoord && baseUser && (baseDeptCoord === baseUser || baseDeptCoord.includes(baseUser) || baseUser.includes(baseDeptCoord))) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the designated coordinator name for a document signature block.
 * 
 * SPECIAL RULE:
 * Untuk semua form, jika yang request atau penerimanya adalah koordinator,
 * yang bertandatangan di tempat koordinator adalah Ketua Yayasan (Juarsa Oemardikarta),
 * namun keterangannya/jabatannya tetap "Koordinator".
 */
export function getSignerCoordinatorName(
  dept?: string,
  requesterOrRecipientName?: string,
  requesterOrRecipientEmail?: string,
  role?: string
): string {
  if (isUserCoordinator(requesterOrRecipientName, requesterOrRecipientEmail, dept, role)) {
    return DEFAULT_OFFICIALS.ketuaYayasan;
  }
  return getDepartmentCoordinator(dept);
}

// We return empty arrays for initial mocked data since they are now fetched via API
export const INITIAL_PURCHASE_REQUISITIONS: any[] = [];
export const INITIAL_LEAVE_REQUESTS: any[] = [];
export const INITIAL_HANDOVER_FORMS: any[] = [];
export const INITIAL_MEETINGS: any[] = [];
export const INITIAL_ASSETS: any[] = [];
export const MOCK_USERS: any[] = [];
