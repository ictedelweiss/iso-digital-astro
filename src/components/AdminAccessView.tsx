import { createSignal, createResource, For, Show, onMount } from 'solid-js';
import type { UserProfile, UserRole, ModuleKey, ModuleAccess } from '../lib/types';
import { apiFetch, ApiError } from '../lib/api';

interface Props {
  currentUser: UserProfile | null;
  showToast: (msg: string) => void;
  onPermissionUpdated?: () => void;
}

type SubTab = 'users' | 'permissions' | 'roles' | 'audit';

interface UserListItem {
  id: number;
  display_name: string;
  email: string;
  username: string;
  department: string;
  job_title: string;
  role: UserRole;
  is_active: boolean;
  session_version: number;
  last_login_at: string | null;
  created_at: string;
  accessible_modules_count: number;
}

interface UserMatrixRow {
  module_key: string;
  module_label: string;
  module_icon?: string | null;
  is_active: boolean;
  is_system: boolean;
  effect: 'allow' | 'deny' | 'inherit';
  is_overridden: boolean;
  effective: ModuleAccess;
  role_default: ModuleAccess;
  override_flags: ModuleAccess | null;
}

interface RoleMatrixRow {
  module_key: string;
  module_label: string;
  module_icon?: string | null;
  is_active: boolean;
  is_system: boolean;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

interface AuditRow {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  notes: string | null;
  created_at: string;
}

const DEPARTMENTS = [
  'ICT',
  'Management',
  'Finance & Accounting',
  'HRD',
  'SD',
  'SMP',
  'KB/TK',
  'PKBM',
  'GA',
  'Customer Service Officer',
  'Marketing',
  'Operator',
  'Umum',
];

export default function AdminAccessView(props: Props) {
  const [activeSubTab, setActiveSubTab] = createSignal<SubTab>('users');

  // --- TAB 1: USERS STATE ---
  const [usersList, setUsersList] = createSignal<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [roleFilter, setRoleFilter] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [totalPages, setTotalPages] = createSignal(1);
  const [totalUsers, setTotalUsers] = createSignal(0);

  // User Modal State
  const [showUserModal, setShowUserModal] = createSignal(false);
  const [editingUserId, setEditingUserId] = createSignal<number | null>(null);
  const [formDisplayName, setFormDisplayName] = createSignal('');
  const [formEmail, setFormEmail] = createSignal('');
  const [formUsername, setFormUsername] = createSignal('');
  const [formDepartment, setFormDepartment] = createSignal('ICT');
  const [formJobTitle, setFormJobTitle] = createSignal('Staff');
  const [formRole, setFormRole] = createSignal<UserRole>('staff');
  const [formIsActive, setFormIsActive] = createSignal(true);
  const [formSubmitting, setFormSubmitting] = createSignal(false);

  // Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = createSignal(false);
  const [confirmTitle, setConfirmTitle] = createSignal('');
  const [confirmMessage, setConfirmMessage] = createSignal('');
  const [confirmAction, setConfirmAction] = createSignal<(() => Promise<void>) | null>(null);

  // --- TAB 2: USER PERMISSIONS STATE ---
  const [selectedUserId, setSelectedUserId] = createSignal<number | null>(null);
  const [matrixRows, setMatrixRows] = createSignal<UserMatrixRow[]>([]);
  const [matrixLoading, setMatrixLoading] = createSignal(false);
  const [matrixSaving, setMatrixSaving] = createSignal(false);

  // --- TAB 3: ROLE PERMISSIONS STATE ---
  const [selectedRole, setSelectedRole] = createSignal<UserRole>('staff');
  const [roleRows, setRoleRows] = createSignal<RoleMatrixRow[]>([]);
  const [roleLoading, setRoleLoading] = createSignal(false);
  const [roleSaving, setRoleSaving] = createSignal(false);

  // --- TAB 4: AUDIT LOGS STATE ---
  const [auditLogs, setAuditLogs] = createSignal<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = createSignal(false);
  const [auditEntityFilter, setAuditEntityFilter] = createSignal('');

  // Load Users
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        data: UserListItem[];
        pagination: { page: number; total_pages: number; total: number };
      }>('/api/admin/users', {
        params: {
          q: searchQuery(),
          role: roleFilter(),
          status: statusFilter(),
          page: page(),
          limit: 15,
        },
      });
      setUsersList(res.data);
      setTotalPages(res.pagination.total_pages);
      setTotalUsers(res.pagination.total);
    } catch (e: any) {
      props.showToast(`❌ Gagal memuat daftar user: ${e.message}`);
    } finally {
      setUsersLoading(false);
    }
  };

  // Load Matrix for User
  const loadUserPermissions = async (userId: number) => {
    setSelectedUserId(userId);
    setMatrixLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        user: any;
        matrix: UserMatrixRow[];
      }>(`/api/admin/users/${userId}/permissions`);
      setMatrixRows(res.matrix);
    } catch (e: any) {
      props.showToast(`❌ Gagal memuat hak akses user: ${e.message}`);
    } finally {
      setMatrixLoading(false);
    }
  };

  // Load Role Permissions
  const loadRolePermissions = async (role: UserRole) => {
    setSelectedRole(role);
    setRoleLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        role: UserRole;
        matrix: RoleMatrixRow[];
      }>(`/api/admin/roles/${role}/permissions`);
      setRoleRows(res.matrix);
    } catch (e: any) {
      props.showToast(`❌ Gagal memuat default role: ${e.message}`);
    } finally {
      setRoleLoading(false);
    }
  };

  // Load Audit
  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        data: AuditRow[];
      }>('/api/admin/audit', {
        params: {
          entity: auditEntityFilter() || undefined,
          limit: 30,
        },
      });
      setAuditLogs(res.data);
    } catch (e: any) {
      props.showToast(`❌ Gagal memuat log audit: ${e.message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  onMount(() => {
    loadUsers();
  });

  // Modal Open Handlers
  const openCreateUserModal = () => {
    setEditingUserId(null);
    setFormDisplayName('');
    setFormEmail('');
    setFormUsername('');
    setFormDepartment('ICT');
    setFormJobTitle('Staff');
    setFormRole('staff');
    setFormIsActive(true);
    setShowUserModal(true);
  };

  const openEditUserModal = (u: UserListItem) => {
    setEditingUserId(u.id);
    setFormDisplayName(u.display_name);
    setFormEmail(u.email);
    setFormUsername(u.username);
    setFormDepartment(u.department);
    setFormJobTitle(u.job_title);
    setFormRole(u.role);
    setFormIsActive(u.is_active);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: Event) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (editingUserId() === null) {
        // Create
        await apiFetch('/api/admin/users', {
          method: 'POST',
          body: {
            display_name: formDisplayName(),
            email: formEmail(),
            username: formUsername(),
            department: formDepartment(),
            job_title: formJobTitle(),
            role: formRole(),
            is_active: formIsActive(),
          },
        });
        props.showToast('✓ Akun user baru berhasil dibuat!');
      } else {
        // Update
        await apiFetch(`/api/admin/users/${editingUserId()}`, {
          method: 'PATCH',
          body: {
            display_name: formDisplayName(),
            email: formEmail(),
            username: formUsername(),
            department: formDepartment(),
            job_title: formJobTitle(),
            role: formRole(),
            is_active: formIsActive(),
          },
        });
        props.showToast('✓ Data akun user berhasil diperbarui!');
      }
      setShowUserModal(false);
      loadUsers();
    } catch (err: any) {
      props.showToast(`❌ Gagal: ${err.message}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Reset Session
  const triggerResetSession = (u: UserListItem) => {
    setConfirmTitle('Reset Sesi Akun');
    setConfirmMessage(
      `Apakah Anda yakin ingin memaksa logout semua sesi aktif untuk akun ${u.display_name} (${u.email})? Sesi akun akan langsung kedaluwarsa.`
    );
    setConfirmAction(() => async () => {
      try {
        await apiFetch(`/api/admin/users/${u.id}/reset-session`, { method: 'POST' });
        props.showToast(`✓ Sesi akun ${u.display_name} berhasil di-reset.`);
        loadUsers();
      } catch (err: any) {
        props.showToast(`❌ Gagal reset sesi: ${err.message}`);
      }
    });
    setConfirmModalOpen(true);
  };

  // Toggle Active / Soft Delete
  const triggerToggleActive = (u: UserListItem) => {
    const isNowActive = u.is_active;
    const actionLabel = isNowActive ? 'Nonaktifkan' : 'Aktifkan';
    setConfirmTitle(`${actionLabel} Akun Pengguna`);
    setConfirmMessage(
      isNowActive
        ? `Apakah Anda yakin ingin menonaktifkan akun ${u.display_name}? User tidak akan bisa login lagi dan semua hak aksesnya ditolak.`
        : `Apakah Anda yakin ingin mengaktifkan kembali akun ${u.display_name}?`
    );
    setConfirmAction(() => async () => {
      try {
        if (isNowActive) {
          // Soft delete
          await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
          props.showToast(`✓ Akun ${u.display_name} telah dinonaktifkan.`);
        } else {
          // Activate
          await apiFetch(`/api/admin/users/${u.id}`, {
            method: 'PATCH',
            body: { is_active: true },
          });
          props.showToast(`✓ Akun ${u.display_name} telah diaktifkan kembali.`);
        }
        loadUsers();
      } catch (err: any) {
        props.showToast(`❌ Gagal: ${err.message}`);
      }
    });
    setConfirmModalOpen(true);
  };

  // Switch to Permissions Matrix
  const selectUserForPermissions = (userId: number) => {
    setActiveSubTab('permissions');
    loadUserPermissions(userId);
  };

  // Update Matrix Row Effect
  const handleMatrixEffectChange = (index: number, newEffect: 'allow' | 'deny' | 'inherit') => {
    const rows = [...matrixRows()];
    const row = { ...rows[index] };
    row.effect = newEffect;

    if (newEffect === 'inherit') {
      row.effective = { ...row.role_default };
      row.is_overridden = false;
    } else if (newEffect === 'deny') {
      row.effective = { view: false, create: false, edit: false, delete: false, approve: false };
      row.is_overridden = true;
    } else if (newEffect === 'allow') {
      // Default to role or existing flags
      row.effective = row.override_flags ? { ...row.override_flags } : { ...row.role_default, view: true };
      row.is_overridden = true;
    }

    rows[index] = row;
    setMatrixRows(rows);
  };

  // Toggle Action Checkbox in User Matrix
  const handleMatrixActionToggle = (index: number, action: keyof ModuleAccess) => {
    const rows = [...matrixRows()];
    const row = { ...rows[index] };

    // Auto set effect to 'allow' if user toggles checkbox while inherit/deny
    if (row.effect !== 'allow') {
      row.effect = 'allow';
      row.is_overridden = true;
    }

    const currentVal = row.effective[action];
    const nextVal = !currentVal;
    const newEffective = { ...row.effective, [action]: nextVal };

    // Rule: delete/approve implies view. If view unchecked, uncheck delete & approve
    if (action === 'delete' && nextVal) newEffective.view = true;
    if (action === 'approve' && nextVal) newEffective.view = true;
    if (action === 'view' && !nextVal) {
      newEffective.delete = false;
      newEffective.approve = false;
    }

    row.effective = newEffective;
    rows[index] = row;
    setMatrixRows(rows);
  };

  // Select all actions for a row
  const handleMatrixSelectAllRow = (index: number) => {
    const rows = [...matrixRows()];
    const row = { ...rows[index] };
    row.effect = 'allow';
    row.is_overridden = true;
    row.effective = { view: true, create: true, edit: true, delete: true, approve: true };
    rows[index] = row;
    setMatrixRows(rows);
  };

  // Save User Permissions Matrix
  const handleSaveUserPermissions = async () => {
    const userId = selectedUserId();
    if (!userId) return;

    setMatrixSaving(true);
    try {
      const payload = {
        permissions: matrixRows().map((r) => ({
          module_key: r.module_key,
          effect: r.effect,
          can_view: r.effective.view,
          can_create: r.effective.create,
          can_edit: r.effective.edit,
          can_delete: r.effective.delete,
          can_approve: r.effective.approve,
        })),
      };

      await apiFetch(`/api/admin/users/${userId}/permissions`, {
        method: 'PUT',
        body: payload,
      });

      props.showToast('✓ Hak akses user berhasil disimpan dan langsung berlaku!');
      loadUserPermissions(userId);
      if (props.onPermissionUpdated) props.onPermissionUpdated();
    } catch (err: any) {
      props.showToast(`❌ Gagal menyimpan hak akses: ${err.message}`);
    } finally {
      setMatrixSaving(false);
    }
  };

  // Reset User Permissions to Default Role
  const handleResetUserPermissions = () => {
    const userId = selectedUserId();
    if (!userId) return;

    setConfirmTitle('Reset Hak Akses ke Default Role');
    setConfirmMessage(
      'Apakah Anda yakin ingin menghapus semua pengaturan khusus (override) untuk akun ini? Hak akses akan kembali mengikuti default role akun.'
    );
    setConfirmAction(() => async () => {
      try {
        await apiFetch(`/api/admin/users/${userId}/permissions`, { method: 'DELETE' });
        props.showToast('✓ Override hak akses berhasil dihapus.');
        loadUserPermissions(userId);
        if (props.onPermissionUpdated) props.onPermissionUpdated();
      } catch (err: any) {
        props.showToast(`❌ Gagal: ${err.message}`);
      }
    });
    setConfirmModalOpen(true);
  };

  // Toggle Action Checkbox in Role Matrix
  const handleRoleActionToggle = (index: number, action: keyof ModuleAccess) => {
    const rows = [...roleRows()];
    const row = { ...rows[index] };

    const actionKey = `can_${action}` as keyof RoleMatrixRow;
    const nextVal = !row[actionKey];

    (row as any)[actionKey] = nextVal;

    // Rule: delete/approve implies view
    if (action === 'delete' && nextVal) row.can_view = true;
    if (action === 'approve' && nextVal) row.can_view = true;
    if (action === 'view' && !nextVal) {
      row.can_delete = false;
      row.can_approve = false;
    }

    rows[index] = row;
    setRoleRows(rows);
  };

  // Save Role Permissions Matrix
  const handleSaveRolePermissions = async () => {
    const role = selectedRole();
    setRoleSaving(true);
    try {
      const payload = {
        permissions: roleRows().map((r) => ({
          module_key: r.module_key,
          can_view: r.can_view,
          can_create: r.can_create,
          can_edit: r.can_edit,
          can_delete: r.can_delete,
          can_approve: r.can_approve,
        })),
      };

      await apiFetch(`/api/admin/roles/${role}/permissions`, {
        method: 'PUT',
        body: payload,
      });

      props.showToast(`✓ Default hak akses role '${role}' berhasil disimpan!`);
      loadRolePermissions(role);
      if (props.onPermissionUpdated) props.onPermissionUpdated();
    } catch (err: any) {
      props.showToast(`❌ Gagal menyimpan default role: ${err.message}`);
    } finally {
      setRoleSaving(false);
    }
  };

  const selectedUserObj = () => usersList().find((u) => u.id === selectedUserId());

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn max-w-7xl mx-auto">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-800">Admin & Hak Akses</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
              ISO 21001:2018 RBAC
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Manajemen akun pengguna, pengaturan izin per modul × aksi, dan audit trail perubahan hak akses.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick={openCreateUserModal}
            class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-2xl shadow transition flex items-center gap-2"
          >
            <span>➕</span>
            <span>Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div class="flex items-center gap-2 bg-slate-200/60 p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto">
        <button
          onClick={() => {
            setActiveSubTab('users');
            loadUsers();
          }}
          class={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeSubTab() === 'users'
              ? 'bg-white text-[#1877f2] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>👥</span>
          <span>Daftar Akun</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('permissions');
            if (usersList().length > 0 && selectedUserId() === null) {
              loadUserPermissions(usersList()[0].id);
            }
          }}
          class={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeSubTab() === 'permissions'
              ? 'bg-white text-[#1877f2] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🔐</span>
          <span>Matriks Hak Akses User</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('roles');
            loadRolePermissions(selectedRole());
          }}
          class={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeSubTab() === 'roles'
              ? 'bg-white text-[#1877f2] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🛡️</span>
          <span>Default per Role</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('audit');
            loadAuditLogs();
          }}
          class={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeSubTab() === 'audit'
              ? 'bg-white text-[#1877f2] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📜</span>
          <span>Log Perubahan</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: AKUN PENGGUNA */}
      {/* ========================================================================= */}
      <Show when={activeSubTab() === 'users'}>
        <div class="space-y-4">
          {/* Filter Bar */}
          <div class="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div class="w-full md:w-80">
              <input
                type="text"
                placeholder="Cari nama, email, username, unit..."
                value={searchQuery()}
                onInput={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  setPage(1);
                  loadUsers();
                }}
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1877f2]"
              />
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={roleFilter()}
                onChange={(e) => {
                  setRoleFilter(e.currentTarget.value);
                  setPage(1);
                  loadUsers();
                }}
                class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="">Semua Role</option>
                <option value="admin">Admin</option>
                <option value="coordinator">Koordinator</option>
                <option value="approver">Approver</option>
                <option value="staff">Staff</option>
              </select>

              <select
                value={statusFilter()}
                onChange={(e) => {
                  setStatusFilter(e.currentTarget.value);
                  setPage(1);
                  loadUsers();
                }}
                class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>

              <button
                onClick={loadUsers}
                class="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 text-xs transition"
                title="Muat Ulang"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th class="py-3.5 px-4">Pengguna</th>
                    <th class="py-3.5 px-4">Unit & Jabatan</th>
                    <th class="py-3.5 px-4">Role</th>
                    <th class="py-3.5 px-4">Status</th>
                    <th class="py-3.5 px-4">Akses Modul</th>
                    <th class="py-3.5 px-4">Login Terakhir</th>
                    <th class="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  <Show when={!usersLoading()} fallback={
                    <tr>
                      <td colspan="7" class="py-12 text-center text-slate-400">
                        Memuat data pengguna...
                      </td>
                    </tr>
                  }>
                    <Show when={usersList().length > 0} fallback={
                      <tr>
                        <td colspan="7" class="py-12 text-center text-slate-400">
                          Tidak ada pengguna yang ditemukan.
                        </td>
                      </tr>
                    }>
                      <For each={usersList()}>
                        {(u) => (
                          <tr class="hover:bg-blue-50/40 transition">
                            <td class="py-3.5 px-4">
                              <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-blue-100 text-[#1877f2] font-bold flex items-center justify-center text-xs">
                                  {u.display_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div class="font-bold text-slate-800">{u.display_name}</div>
                                  <div class="text-[10px] text-slate-400 font-mono">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td class="py-3.5 px-4">
                              <div class="font-medium text-slate-700">{u.department}</div>
                              <div class="text-[10px] text-slate-400">{u.job_title}</div>
                            </td>
                            <td class="py-3.5 px-4">
                              <span
                                class={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                                  u.role === 'admin'
                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                    : u.role === 'coordinator'
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : u.role === 'approver'
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {u.role.toUpperCase()}
                              </span>
                            </td>
                            <td class="py-3.5 px-4">
                              <span
                                class={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                                  u.is_active
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                                }`}
                              >
                                {u.is_active ? '✓ Aktif' : '✕ Nonaktif'}
                              </span>
                            </td>
                            <td class="py-3.5 px-4">
                              <span class="px-2 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                {u.accessible_modules_count} Modul
                              </span>
                            </td>
                            <td class="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                              {u.last_login_at || 'Belum pernah'}
                            </td>
                            <td class="py-3.5 px-4 text-right">
                              <div class="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => selectUserForPermissions(u.id)}
                                  class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#1877f2] rounded-lg text-[11px] font-bold transition"
                                  title="Atur Hak Akses"
                                >
                                  🔐 Hak Akses
                                </button>
                                <button
                                  onClick={() => openEditUserModal(u)}
                                  class="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg text-xs transition"
                                  title="Edit Profil"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => triggerResetSession(u)}
                                  class="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg text-xs transition"
                                  title="Paksa Logout (Reset Sesi)"
                                >
                                  🔄
                                </button>
                                <button
                                  onClick={() => triggerToggleActive(u)}
                                  class={`p-1.5 rounded-lg text-xs transition ${
                                    u.is_active
                                      ? 'hover:bg-rose-50 text-rose-600'
                                      : 'hover:bg-emerald-50 text-emerald-600'
                                  }`}
                                  title={u.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                >
                                  {u.is_active ? '🚫' : '✅'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </For>
                    </Show>
                  </Show>
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div class="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
              <div>
                Menampilkan {usersList().length} dari total {totalUsers()} akun
              </div>
              <div class="flex items-center gap-2">
                <button
                  disabled={page() <= 1}
                  onClick={() => {
                    setPage(page() - 1);
                    loadUsers();
                  }}
                  class="px-3 py-1.5 border border-slate-200 rounded-xl bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Sebelumnya
                </button>
                <span class="font-bold text-slate-700">
                  Halaman {page()} / {totalPages()}
                </span>
                <button
                  disabled={page() >= totalPages()}
                  onClick={() => {
                    setPage(page() + 1);
                    loadUsers();
                  }}
                  class="px-3 py-1.5 border border-slate-200 rounded-xl bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* ========================================================================= */}
      {/* SUB-TAB 2: MATRIKS HAK AKSES PER USER */}
      {/* ========================================================================= */}
      <Show when={activeSubTab() === 'permissions'}>
        <div class="space-y-4">
          {/* User Selector Banner */}
          <div class="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold text-slate-500">Pilih Akun:</span>
              <select
                value={selectedUserId() || ''}
                onChange={(e) => {
                  const id = Number(e.currentTarget.value);
                  if (id) loadUserPermissions(id);
                }}
                class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <For each={usersList()}>
                  {(u) => (
                    <option value={u.id}>
                      {u.display_name} ({u.role.toUpperCase()}) — {u.email}
                    </option>
                  )}
                </For>
              </select>
            </div>

            <Show when={selectedUserObj()}>
              {(u) => (
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-slate-500">Default Role:</span>
                  <span class="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded-lg border border-purple-100">
                    {u().role.toUpperCase()}
                  </span>
                  <span class="text-slate-500 ml-2">Status:</span>
                  <span
                    class={`px-2 py-0.5 font-bold rounded-lg ${
                      u().is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {u().is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              )}
            </Show>

            <div class="flex items-center gap-2">
              <button
                onClick={handleResetUserPermissions}
                class="px-3 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition"
              >
                Reset ke Default Role
              </button>
              <button
                disabled={matrixSaving()}
                onClick={handleSaveUserPermissions}
                class="px-4 py-2 bg-[#1877f2] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2 disabled:opacity-50"
              >
                <span>💾</span>
                <span>{matrixSaving() ? 'Menyimpan...' : 'Simpan Hak Akses'}</span>
              </button>
            </div>
          </div>

          <div class="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
            <span>ℹ️</span>
            <span>
              Perubahan hak akses akun <strong>langsung efektif di server</strong> pada request berikutnya tanpa user harus login ulang.
            </span>
          </div>

          {/* Matrix Table */}
          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th class="py-3.5 px-4 w-64">Modul</th>
                    <th class="py-3.5 px-4 w-48">Mode Hak Akses</th>
                    <th class="py-3.5 px-4 text-center">Lihat (View)</th>
                    <th class="py-3.5 px-4 text-center">Buat (Create)</th>
                    <th class="py-3.5 px-4 text-center">Ubah (Edit)</th>
                    <th class="py-3.5 px-4 text-center">Hapus (Delete)</th>
                    <th class="py-3.5 px-4 text-center">Approve</th>
                    <th class="py-3.5 px-4 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  <Show when={!matrixLoading()} fallback={
                    <tr>
                      <td colspan="8" class="py-12 text-center text-slate-400">
                        Memuat matriks hak akses...
                      </td>
                    </tr>
                  }>
                    <For each={matrixRows()}>
                      {(row, idx) => (
                        <tr
                          class={`hover:bg-blue-50/30 transition ${
                            row.is_overridden ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          <td class="py-3.5 px-4">
                            <div class="flex items-center gap-2.5">
                              <span class="text-lg">{row.module_icon || '📦'}</span>
                              <div>
                                <div class="font-bold text-slate-800 flex items-center gap-1.5">
                                  {row.module_label}
                                  <Show when={row.is_overridden}>
                                    <span class="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded border border-amber-200">
                                      OVERRIDE
                                    </span>
                                  </Show>
                                </div>
                                <div class="text-[10px] text-slate-400 font-mono">{row.module_key}</div>
                              </div>
                            </div>
                          </td>

                          {/* Mode Selector */}
                          <td class="py-3.5 px-4">
                            <select
                              value={row.effect}
                              onChange={(e) =>
                                handleMatrixEffectChange(
                                  idx(),
                                  e.currentTarget.value as 'allow' | 'deny' | 'inherit'
                                )
                              }
                              class={`border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none ${
                                row.effect === 'inherit'
                                  ? 'bg-slate-50 border-slate-200 text-slate-600'
                                  : row.effect === 'allow'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : 'bg-rose-50 border-rose-300 text-rose-700'
                              }`}
                            >
                              <option value="inherit">Ikuti Role</option>
                              <option value="allow">Izinkan Khusus</option>
                              <option value="deny">Tolak Akses</option>
                            </select>
                          </td>

                          {/* 5 Actions Checkboxes */}
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              disabled={row.effect === 'deny'}
                              checked={row.effective.view}
                              onChange={() => handleMatrixActionToggle(idx(), 'view')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              disabled={row.effect === 'deny'}
                              checked={row.effective.create}
                              onChange={() => handleMatrixActionToggle(idx(), 'create')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              disabled={row.effect === 'deny'}
                              checked={row.effective.edit}
                              onChange={() => handleMatrixActionToggle(idx(), 'edit')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              disabled={row.effect === 'deny'}
                              checked={row.effective.delete}
                              onChange={() => handleMatrixActionToggle(idx(), 'delete')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              disabled={row.effect === 'deny'}
                              checked={row.effective.approve}
                              onChange={() => handleMatrixActionToggle(idx(), 'approve')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer disabled:opacity-30"
                            />
                          </td>

                          <td class="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleMatrixSelectAllRow(idx())}
                              class="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                            >
                              Semua
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </Show>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Show>

      {/* ========================================================================= */}
      {/* SUB-TAB 3: DEFAULT PER ROLE */}
      {/* ========================================================================= */}
      <Show when={activeSubTab() === 'roles'}>
        <div class="space-y-4">
          {/* Role Tabs */}
          <div class="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-500">Pilih Role:</span>
              <div class="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['admin', 'coordinator', 'approver', 'staff'] as UserRole[]).map((r) => (
                  <button
                    onClick={() => loadRolePermissions(r)}
                    class={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                      selectedRole() === r
                        ? 'bg-white text-[#1877f2] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={roleSaving()}
              onClick={handleSaveRolePermissions}
              class="px-4 py-2 bg-[#1877f2] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2 disabled:opacity-50"
            >
              <span>💾</span>
              <span>{roleSaving() ? 'Menyimpan...' : `Simpan Default ${selectedRole().toUpperCase()}`}</span>
            </button>
          </div>

          {/* Role Matrix Table */}
          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th class="py-3.5 px-4">Modul</th>
                    <th class="py-3.5 px-4 text-center">Lihat (View)</th>
                    <th class="py-3.5 px-4 text-center">Buat (Create)</th>
                    <th class="py-3.5 px-4 text-center">Ubah (Edit)</th>
                    <th class="py-3.5 px-4 text-center">Hapus (Delete)</th>
                    <th class="py-3.5 px-4 text-center">Approve</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  <Show when={!roleLoading()} fallback={
                    <tr>
                      <td colspan="6" class="py-12 text-center text-slate-400">
                        Memuat default hak akses role...
                      </td>
                    </tr>
                  }>
                    <For each={roleRows()}>
                      {(r, idx) => (
                        <tr class="hover:bg-blue-50/30 transition">
                          <td class="py-3.5 px-4">
                            <div class="flex items-center gap-2.5">
                              <span class="text-lg">{r.module_icon || '📦'}</span>
                              <div>
                                <div class="font-bold text-slate-800">{r.module_label}</div>
                                <div class="text-[10px] text-slate-400 font-mono">{r.module_key}</div>
                              </div>
                            </div>
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={r.can_view}
                              onChange={() => handleRoleActionToggle(idx(), 'view')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={r.can_create}
                              onChange={() => handleRoleActionToggle(idx(), 'create')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={r.can_edit}
                              onChange={() => handleRoleActionToggle(idx(), 'edit')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={r.can_delete}
                              onChange={() => handleRoleActionToggle(idx(), 'delete')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td class="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={r.can_approve}
                              onChange={() => handleRoleActionToggle(idx(), 'approve')}
                              class="w-4 h-4 text-[#1877f2] rounded focus:ring-0 cursor-pointer"
                            />
                          </td>
                        </tr>
                      )}
                    </For>
                  </Show>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Show>

      {/* ========================================================================= */}
      {/* SUB-TAB 4: LOG PERUBAHAN AUDIT */}
      {/* ========================================================================= */}
      <Show when={activeSubTab() === 'audit'}>
        <div class="space-y-4">
          <div class="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold text-slate-500">Filter Entitas:</span>
              <select
                value={auditEntityFilter()}
                onChange={(e) => {
                  setAuditEntityFilter(e.currentTarget.value);
                  loadAuditLogs();
                }}
                class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
              >
                <option value="">Semua (Permission & User)</option>
                <option value="permission">Hak Akses (Permission)</option>
                <option value="user">Akun Pengguna (User)</option>
              </select>
            </div>

            <button
              onClick={loadAuditLogs}
              class="px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>Muat Ulang Log</span>
            </button>
          </div>

          <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th class="py-3.5 px-4">Waktu (UTC)</th>
                    <th class="py-3.5 px-4">Aktor</th>
                    <th class="py-3.5 px-4">Entitas</th>
                    <th class="py-3.5 px-4">Aksi</th>
                    <th class="py-3.5 px-4">Catatan Perubahan</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  <Show when={!auditLoading()} fallback={
                    <tr>
                      <td colspan="5" class="py-12 text-center text-slate-400">
                        Memuat riwayat audit...
                      </td>
                    </tr>
                  }>
                    <Show when={auditLogs().length > 0} fallback={
                      <tr>
                        <td colspan="5" class="py-12 text-center text-slate-400">
                          Belum ada catatan log perubahan.
                        </td>
                      </tr>
                    }>
                      <For each={auditLogs()}>
                        {(log) => (
                          <tr class="hover:bg-slate-50 transition font-mono">
                            <td class="py-3.5 px-4 text-slate-500 text-[11px]">
                              {log.created_at}
                            </td>
                            <td class="py-3.5 px-4">
                              <div class="font-bold text-slate-800">{log.actor_name || 'System'}</div>
                              <div class="text-[10px] text-slate-400 font-sans">{log.actor_role}</div>
                            </td>
                            <td class="py-3.5 px-4">
                              <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700">
                                {log.entity_type.toUpperCase()} #{log.entity_id}
                              </span>
                            </td>
                            <td class="py-3.5 px-4">
                              <span
                                class={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                  log.action === 'created'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : log.action === 'deleted'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {log.action.toUpperCase()}
                              </span>
                            </td>
                            <td class="py-3.5 px-4 font-sans text-slate-700 max-w-md">
                              {log.notes || '-'}
                            </td>
                          </tr>
                        )}
                      </For>
                    </Show>
                  </Show>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Show>

      {/* ========================================================================= */}
      {/* USER MODAL (CREATE / EDIT) */}
      {/* ========================================================================= */}
      <Show when={showUserModal()}>
        <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden animate-slideUp">
            <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 class="text-base font-extrabold text-slate-800">
                {editingUserId() ? 'Ubah Data Akun' : 'Tambah Akun Pengguna Baru'}
              </h2>
              <button
                onClick={() => setShowUserModal(false)}
                class="text-slate-400 hover:text-slate-600 text-sm p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} class="p-6 space-y-4 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formDisplayName()}
                  onInput={(e) => setFormDisplayName(e.currentTarget.value)}
                  placeholder="Contoh: Budi Santoso"
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-[#1877f2]"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Email Sekolah</label>
                  <input
                    type="email"
                    required
                    value={formEmail()}
                    onInput={(e) => setFormEmail(e.currentTarget.value)}
                    placeholder="budi@edelweiss.sch.id"
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-[#1877f2]"
                  />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={formUsername()}
                    onInput={(e) => setFormUsername(e.currentTarget.value)}
                    placeholder="budi.santoso"
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-[#1877f2]"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Unit / Departemen</label>
                  <select
                    value={formDepartment()}
                    onChange={(e) => setFormDepartment(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-[#1877f2]"
                  >
                    <For each={DEPARTMENTS}>
                      {(d) => <option value={d}>{d}</option>}
                    </For>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    required
                    value={formJobTitle()}
                    onInput={(e) => setFormJobTitle(e.currentTarget.value)}
                    placeholder="Contoh: Guru Matematika"
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-[#1877f2]"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Role Otorisasi</label>
                  <select
                    value={formRole()}
                    onChange={(e) => setFormRole(e.currentTarget.value as UserRole)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-[#1877f2]"
                  >
                    <option value="staff">Staff (Standar)</option>
                    <option value="approver">Approver (Penyetuju Dokumen)</option>
                    <option value="coordinator">Koordinator Unit</option>
                    <option value="admin">Administrator Penuh</option>
                  </select>
                </div>
                <div class="flex items-center pt-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive()}
                      onChange={(e) => setFormIsActive(e.currentTarget.checked)}
                      class="w-4 h-4 text-[#1877f2] rounded focus:ring-0"
                    />
                    <span class="font-bold text-slate-700">Status Akun Aktif</span>
                  </label>
                </div>
              </div>

              <div class="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  class="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting()}
                  class="px-5 py-2 bg-[#1877f2] hover:bg-blue-600 text-white rounded-xl font-bold shadow disabled:opacity-50"
                >
                  {formSubmitting() ? 'Menyimpan...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <Show when={confirmModalOpen()}>
        <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-slideUp">
            <div class="p-6">
              <h3 class="text-base font-extrabold text-slate-800">{confirmTitle()}</h3>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">{confirmMessage()}</p>

              <div class="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmModalOpen(false)}
                  class="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    const action = confirmAction();
                    if (action) await action();
                    setConfirmModalOpen(false);
                  }}
                  class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow"
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
