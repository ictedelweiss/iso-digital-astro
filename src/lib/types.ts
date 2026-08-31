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
  | 'pdf-preview';

export interface UserProfile {
  id: string | number;
  displayName: string;
  email: string;
  username: string;
  department: Department;
  jobTitle: string;
  role: 'admin' | 'approver' | 'user' | 'staff' | 'coordinator';
  signature_data?: string; // base64 data URL
  signature_path?: string;
  has_signature: boolean;
  ms_id?: string;
  avatar_url?: string;
  created_at?: string;
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

export interface PurchaseRequisition {
  id: number;
  pr_number: string;
  title: string;
  requester: string;
  department: Department | string;
  needed_date: string;
  budget_status: 'Dianggarkan' | 'Belum dianggarkan';
  notes: string;
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
