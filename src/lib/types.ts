export type DeviceView = 'desktop' | 'tablet' | 'mobile' | 'responsive';

export type Department =
  | 'KB/TK'
  | 'SD'
  | 'SMP'
  | 'PKBM'
  | 'GA'
  | 'Customer Service Officer'
  | 'Finance & Accounting'
  | 'HRD'
  | 'ICT'
  | 'Management'
  | 'Marketing'
  | 'Operator';

export type NavTab = 
  | 'dashboard'
  | 'purchase-requisition'
  | 'leave-request'
  | 'handover-form'
  | 'meeting-attendance'
  | 'asset-management'
  | 'admin-access'
  | 'pdf-preview';

export type UserRole = 'admin' | 'approver' | 'coordinator' | 'staff';

export interface UserProfile {
  id: string | number;
  displayName: string;
  email: string;
  username: string;
  department: Department | string;
  jobTitle: string;
  role: UserRole;
  signature_data?: string; // base64 data URL
  signature_path?: string;
  has_signature: boolean;
  ms_id?: string;
  avatar_url?: string;
  created_at?: string;
  is_active?: boolean;
  session_version?: number;
  last_login_at?: string | null;
}

export const MODULE_KEYS = [
  'dashboard',
  'purchase-requisition',
  'leave-request',
  'handover-form',
  'meeting-attendance',
  'asset-management',
  'admin-access',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve';
export type ModuleAccess = Record<Action, boolean>;
export type PermissionMap = Record<string, ModuleAccess>;

export interface ModuleRegistryItem {
  key: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export interface AdminUserListItem {
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

export interface UserPermissionDetail {
  module_key: string;
  module_label: string;
  module_icon?: string | null;
  effective: ModuleAccess;
  role_default: ModuleAccess;
  is_overridden: boolean;
  effect: 'allow' | 'deny' | 'inherit';
}

export interface RolePermissionDetail {
  module_key: string;
  module_label: string;
  module_icon?: string | null;
  permissions: ModuleAccess;
}


export interface PrItem {
  id: number;
  item_name: string;
  qty: number;
  unit: string;
  price: number;
}

export interface ApprovalStep {
  step: number;
  role: string;
  roleTitle: string;
  approverName: string;
  approverEmail?: string;
  status: 'pending' | 'approved' | 'rejected' | 'current';
  date?: string;
  signature?: string;
  notes?: string;
}

export type BudgetStatus = 'Dianggarkan' | 'Belum dianggarkan' | 'Tidak Memilih';

export interface PurchaseRequisition {
  id: number;
  pr_number: string;
  title: string;
  requester: string;
  requester_id?: number;
  requester_email?: string;
  department: Department | string;
  needed_date: string;
  budget_status: BudgetStatus;
  notes: string;
  attachment_name?: string | null;
  attachment_data?: string | null;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  current_approval_step: number;
  requester_signature?: string;
  created_at: string;
  items: PrItem[];
  approvals: ApprovalStep[];
}

export interface LeaveRequest {
  id: number;
  name: string;
  position: string;
  department: Department | string;
  work_days: number;
  start_date: string;
  end_date: string;
  purpose: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  current_approval_step: number;
  hak_prev: number;
  hak_curr: number;
  total_hak: number;
  taken_until: number;
  sisa_curr: number;
  request_days: number;
  sisa_after: number;
  signature_pemohon?: string;
  created_at: string;
  approvals: ApprovalStep[];
}

export interface EmployeeLeaveAllocation {
  userId: number;
  displayName: string;
  username: string;
  email: string;
  department: string;
  jobTitle: string;
  role: string;
  year: number;
  hakPrev: number;
  hakCurr: number;
  totalHak: number;
  takenDays: number;
  sisa: number;
  notes?: string;
  updatedAt?: string | null;
  isCustomized: boolean;
}

export interface HandoverForm {
  id: number;
  item_name: string;
  handover_date: string;
  recipient_name: string;
  recipient_email: string;
  recipient_department: Department | string;
  quantity: number;
  serial_number: string;
  specification: string;
  loan_period: string;
  item_condition: string;
  notes: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  current_approval_step: number;
  ict_signature_path?: string;
  created_at: string;
  approvals: ApprovalStep[];
}

export interface Attendee {
  id: number;
  meeting_id: string;
  name: string;
  division: Department | string;
  email?: string;
  signature_path?: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  leader: string;
  agenda: string[];
  created_at: string;
  attendees: Attendee[];
}

export interface Asset {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  location: string;
  condition: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
  status: 'Digunakan' | 'Tersedia' | 'Maintenance' | 'Dipinjam';
  serial_number: string;
  purchase_date: string;
  value: number;
  assigned_to?: string;
}
