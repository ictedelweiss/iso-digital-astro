import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  department: text('department').notNull(),
  jobTitle: text('job_title').notNull(),
  role: text('role').notNull(), // 'admin', 'coordinator', 'approver', 'staff'
  signatureData: text('signature_data'), // base64 string
  hasSignature: integer('has_signature', { mode: 'boolean' }).default(false),
  msId: text('ms_id').unique(),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const purchaseRequisitions = sqliteTable('purchase_requisitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prNumber: text('pr_number').notNull().unique(),
  title: text('title').notNull(),
  requesterId: integer('requester_id').references(() => users.id).notNull(),
  department: text('department').notNull(),
  neededDate: text('needed_date').notNull(),
  budgetStatus: text('budget_status').notNull(), // 'Dianggarkan', 'Belum dianggarkan'
  notes: text('notes'),
  status: text('status').notNull().default('Pending'), // 'Pending', 'Approved', 'Rejected'
  currentApprovalStep: integer('current_approval_step').notNull().default(1),
  requesterSignature: text('requester_signature'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const prItems = sqliteTable('pr_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prId: integer('pr_id').references(() => purchaseRequisitions.id).notNull(),
  itemName: text('item_name').notNull(),
  qty: real('qty').notNull(),
  unit: text('unit').notNull(),
  price: real('price').notNull(),
});

export const prApprovals = sqliteTable('pr_approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prId: integer('pr_id').references(() => purchaseRequisitions.id).notNull(),
  step: integer('step').notNull(),
  role: text('role').notNull(),
  roleTitle: text('role_title').notNull(),
  approverId: integer('approver_id').references(() => users.id),
  status: text('status').notNull().default('pending'), // 'pending', 'current', 'approved', 'rejected'
  date: text('date'),
  signature: text('signature'),
  notes: text('notes'),
});

// Similar tables for leave requests, handover forms, meetings, etc.
// Leaves
export const leaveRequests = sqliteTable('leave_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requesterId: integer('requester_id').references(() => users.id).notNull(),
  department: text('department').notNull(),
  workDays: integer('work_days').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  purpose: text('purpose').notNull(),
  status: text('status').notNull().default('Pending'),
  currentApprovalStep: integer('current_approval_step').notNull().default(1),
  hakPrev: integer('hak_prev').notNull().default(0),
  hakCurr: integer('hak_curr').notNull().default(12),
  totalHak: integer('total_hak').notNull().default(12),
  takenUntil: integer('taken_until').notNull().default(0),
  sisaCurr: integer('sisa_curr').notNull(),
  requestDays: integer('request_days').notNull(),
  sisaAfter: integer('sisa_after').notNull(),
  requesterSignature: text('requester_signature'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const leaveApprovals = sqliteTable('leave_approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  leaveId: integer('leave_id').references(() => leaveRequests.id).notNull(),
  step: integer('step').notNull(),
  role: text('role').notNull(),
  roleTitle: text('role_title').notNull(),
  approverId: integer('approver_id').references(() => users.id),
  status: text('status').notNull().default('pending'),
  date: text('date'),
  signature: text('signature'),
  notes: text('notes'),
});

// Handover
export const handoverForms = sqliteTable('handover_forms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemName: text('item_name').notNull(),
  handoverDate: text('handover_date').notNull(),
  recipientId: integer('recipient_id').references(() => users.id).notNull(),
  quantity: integer('quantity').notNull().default(1),
  serialNumber: text('serial_number'),
  specification: text('specification'),
  loanPeriod: text('loan_period'),
  itemCondition: text('item_condition'),
  notes: text('notes'),
  status: text('status').notNull().default('Pending'),
  currentApprovalStep: integer('current_approval_step').notNull().default(1),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const handoverApprovals = sqliteTable('handover_approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  handoverId: integer('handover_id').references(() => handoverForms.id).notNull(),
  step: integer('step').notNull(),
  role: text('role').notNull(),
  roleTitle: text('role_title').notNull(),
  approverId: integer('approver_id').references(() => users.id),
  status: text('status').notNull().default('pending'),
  date: text('date'),
  signature: text('signature'),
  notes: text('notes'),
});

// Assets
export const assets = sqliteTable('assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assetCode: text('asset_code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  location: text('location').notNull(),
  condition: text('condition').notNull(),
  status: text('status').notNull(), // 'Digunakan', 'Dipinjam', 'Diperbaiki'
  serialNumber: text('serial_number'),
  purchaseDate: text('purchase_date'),
  value: real('value'),
  assignedTo: text('assigned_to'),
});

export const meetings = sqliteTable('meetings', {
  id: text('id').primaryKey(), // using random string or uuid like 'MTG-001'
  title: text('title').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  location: text('location').notNull(),
  leader: text('leader').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  status: text('status').default('active'),
});

/**
 * Append-only audit trail (M-01).
 *
 * Approval rows used to be deleted and re-inserted on every update, so the
 * history of who decided what — and when — was destroyed. ISO 21001:2018
 * requires retained, traceable records, so every state change is now written
 * here and this table is never updated or deleted from.
 */
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 'pr' | 'leave' | 'handover' | 'meeting' | 'asset' | 'user' */
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  /** Approval step number, when the event belongs to one. */
  step: integer('step'),
  /** 'created' | 'updated' | 'approved' | 'rejected' | 'deleted' */
  action: text('action').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  /** Identity is captured at write time: a later rename must not rewrite history. */
  actorId: integer('actor_id'),
  actorName: text('actor_name'),
  actorEmail: text('actor_email'),
  actorRole: text('actor_role'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const meetingAttendees = sqliteTable('meeting_attendees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  meetingId: text('meeting_id').references(() => meetings.id).notNull(),
  userId: text('user_id'), // Nullable for external guests, uses MS Graph UUID for internal
  name: text('name').notNull(),
  division: text('division').notNull(), // Department or Agency
  email: text('email'),
  signaturePath: text('signature_path').notNull(), // Base64 or URL
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});
