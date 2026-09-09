import { drizzle } from 'drizzle-orm/d1';
import { users, assets, purchaseRequisitions, prItems, modules, rolePermissions } from './schema';

export async function seedDatabase(env: any) {
  const db = drizzle(env.DB);

  // 1. Seed Modules Registry
  await db.insert(modules).values([
    {
      key: 'dashboard',
      label: 'Dashboard / My Access',
      description: 'Ringkasan akses dan dokumen penting',
      icon: '🏠',
      sortOrder: 1,
      isActive: true,
      isSystem: true,
    },
    {
      key: 'purchase-requisition',
      label: 'Purchase Requisition',
      description: 'Pengadaan barang dan jasa standar ISO',
      icon: '📝',
      sortOrder: 2,
      isActive: true,
      isSystem: true,
    },
    {
      key: 'leave-request',
      label: 'Permohonan Cuti',
      description: 'Pengajuan cuti tahunan dan izin kerja',
      icon: '🏖️',
      sortOrder: 3,
      isActive: true,
      isSystem: true,
    },
    {
      key: 'handover-form',
      label: 'Serah Terima ICT',
      description: 'Berita acara serah terima perangkat dan aset',
      icon: '📦',
      sortOrder: 4,
      isActive: true,
      isSystem: true,
    },
    {
      key: 'meeting-attendance',
      label: 'Absensi Rapat',
      description: 'Daftar hadir rapat internal dan tamu eksternal',
      icon: '👥',
      sortOrder: 5,
      isActive: true,
      isSystem: true,
    },
    {
      key: 'asset-management',
      label: 'Manajemen Aset',
      description: 'Inventaris aset dan pencetakan label barcode',
      icon: '🏷️',
      sortOrder: 6,
      isActive: true,
      isSystem: true,
    },
    {
      key: 'admin-access',
      label: 'Admin & Hak Akses',
      description: 'Pengelolaan akun pengguna dan matriks hak akses modul',
      icon: '⚙️',
      sortOrder: 7,
      isActive: true,
      isSystem: true,
    },
  ]).onConflictDoNothing();

  // 2. Seed Default Role Permissions
  // Asumsi hak akses (§5 PROMPT-modul-admin-hak-akses.md):
  // - admin: Semua modul, semua aksi (view, create, edit, delete, approve).
  // - coordinator: Semua modul kecuali admin-access; boleh approve PR/cuti/serah terima.
  // - approver: dashboard (view), PR/cuti/serah terima (view + approve), rapat & aset (view).
  // - staff: dashboard (view), PR/cuti/serah terima (view + create), rapat (view), aset (view).
  await db.insert(rolePermissions).values([
    // ADMIN: All modules, full permissions
    { role: 'admin', moduleKey: 'dashboard', canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    { role: 'admin', moduleKey: 'purchase-requisition', canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    { role: 'admin', moduleKey: 'leave-request', canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    { role: 'admin', moduleKey: 'handover-form', canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    { role: 'admin', moduleKey: 'meeting-attendance', canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    { role: 'admin', moduleKey: 'asset-management', canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    { role: 'admin', moduleKey: 'admin-access', canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },

    // COORDINATOR: All modules except admin-access; can approve PR, leave, handover
    { role: 'coordinator', moduleKey: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { role: 'coordinator', moduleKey: 'purchase-requisition', canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { role: 'coordinator', moduleKey: 'leave-request', canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { role: 'coordinator', moduleKey: 'handover-form', canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { role: 'coordinator', moduleKey: 'meeting-attendance', canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false },
    { role: 'coordinator', moduleKey: 'asset-management', canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false },

    // APPROVER: Dashboard (view), PR/leave/handover (view + approve), meeting/asset (view)
    { role: 'approver', moduleKey: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { role: 'approver', moduleKey: 'purchase-requisition', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: true },
    { role: 'approver', moduleKey: 'leave-request', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: true },
    { role: 'approver', moduleKey: 'handover-form', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: true },
    { role: 'approver', moduleKey: 'meeting-attendance', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { role: 'approver', moduleKey: 'asset-management', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },

    // STAFF: Dashboard (view), PR/leave/handover (view + create), meeting/asset (view)
    { role: 'staff', moduleKey: 'dashboard', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { role: 'staff', moduleKey: 'purchase-requisition', canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { role: 'staff', moduleKey: 'leave-request', canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { role: 'staff', moduleKey: 'handover-form', canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { role: 'staff', moduleKey: 'meeting-attendance', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { role: 'staff', moduleKey: 'asset-management', canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ]).onConflictDoNothing();

  // 3. Seed Sample Users
  //
  // NOTE: these are fictitious sample accounts used only to populate a fresh
  // database. No real staff names, emails or Microsoft IDs are present — the
  // production directory is the source of truth (synced via the Entra login).
  await db.insert(users).values([
    {
      displayName: 'Pengguna Contoh Admin',
      email: 'admin.contoh@sekolah-contoh.sch.id',
      username: 'admin.contoh',
      department: 'ICT',
      jobTitle: 'ICT Coordinator (Contoh)',
      role: 'admin',
      hasSignature: true,
      msId: 'ms-sample-admin-001',
    },
    {
      displayName: 'Pengguna Contoh Koordinator',
      email: 'koordinator.contoh@sekolah-contoh.sch.id',
      username: 'koordinator.contoh',
      department: 'SD',
      jobTitle: 'Koordinator Unit SD (Contoh)',
      role: 'coordinator',
      hasSignature: true,
      msId: 'ms-sample-sd-002',
    },
    {
      displayName: 'Pengguna Contoh Yayasan',
      email: 'yayasan.contoh@sekolah-contoh.sch.id',
      username: 'yayasan.contoh',
      department: 'Management',
      jobTitle: 'Ketua Yayasan (Contoh)',
      role: 'admin',
      hasSignature: true,
      msId: 'ms-sample-yayasan-003',
    },
    {
      displayName: 'Pengguna Contoh Keuangan',
      email: 'keuangan.contoh@sekolah-contoh.sch.id',
      username: 'keuangan.contoh',
      department: 'Finance & Accounting',
      jobTitle: 'Head of Finance (Contoh)',
      role: 'approver',
      hasSignature: true,
      msId: 'ms-sample-fna-004',
    },
    {
      displayName: 'Pengguna Contoh Staf',
      email: 'staf.contoh@sekolah-contoh.sch.id',
      username: 'staf.contoh',
      department: 'GA',
      jobTitle: 'Staff General Affairs (Contoh)',
      role: 'staff',
      hasSignature: false,
      msId: 'ms-sample-ga-005',
    },
  ]).onConflictDoNothing();

  // 4. Seed Assets
  await db.insert(assets).values([
    {
      assetCode: 'AST-ICT-2026-001',
      name: 'Server Contoh Rackmount',
      category: 'Server & Network',
      location: 'Ruang Server Lt. 2',
      condition: 'Baik',
      status: 'Digunakan',
      serialNumber: 'SN-CONTOH-89941X',
      purchaseDate: '2025-11-10',
      value: 48500000,
      assignedTo: 'Pengguna Contoh ICT',
    },
    {
      assetCode: 'AST-ICT-2026-002',
      name: 'Laptop Contoh Gen 5',
      category: 'Komputer & Laptop',
      location: 'Ruang Guru',
      condition: 'Baik',
      status: 'Dipinjam',
      serialNumber: 'PF-CONTOH-4X9K',
      purchaseDate: '2026-08-18',
      value: 12500000,
      assignedTo: 'Pengguna Contoh Guru',
    },
  ]).onConflictDoNothing();

  console.log("Database seeding completed.");
}
