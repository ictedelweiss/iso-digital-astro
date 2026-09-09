import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { json, errorResponse } from '../../../lib/validation';
import { modules, rolePermissions, users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { FALLBACK_ROLE_PERMISSIONS } from '../../../lib/permissions';
import { ACTIVE_EMPLOYEES } from '../../../lib/employeeData';

/**
 * Direct database initialiser running inside the Cloudflare Worker binding.
 * Bypasses Cloudflare REST API issues by applying schema & initial seed directly.
 */
export const POST: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return errorResponse(500, 'Database is not available.');

  try {
    const rawDb = env.DB;

    // 1. Create modules table
    await rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS modules (
        key text PRIMARY KEY NOT NULL,
        label text NOT NULL,
        description text,
        icon text,
        sort_order integer DEFAULT 0 NOT NULL,
        is_active integer DEFAULT 1 NOT NULL,
        is_system integer DEFAULT 1 NOT NULL
      );
    `).run();

    // 2. Create role_permissions table
    await rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        role text NOT NULL,
        module_key text NOT NULL,
        can_view integer DEFAULT 0 NOT NULL,
        can_create integer DEFAULT 0 NOT NULL,
        can_edit integer DEFAULT 0 NOT NULL,
        can_delete integer DEFAULT 0 NOT NULL,
        can_approve integer DEFAULT 0 NOT NULL,
        FOREIGN KEY (module_key) REFERENCES modules(key) ON UPDATE no action ON DELETE cascade
      );
    `).run();

    await rawDb.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS role_module_unique ON role_permissions (role, module_key);
    `).run();

    // 3. Create user_permissions table
    await rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id integer NOT NULL,
        module_key text NOT NULL,
        effect text NOT NULL,
        can_view integer DEFAULT 0 NOT NULL,
        can_create integer DEFAULT 0 NOT NULL,
        can_edit integer DEFAULT 0 NOT NULL,
        can_delete integer DEFAULT 0 NOT NULL,
        can_approve integer DEFAULT 0 NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (module_key) REFERENCES modules(key) ON UPDATE no action ON DELETE cascade
      );
    `).run();

    await rawDb.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_module_unique ON user_permissions (user_id, module_key);
    `).run();

    // 4. Safely add columns to users table
    try {
      await rawDb.prepare(`ALTER TABLE users ADD is_active integer DEFAULT 1 NOT NULL;`).run();
    } catch {}
    try {
      await rawDb.prepare(`ALTER TABLE users ADD session_version integer DEFAULT 0 NOT NULL;`).run();
    } catch {}
    try {
      await rawDb.prepare(`ALTER TABLE users ADD last_login_at text;`).run();
    } catch {}

    // Add attachment columns to purchase_requisitions if they don't exist
    try {
      await rawDb.prepare(`ALTER TABLE purchase_requisitions ADD COLUMN attachment_name text;`).run();
    } catch {}
    try {
      await rawDb.prepare(`ALTER TABLE purchase_requisitions ADD COLUMN attachment_data text;`).run();
    } catch {}

    // 5. Seed default modules
    const DEFAULT_MODULES = [
      { key: 'dashboard', label: 'Dashboard / My Access', description: 'Ringkasan dokumen & pengumuman', icon: '🏠', sortOrder: 1, isActive: 1, isSystem: 1 },
      { key: 'purchase-requisition', label: 'Purchase Requisition', description: 'Pengajuan pengadaan barang/jasa', icon: '📝', sortOrder: 2, isActive: 1, isSystem: 1 },
      { key: 'leave-request', label: 'Permohonan Cuti', description: 'Pengajuan cuti staf & guru', icon: '🏖️', sortOrder: 3, isActive: 1, isSystem: 1 },
      { key: 'handover-form', label: 'Serah Terima ICT', description: 'Berita acara serah terima perangkat', icon: '📦', sortOrder: 4, isActive: 1, isSystem: 1 },
      { key: 'meeting-attendance', label: 'Absensi Rapat', description: 'Daftar hadir rapat ISO & QR presensi', icon: '👥', sortOrder: 5, isActive: 1, isSystem: 1 },
      { key: 'asset-management', label: 'Manajemen Aset', description: 'Inventarisasi & pelabelan aset barcode', icon: '🏷️', sortOrder: 6, isActive: 1, isSystem: 1 },
      { key: 'admin-access', label: 'Admin & Hak Akses', description: 'Manajemen pengguna, role & izin akses', icon: '⚙️', sortOrder: 7, isActive: 1, isSystem: 1 },
    ];

    for (const m of DEFAULT_MODULES) {
      await rawDb.prepare(`
        INSERT INTO modules (key, label, description, icon, sort_order, is_active, is_system)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          label = excluded.label,
          description = excluded.description,
          icon = excluded.icon,
          sort_order = excluded.sort_order;
      `).bind(m.key, m.label, m.description, m.icon, m.sortOrder, m.isActive, m.isSystem).run();
    }

    // 6. Seed role_permissions from FALLBACK_ROLE_PERMISSIONS
    for (const [role, perms] of Object.entries(FALLBACK_ROLE_PERMISSIONS)) {
      for (const [modKey, access] of Object.entries(perms)) {
        await rawDb.prepare(`
          INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_approve)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(role, module_key) DO UPDATE SET
            can_view = excluded.can_view,
            can_create = excluded.can_create,
            can_edit = excluded.can_edit,
            can_delete = excluded.can_delete,
            can_approve = excluded.can_approve;
        `).bind(
          role,
          modKey,
          access.view ? 1 : 0,
          access.create ? 1 : 0,
          access.edit ? 1 : 0,
          access.delete ? 1 : 0,
          access.approve ? 1 : 0
        ).run();
      }
    }

    // 7. Seed active employees from ACTIVE_EMPLOYEES (75 staff & teachers)
    let employeeCount = 0;
    for (const emp of ACTIVE_EMPLOYEES) {
      await rawDb.prepare(`
        INSERT INTO users (display_name, email, username, department, job_title, role, is_active, session_version)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0)
        ON CONFLICT(email) DO UPDATE SET
          display_name = excluded.display_name,
          username = excluded.username,
          department = excluded.department,
          job_title = excluded.job_title,
          role = excluded.role,
          is_active = 1;
      `).bind(
        emp.displayName,
        emp.email.toLowerCase(),
        emp.username,
        emp.department,
        emp.jobTitle,
        emp.role
      ).run();
      employeeCount++;
    }

    // Ensure known non-active staff are deactivated if they exist
    try {
      await rawDb.prepare(`
        UPDATE users SET is_active = 0 
        WHERE email IN (
          'bonafentura.lalut@edelweiss.sch.id',
          'sukarman@edelweiss.sch.id',
          'mia.roosmalisa@edelweiss.sch.id'
        ) OR display_name LIKE '%Bonafentura%' OR display_name LIKE '%Sukarman%' OR display_name LIKE '%Mia Roosmalisa%';
      `).run();
    } catch {}

    return json({
      success: true,
      message: `Database schema, seeds, and ${employeeCount} active employees initialized successfully!`,
    });
  } catch (err: any) {
    return errorResponse(500, `Init DB failed: ${err.message}`);
  }
};

// Also support GET for convenient initialization trigger in browser
export const GET: APIRoute = async (context) => {
  return POST(context);
};
