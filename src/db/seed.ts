import { drizzle } from 'drizzle-orm/d1';
import { users, assets, purchaseRequisitions, prItems } from './schema';

export async function seedDatabase(env: any) {
  const db = drizzle(env.DB);

  // Seed Users
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

  // Seed Assets
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
