import { createSignal, createResource, createEffect, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { PurchaseRequisition, PrItem, UserProfile, Department, BudgetStatus } from '../lib/types';
import { SAMPLE_SIGNATURE_1, OFFICIAL_DEPARTMENTS } from '../lib/dummyData';
import { formatDisplayPrNumber, isDraftPrNumber } from '../lib/prNumber';

const fetchPrs = async () => {
  const res = await fetch('/api/prs');
  if (!res.ok) throw new Error('Failed to fetch PRs');
  const json = await res.json();
  return json.data as PurchaseRequisition[];
};

interface Props {
  currentUser?: UserProfile;
  onOpenPdf: (pr: PurchaseRequisition) => void;
  onOpenSignatureModal: (title: string, onSave: (sig: string) => void) => void;
}

export default function PurchaseRequisitionView(props: Props) {
  const [prs, { mutate: setPrs, refetch }] = createResource(fetchPrs, { initialValue: [] });
  const [selectedPrId, setSelectedPrId] = createSignal<number | null>(null);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editPrId, setEditPrId] = createSignal<number | null>(null);
  const [filterScope, setFilterScope] = createSignal<'all' | 'needs_my_approval' | 'my_requests'>('all');
  const [filterStatus, setFilterStatus] = createSignal<string>('all');
  const [searchQuery, setSearchQuery] = createSignal<string>('');
  const [filterPeriod, setFilterPeriod] = createSignal<'all' | 'weekly' | 'monthly'>('all');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [showAccountingApproveModal, setShowAccountingApproveModal] = createSignal(false);
  const [showConfirmApproveModal, setShowConfirmApproveModal] = createSignal(false);
  const [confirmApprovePrId, setConfirmApprovePrId] = createSignal<number | null>(null);
  const [confirmApproveStepNum, setConfirmApproveStepNum] = createSignal<number>(1);
  const [approvePrId, setApprovePrId] = createSignal<number | null>(null);
  const [approvePrNumber, setApprovePrNumber] = createSignal('');
  const [approveBudgetStatus, setApproveBudgetStatus] = createSignal<BudgetStatus>('Dianggarkan');
  const [approveNotes, setApproveNotes] = createSignal('');

  // Derive selected PR reactively based on selectedPrId and prs list
  const selectedPr = () => {
    const list = prs();
    if (!list || list.length === 0) return null;
    const currentId = selectedPrId();
    if (currentId != null) {
      const found = list.find((p) => p.id === currentId);
      if (found) return found;
    }
    return list[0] ?? null;
  };

  // Run URL param check on initial load to set selectedPrId
  createEffect(() => {
    const list = prs();
    if (list.length === 0) return;

    if (selectedPrId() === null) {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const idParam = urlParams.get('id') || urlParams.get('pr_id');
        const docParam = urlParams.get('doc');

        if (idParam || docParam) {
          const found = list.find(
            (p) =>
              (idParam && p.id === Number(idParam)) ||
              (docParam && p.pr_number.toLowerCase() === docParam.toLowerCase())
          );
          if (found) {
            setSelectedPrId(found.id);
            return;
          }
        }
      }
      setSelectedPrId(list[0].id);
    }
  });

  // Form State
  const [formTitle, setFormTitle] = createSignal('');
  const [formRequester, setFormRequester] = createSignal(props.currentUser?.displayName || '');
  const [formDepartment, setFormDepartment] = createSignal<Department>((props.currentUser?.department as Department) || 'ICT');
  const [formNeededDate, setFormNeededDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [formBudgetStatus, setFormBudgetStatus] = createSignal<BudgetStatus>('Tidak Memilih');
  const [formNotes, setFormNotes] = createSignal('');
  const [formAttachmentName, setFormAttachmentName] = createSignal('');
  const [formAttachmentData, setFormAttachmentData] = createSignal<string | null>(null);
  const [formSignature, setFormSignature] = createSignal(props.currentUser?.signature_data || SAMPLE_SIGNATURE_1);
  const [formItems, setFormItems] = createStore<PrItem[]>([
    { id: 1, item_name: 'Access Point TP-Link Omada EAP610 WiFi 6', qty: 2, unit: 'Unit', price: 1350000 },
    { id: 2, item_name: 'Patch Cord Cat6 2 Meter Original', qty: 10, unit: 'Pcs', price: 35000 },
  ]);

  const addItemRow = () => {
    const nextId = (formItems.length > 0 ? Math.max(...formItems.map((i) => i.id || 0)) : 0) + 1;
    setFormItems([...formItems, { id: nextId, item_name: '', qty: 1, unit: 'Unit', price: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal adalah 5 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormAttachmentName(file.name);
      setFormAttachmentData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateBudgetStatus = async (prId: number, status: BudgetStatus) => {
    try {
      const res = await fetch(`/api/prs/${prId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_status: status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status anggaran.');

      await refetch();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status anggaran.');
    }
  };

  const populateFormForEdit = (pr: PurchaseRequisition) => {
    setFormTitle(pr.title);
    setFormRequester(pr.requester);
    setFormDepartment(pr.department as Department);
    setFormNeededDate(pr.needed_date);
    setFormBudgetStatus(pr.budget_status || 'Tidak Memilih');
    setFormNotes(pr.notes || '');
    setFormAttachmentName(pr.attachment_name || '');
    setFormAttachmentData(pr.attachment_data || null);
    setFormItems(
      pr.items && pr.items.length > 0
        ? pr.items.map((it, idx) => ({ ...it, id: it.id || idx + 1 }))
        : [{ id: 1, item_name: '', qty: 1, unit: 'Unit', price: 0 }]
    );
    setIsEditMode(true);
    setEditPrId(pr.id);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormRequester(props.currentUser?.displayName || '');
    setFormDepartment((props.currentUser?.department as Department) || 'ICT');
    setFormNeededDate(new Date().toISOString().split('T')[0]);
    setFormBudgetStatus('Tidak Memilih');
    setFormNotes('');
    setFormAttachmentName('');
    setFormAttachmentData(null);
    setFormItems([
      { id: 1, item_name: '', qty: 1, unit: 'Unit', price: 0 },
    ]);
    setIsEditMode(false);
    setEditPrId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const updateItem = (index: number, key: keyof PrItem, value: any) => {
    setFormItems(index, key, value);
  };

  const calcGrandTotal = () => {
    return formItems.reduce((acc, item) => acc + (Number(item.qty || 0) * Number(item.price || 0)), 0);
  };

  const handleCreateSubmit = async (e: Event) => {
    e.preventDefault();
    if (isSubmitting()) return;

    const validItems = formItems
      .map((i) => ({
        item_name: (i.item_name || '').trim(),
        qty: Number(i.qty) || 1,
        unit: (i.unit || 'Unit').trim() || 'Unit',
        price: Number(i.price) || 0,
      }))
      .filter((i) => i.item_name !== '');

    if (validItems.length === 0) {
      alert('Mohon isi minimal 1 nama barang pada daftar barang.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode() && editPrId()) {
        const res = await fetch(`/api/prs/${editPrId()}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle() || 'Pengadaan Perangkat Baru',
            department: formDepartment(),
            needed_date: formNeededDate(),
            budget_status: formBudgetStatus(),
            notes: formNotes() || null,
            attachment_name: formAttachmentName() || null,
            attachment_data: formAttachmentData() || null,
            items: validItems,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui PR.');

        await refetch();
        setShowCreateModal(false);
      } else {
        const res = await fetch('/api/prs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle() || 'Pengadaan Perangkat Baru',
            department: formDepartment(),
            needed_date: formNeededDate(),
            budget_status: 'Tidak Memilih',
            notes: formNotes() || null,
            attachment_name: formAttachmentName() || null,
            attachment_data: formAttachmentData() || null,
            requester_signature: formSignature() || props.currentUser?.signature_data || SAMPLE_SIGNATURE_1,
            items: validItems,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan PR.');

        await refetch();
        setShowCreateModal(false);
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses PR.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (prId: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus PR ini?")) return;
    fetch(`/api/prs/${prId}`, {
      method: 'DELETE'
    }).then(() => {
      setPrs(prs().filter(p => p.id !== prId));
      if (selectedPrId() === prId) setSelectedPrId(null);
    }).catch(err => alert("Error deleting PR: " + err));
  };

  /**
   * Persist an approval decision through the server (H-01 fix).
   *
   * The browser no longer invents the approver name, signature or resulting
   * status — it only sends "approve" and reads the authoritative state back
   * from the API response. This keeps the signature on the document identical
   * to the one the server recorded in the database and the audit trail.
   */
  const handleApproveStep = async (prId: number) => {
    const doc = prs().find(p => p.id === prId);
    if (!doc) return;
    const currentStep = doc.current_approval_step;
    const currentApproval = (doc.approvals || []).find((a) => a.step === currentStep);
    const isAccountingStep = currentApproval?.role === 'accounting' || currentStep === 2;

    // Rule 2 & 1: If it's Accounting approval (Step 2), prompt Accounting to assign PR number and budget status
    if (isAccountingStep) {
      setApprovePrId(prId);
      setApprovePrNumber(isDraftPrNumber(doc.pr_number) ? '' : doc.pr_number);
      setApproveBudgetStatus(doc.budget_status !== 'Tidak Memilih' ? doc.budget_status : 'Dianggarkan');
      setApproveNotes('');
      setShowAccountingApproveModal(true);
      return;
    }

    // Pop up konfirmasi persetujuan agar tidak salah klik
    setConfirmApprovePrId(prId);
    setConfirmApproveStepNum(currentStep);
    setShowConfirmApproveModal(true);
  };

  const executeApprove = async (
    prId: number,
    currentStep: number,
    extraPayload?: { pr_number?: string; budget_status?: BudgetStatus; notes?: string }
  ) => {
    try {
      const res = await fetch(`/api/prs/${prId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          notes: extraPayload?.notes,
          pr_number: extraPayload?.pr_number,
          budget_status: extraPayload?.budget_status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui dokumen.');

      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui dokumen.');
    }
  };

  const handleConfirmAccountingApprove = async (e: Event) => {
    e.preventDefault();
    const prId = approvePrId();
    if (!prId) return;
    const doc = prs().find(p => p.id === prId);
    if (!doc) return;

    setShowAccountingApproveModal(false);
    await executeApprove(prId, doc.current_approval_step, {
      pr_number: approvePrNumber().trim() || undefined,
      budget_status: approveBudgetStatus(),
      notes: approveNotes().trim() || undefined,
    });
  };

  const isMyRequest = (pr: PurchaseRequisition) => {
    if (!props.currentUser) return false;
    const currentUserId = Number(props.currentUser.id);
    if (pr.requester_id && currentUserId) {
      return pr.requester_id === currentUserId;
    }
    return (
      (props.currentUser.displayName && pr.requester.toLowerCase() === props.currentUser.displayName.toLowerCase()) ||
      (props.currentUser.email && pr.requester_email && pr.requester_email.toLowerCase() === props.currentUser.email.toLowerCase())
    );
  };

  const isAwaitingMyApproval = (pr: PurchaseRequisition) => {
    if (!props.currentUser || pr.status !== 'Pending') return false;
    // Approver cannot approve their own PR (segregation of duties)
    if (isMyRequest(pr) && props.currentUser.role !== 'admin') return false;

    const currentStep = pr.current_approval_step;
    const currentApproval = (pr.approvals || []).find((a) => a.step === currentStep);
    if (!currentApproval) return false;

    const userRole = props.currentUser.role;
    if (userRole === 'admin') return true;

    const stepRole = (currentApproval.role || '').toLowerCase();
    if (stepRole === 'koordinator' || stepRole === 'ict') {
      return userRole === 'coordinator' && (!props.currentUser.department || props.currentUser.department === pr.department);
    }
    if (stepRole === 'accounting' || stepRole === 'finance') {
      return userRole === 'approver' || props.currentUser.department === 'Finance & Accounting' || props.currentUser.department === 'Accounting';
    }
    if (stepRole === 'ketua_yayasan') {
      return userRole === 'admin';
    }
    return userRole === 'approver';
  };

  const filteredPrs = () => {
    return prs().filter(pr => {
      // Scope filter (Needs Approval vs My Requests vs All)
      if (filterScope() === 'needs_my_approval' && !isAwaitingMyApproval(pr)) return false;
      if (filterScope() === 'my_requests' && !isMyRequest(pr)) return false;

      // Status filter
      const matchStatus = filterStatus() === 'all' || pr.status.toLowerCase() === filterStatus().toLowerCase();

      // Period filter (Semua, 7 Hari Terakhir, Bulan Ini)
      let matchPeriod = true;
      if (filterPeriod() !== 'all') {
        const dateStr = pr.created_at || pr.needed_date;
        if (dateStr) {
          const itemDate = new Date(dateStr.replace(' ', 'T'));
          if (!isNaN(itemDate.getTime())) {
            const now = new Date();
            if (filterPeriod() === 'weekly') {
              // 7 hari terakhir
              const diffMs = now.getTime() - itemDate.getTime();
              const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
              matchPeriod = diffMs >= 0 && diffMs <= sevenDaysMs;
            } else if (filterPeriod() === 'monthly') {
              // Bulan & tahun yang sama dengan saat ini
              matchPeriod = itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
            }
          }
        }
      }

      // Search filter
      const matchSearch = pr.title.toLowerCase().includes(searchQuery().toLowerCase()) ||
                          pr.pr_number.toLowerCase().includes(searchQuery().toLowerCase()) ||
                          pr.requester.toLowerCase().includes(searchQuery().toLowerCase());
      return matchStatus && matchPeriod && matchSearch;
    });
  };

  // Badge counts for filter tabs
  const scopeCounts = () => {
    const all = prs();
    return {
      all: all.length,
      needs_my_approval: all.filter(isAwaitingMyApproval).length,
      my_requests: all.filter(isMyRequest).length,
    };
  };

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-800">Purchase Requisition (PR)</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono font-bold bg-blue-50 text-[#1877f2] border border-blue-200 rounded-lg">
              YSPE-FNA-FM-001 Rev.03
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Pengadaan barang/jasa operasional sekolah, verifikasi anggaran, dan persetujuan 3 tingkat berjenjang.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          <span>➕</span> Buat Form PR Baru
        </button>
      </div>

      {/* Primary Scope Tabs (Semua / Perlu Persetujuan Saya / Pengajuan Saya) */}
      <div class="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilterScope('all')}
          class={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 shrink-0 ${
            filterScope() === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>📋 Semua PR</span>
          <span class={`px-1.5 py-0.2 rounded-full text-[10px] ${
            filterScope() === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'
          }`}>
            {scopeCounts().all}
          </span>
        </button>

        <button
          onClick={() => setFilterScope('needs_my_approval')}
          class={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 shrink-0 ${
            filterScope() === 'needs_my_approval'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <span>⏳ Perlu Persetujuan Saya</span>
          <span class={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            filterScope() === 'needs_my_approval' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            {scopeCounts().needs_my_approval}
          </span>
        </button>

        <button
          onClick={() => setFilterScope('my_requests')}
          class={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 shrink-0 ${
            filterScope() === 'my_requests'
              ? 'bg-[#1877f2] text-white shadow-sm'
              : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
          }`}
        >
          <span>👤 Pengajuan Saya</span>
          <span class={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            filterScope() === 'my_requests' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
          }`}>
            {scopeCounts().my_requests}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Cari nomor PR, judul, atau pemohon..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white"
          />
        </div>

        <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Filter Periode */}
          <div class="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span class="text-[11px] font-semibold text-slate-500 px-1.5">📅 Periode:</span>
            {[
              { key: 'all', label: 'Semua' },
              { key: 'weekly', label: 'Mingguan (7 Hari)' },
              { key: 'monthly', label: 'Bulan Ini' },
            ].map(p => (
              <button
                type="button"
                onClick={() => setFilterPeriod(p.key as any)}
                class={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterPeriod() === p.key
                    ? 'bg-white text-[#1877f2] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filter Status */}
          <div class="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span class="text-[11px] font-semibold text-slate-500 px-1.5">Status:</span>
            {(['all', 'Pending', 'Approved'] as const).map(st => (
              <button
                type="button"
                onClick={() => setFilterStatus(st)}
                class={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterStatus() === st
                    ? 'bg-[#1877f2] text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {st === 'all' ? 'Semua' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: 2 Column Layout (List on left, Detail on right for Desktop) */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: PR List (5 cols on lg) */}
        <div class="lg:col-span-5 space-y-3">
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Daftar PR ({filteredPrs().length})
          </div>

          <div class="space-y-3">
            <For each={filteredPrs()}>
              {(pr) => {
                const isSelected = selectedPr()?.id === pr.id;
                const needsApproval = isAwaitingMyApproval(pr);
                const isMine = isMyRequest(pr);

                return (
                  <div
                    onClick={() => setSelectedPrId(pr.id)}
                    class={`p-4 rounded-2xl border cursor-pointer transition flex flex-col gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#1877f2] shadow-sm ring-2 ring-[#1877f2]'
                        : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'
                    }`}
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <Show
                          when={!isDraftPrNumber(pr.pr_number)}
                          fallback={
                            <span class="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200">
                              ⏳ Menunggu No. PR
                            </span>
                          }
                        >
                          <span class="text-xs font-mono font-bold text-[#1877f2]">{pr.pr_number}</span>
                        </Show>
                        {pr.attachment_name && <span title="Memiliki dokumen pendukung" class="text-xs">📎</span>}
                        {needsApproval && (
                          <span class="px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-500 text-white rounded-md shadow-xs animate-pulse">
                            ⏳ Perlu Anda Approve
                          </span>
                        )}
                        {isMine && !needsApproval && (
                          <span class="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-md">
                            Diajukan Anda
                          </span>
                        )}
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <span class={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                          pr.budget_status === 'Dianggarkan'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : pr.budget_status === 'Belum dianggarkan'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {pr.budget_status === 'Tidak Memilih' ? 'Budget ?' : pr.budget_status}
                        </span>
                        <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          pr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {pr.status}
                        </span>
                      </div>
                    </div>

                    <div class="text-sm font-bold text-slate-800 line-clamp-1">{pr.title}</div>

                    <div class="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                      <span>{pr.requester} ({pr.department})</span>
                      <span class="font-mono font-semibold text-slate-800">
                        Rp {pr.items.reduce((s, i) => s + (i.qty * i.price), 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Right Column: Selected PR Detail, Approval Tracker, & PDF Preview Button (7 cols) */}
        <div class="lg:col-span-7">
          <Show when={selectedPr()} fallback={
            <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
              Pilih Purchase Requisition dari daftar untuk melihat detail.
            </div>
          }>
            {(() => {
              const pr = selectedPr()!;
              const totalAmount = (pr.items || []).reduce((acc, i) => acc + (Number(i.qty || 0) * Number(i.price || 0)), 0);

              return (
                <div class="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  {/* Top Bar inside Detail */}
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div class="flex items-center gap-2">
                        <Show
                          when={!isDraftPrNumber(pr.pr_number)}
                          fallback={
                            <span class="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-lg border border-amber-300">
                              ⏳ Menunggu Penerbitan No. PR (Accounting)
                            </span>
                          }
                        >
                          <span class="text-xs font-mono font-bold text-[#1877f2]">{pr.pr_number}</span>
                        </Show>
                        <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          pr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {pr.status}
                        </span>
                      </div>
                      <h2 class="text-base sm:text-lg font-bold text-slate-800 mt-1">{pr.title}</h2>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        onClick={() => props.onOpenPdf(pr)}
                        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center justify-center gap-2 shrink-0"
                      >
                        📄 <span>Lihat & Cetak PDF ISO</span>
                      </button>
                      
                      {pr.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => populateFormForEdit(pr)}
                            class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-sm"
                            title="Edit PR"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(pr.id)}
                            class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition shadow-sm border border-rose-100"
                            title="Hapus PR"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <div class="text-slate-500">Pemohon</div>
                      <div class="font-bold text-slate-800 mt-0.5">{pr.requester}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Departemen</div>
                      <div class="font-bold text-slate-800 mt-0.5">{pr.department}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Tgl Dibutuhkan</div>
                      <div class="font-bold text-slate-800 mt-0.5">{pr.needed_date}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Status Budget</div>
                      <div class={`font-bold mt-0.5 ${
                        pr.budget_status === 'Dianggarkan'
                          ? 'text-emerald-600'
                          : pr.budget_status === 'Belum dianggarkan'
                          ? 'text-amber-600'
                          : 'text-[#1877f2]'
                      }`}>
                        {pr.budget_status === 'Tidak Memilih' ? '⏳ Belum Memilih' : pr.budget_status}
                      </div>
                    </div>
                  </div>

                  {/* Dokumen Pendukung Lampiran */}
                  <Show when={pr.attachment_data}>
                    <div class="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3 overflow-hidden">
                        <span class="text-2xl">
                          {(pr.attachment_name || '').toLowerCase().endsWith('.pdf') ? '📄' : '📎'}
                        </span>
                        <div class="truncate">
                          <div class="text-xs font-bold text-slate-800 truncate">
                            {pr.attachment_name || 'Dokumen Pendukung'}
                          </div>
                          <div class="text-[10px] text-slate-500">Dokumen pendukung pengadaan (Quotation/Brosur/Spesifikasi)</div>
                        </div>
                      </div>
                      <a
                        href={pr.attachment_data!}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={pr.attachment_name || 'dokumen-pendukung'}
                        class="px-3 py-1.5 bg-white hover:bg-blue-50 text-[#1877f2] border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0"
                      >
                        <span>👁️</span> <span>Unduh / Lihat Dokumen</span>
                      </a>
                    </div>
                  </Show>

                  {/* Accounting Quick Budget Status Verifier */}
                  <Show when={pr.status === 'Pending' && (props.currentUser?.department === 'Finance & Accounting' || props.currentUser?.department === 'Accounting' || props.currentUser?.role === 'admin' || props.currentUser?.role === 'approver')}>
                    <div class="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div>
                        <div class="font-bold text-amber-900 flex items-center gap-1.5">
                          <span>💰</span> Verifikasi Status Anggaran (Bagian Accounting):
                        </div>
                        <div class="text-[11px] text-amber-700 mt-0.5">
                          Status saat ini: <span class="font-bold uppercase underline">{pr.budget_status}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateBudgetStatus(pr.id, 'Dianggarkan')}
                          class={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 ${
                            pr.budget_status === 'Dianggarkan'
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                              : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          <span>✓</span> Dianggarkan (RKAS)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBudgetStatus(pr.id, 'Belum dianggarkan')}
                          class={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 ${
                            pr.budget_status === 'Belum dianggarkan'
                              ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                              : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          <span>⚠️</span> Belum Dianggarkan
                        </button>
                      </div>
                    </div>
                  </Show>

                  {/* Items List / Table */}
                  <div>
                    <div class="text-xs font-bold text-slate-700 mb-2">Daftar Item ({pr.items.length})</div>
                    <div class="overflow-x-auto rounded-2xl border border-slate-200">
                      <table class="w-full text-xs text-left">
                        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th class="p-3 text-center w-10">No</th>
                            <th class="p-3">Deskripsi Item</th>
                            <th class="p-3 text-center">Jumlah</th>
                            <th class="p-3 text-center">Satuan</th>
                            <th class="p-3 text-right">Harga</th>
                            <th class="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
                          <For each={pr.items || []}>
                            {(item, idx) => (
                              <tr>
                                <td class="p-3 text-center text-slate-400">{idx() + 1}</td>
                                <td class="p-3 font-semibold text-slate-800">{item.item_name}</td>
                                <td class="p-3 text-center text-slate-700">{item.qty}</td>
                                <td class="p-3 text-center text-slate-500">{item.unit}</td>
                                <td class="p-3 text-right font-mono text-slate-700">Rp {item.price.toLocaleString('id-ID')}</td>
                                <td class="p-3 text-right font-mono font-bold text-slate-900">
                                  Rp {(item.qty * item.price).toLocaleString('id-ID')}
                                </td>
                              </tr>
                            )}
                          </For>
                          <tr class="bg-blue-50/60 font-bold border-t-2 border-blue-200">
                            <td colspan="5" class="p-3 text-right text-slate-700">Grand Total</td>
                            <td class="p-3 text-right font-mono text-sm text-[#1877f2]">
                              Rp {totalAmount.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Approval Workflow Stepper */}
                  <div class="space-y-3 pt-2 border-t border-slate-100">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                      <div class="text-xs font-bold text-slate-700">Alur Persetujuan (3-Step Approval)</div>
                      <Show
                        when={pr.status === 'Pending' && isAwaitingMyApproval(pr)}
                        fallback={
                          pr.status === 'Pending' && isMyRequest(pr) && props.currentUser?.role !== 'admin' ? (
                            <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                              🔒 Pengajuan Anda sendiri (Menunggu approver lain)
                            </span>
                          ) : null
                        }
                      >
                        <button
                          onClick={() => handleApproveStep(pr.id)}
                          class="px-3.5 py-1.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                        >
                          ✍️ Setujui Step {pr.current_approval_step}
                        </button>
                      </Show>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <For each={pr.approvals || []}>
                        {(app) => (
                          <div class={`p-3.5 rounded-2xl border text-xs flex flex-col justify-between ${
                            app.status === 'approved'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : app.status === 'current'
                              ? 'bg-amber-50 border-amber-300 text-amber-800 ring-1 ring-amber-300 animate-pulse'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}>
                            <div>
                              <div class="flex items-center justify-between text-[10px] font-mono">
                                <span>STEP {app.step}</span>
                                <span class="font-bold uppercase">
                                  {app.status === 'approved' ? '✓ Disetujui' : app.status === 'current' ? '⏳ Menunggu' : 'Antrian'}
                                </span>
                              </div>
                              <div class="font-bold text-slate-900 mt-1 text-sm">{app.roleTitle}</div>
                              <div class="text-slate-600 text-[11px] mt-0.5">{app.approverName}</div>
                            </div>

                            <div class="mt-3 pt-2 border-t border-slate-200 text-[10px] flex items-center justify-between">
                              {app.signature ? (
                                <span class="text-emerald-700 font-bold">✓ TTD Digital OK</span>
                              ) : (
                                <span>Belum ditandatangani</span>
                              )}
                              <span class="font-mono text-slate-500">{app.date ? app.date.split(' ')[0] : '-'}</span>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Show>
        </div>
      </div>

      {/* Modal Buat PR Baru */}
      <Show when={showCreateModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                  📝 Buat Purchase Requisition (PR)
                </h3>
                <p class="text-xs text-slate-500">Form pengajuan pengadaan barang/jasa standar ISO 21001:2018</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} class="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Row 1 */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Pemohon</label>
                  <input
                    type="text"
                    value={formRequester()}
                    onInput={(e) => setFormRequester(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Departemen</label>
                  <select
                    value={formDepartment()}
                    onChange={(e) => setFormDepartment(e.currentTarget.value as Department)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  >
                    <For each={OFFICIAL_DEPARTMENTS}>
                      {(dept) => <option value={dept}>{dept}</option>}
                    </For>
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Judul Pengadaan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pengadaan Switch Lab Komputer"
                    value={formTitle()}
                    onInput={(e) => setFormTitle(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Tanggal Dibutuhkan</label>
                  <input
                    type="date"
                    value={formNeededDate()}
                    onInput={(e) => setFormNeededDate(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Status Anggaran (Diisi hanya oleh Accounting) */}
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-2 text-slate-700">
                  <span class="text-base">💰</span>
                  <div>
                    <span class="font-semibold text-slate-800">Status Anggaran (Budget): </span>
                    <span class="text-slate-600">Diverifikasi & ditentukan oleh Bagian Accounting pada Step 2 persetujuan.</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-[#1877f2] rounded-md border border-blue-200 shrink-0">
                  Otomatis oleh Accounting
                </span>
              </div>

              {/* Dynamic Items Table */}
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-semibold text-slate-700">Daftar Barang / Jasa</label>
                  <button
                    type="button"
                    onClick={addItemRow}
                    class="px-2.5 py-1 bg-blue-50 text-[#1877f2] hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition"
                  >
                    + Tambah Baris
                  </button>
                </div>

                <div class="space-y-2">
                  <For each={formItems}>
                    {(item, idx) => (
                      <div class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus-within:border-blue-300 transition">
                        <span class="text-xs font-bold text-slate-400 w-5 text-center">{idx() + 1}</span>
                        <input
                          type="text"
                          placeholder="Nama / Deskripsi Barang"
                          value={item.item_name}
                          onInput={(e) => updateItem(idx(), 'item_name', e.currentTarget.value)}
                          required
                          class="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#1877f2]"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.qty}
                          onInput={(e) => updateItem(idx(), 'qty', parseFloat(e.currentTarget.value) || 0)}
                          required
                          class="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center text-slate-800 focus:outline-none focus:border-[#1877f2]"
                        />
                        <input
                          type="text"
                          placeholder="Satuan"
                          value={item.unit}
                          onInput={(e) => updateItem(idx(), 'unit', e.currentTarget.value)}
                          class="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center text-slate-800 focus:outline-none focus:border-[#1877f2]"
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Harga Satuan"
                          value={item.price}
                          onInput={(e) => updateItem(idx(), 'price', parseFloat(e.currentTarget.value) || 0)}
                          required
                          class="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-slate-800 focus:outline-none focus:border-[#1877f2]"
                        />
                        <button
                          type="button"
                          disabled={formItems.length <= 1}
                          onClick={() => removeItemRow(idx())}
                          class="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs"
                          title="Hapus Baris"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </For>
                </div>

                <div class="flex justify-end pt-2 text-xs font-bold text-[#1877f2]">
                  Total Estimasi: Rp {calcGrandTotal().toLocaleString('id-ID')}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows="2"
                  placeholder="Penjelasan urgensi atau spesifikasi teknis khusus..."
                  value={formNotes()}
                  onInput={(e) => setFormNotes(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1877f2]"
                ></textarea>
              </div>

              {/* Dokumen Pendukung Upload (Optional) */}
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-700">
                  Dokumen Pendukung <span class="text-slate-400 font-normal">(Opsional - Brosur / Quotation / Spesifikasi)</span>
                </label>
                <div class="border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-2xl p-3.5 bg-slate-50 transition flex flex-col items-center justify-center text-center">
                  <Show
                    when={formAttachmentName()}
                    fallback={
                      <label class="cursor-pointer flex flex-col items-center gap-1.5 w-full py-2">
                        <span class="text-2xl">📎</span>
                        <span class="text-xs font-bold text-slate-700">Klik untuk upload file dokumen</span>
                        <span class="text-[11px] text-slate-400">PDF, JPG, PNG (Maksimal 5 MB)</span>
                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
                          class="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    }
                  >
                    <div class="w-full flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                      <div class="flex items-center gap-2.5 overflow-hidden">
                        <span class="text-xl">
                          {formAttachmentName().toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                        </span>
                        <div class="text-left truncate">
                          <div class="text-xs font-bold text-slate-800 truncate">{formAttachmentName()}</div>
                          <div class="text-[10px] text-emerald-600 font-semibold">✓ Dokumen siap dilampirkan</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormAttachmentName('');
                          setFormAttachmentData(null);
                        }}
                        class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs transition"
                        title="Hapus Dokumen"
                      >
                        🗑️
                      </button>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Signature Canvas Trigger */}
              <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-800">Tanda Tangan Pemohon</div>
                  <div class="text-[11px] text-slate-500">Otomatis dilampirkan ke dokumen ISO PR</div>
                </div>
                <button
                  type="button"
                  onClick={() => props.onOpenSignatureModal('Tanda Tangan Pemohon PR', (sig) => setFormSignature(sig))}
                  class="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#1877f2] border border-slate-200 rounded-xl text-xs font-semibold transition shadow-sm"
                >
                  ✍️ Gambar Ulang TTD
                </button>
              </div>

              <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  class="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting()}
                  class="px-6 py-2.5 bg-[#1877f2] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2"
                >
                  <Show when={isSubmitting()} fallback={<span>🚀 {isEditMode() ? 'Simpan Perubahan' : 'Simpan & Kirim Approval'}</span>}>
                    <span>Memproses...</span>
                  </Show>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal Approval Accounting (Input No. PR & Verifikasi Status Anggaran) */}
      <Show when={showAccountingApproveModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scaleUp">
            <div class="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="text-xl">💰</span>
                <div>
                  <h3 class="font-bold text-sm sm:text-base">Persetujuan Bagian Accounting (Step 2)</h3>
                  <p class="text-[11px] text-blue-100">Penerbitan Nomor PR Resmi & Penentuan Status Anggaran</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountingApproveModal(false)}
                class="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAccountingApprove} class="p-6 space-y-4 text-xs">
              <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 leading-relaxed">
                Sebagai <strong>Accounting</strong>, Anda berwenang menerbitkan Nomor PR resmi dan menentukan alokasi status anggaran (RKAS).
              </div>

              {/* Input Nomor PR */}
              <div>
                <label class="block font-bold text-slate-800 mb-1">
                  Nomor PR Resmi <span class="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: PR/ICT/2026/09/001 (Kosongkan jika auto-generate)"
                  value={approvePrNumber()}
                  onInput={(e) => setApprovePrNumber(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-[#1877f2]"
                />
                <p class="text-[11px] text-slate-500 mt-1">
                  💡 Biarkan kosong untuk generate otomatis sesuai format resmi yayasan <code>PR/[DEPT]/[TAHUN]/[BULAN]/[NO]</code>.
                </p>
              </div>

              {/* Status Anggaran Selection */}
              <div>
                <label class="block font-bold text-slate-800 mb-1.5">
                  Status Anggaran (Budget) <span class="text-rose-500">*</span>
                </label>
                <div class="grid grid-cols-2 gap-2.5">
                  <label class={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                    approveBudgetStatus() === 'Dianggarkan'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="accounting_budget_status"
                      checked={approveBudgetStatus() === 'Dianggarkan'}
                      onChange={() => setApproveBudgetStatus('Dianggarkan')}
                      class="text-emerald-600"
                    />
                    <span>✓ Dianggarkan (RKAS)</span>
                  </label>

                  <label class={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                    approveBudgetStatus() === 'Belum dianggarkan'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold ring-2 ring-amber-400'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="accounting_budget_status"
                      checked={approveBudgetStatus() === 'Belum dianggarkan'}
                      onChange={() => setApproveBudgetStatus('Belum dianggarkan')}
                      class="text-amber-600"
                    />
                    <span>⚠️ Belum Dianggarkan</span>
                  </label>
                </div>
              </div>

              {/* Catatan Tambahan (Opsional) */}
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Catatan Persetujuan (Opsional)</label>
                <textarea
                  rows="2"
                  placeholder="Catatan dari bagian Accounting..."
                  value={approveNotes()}
                  onInput={(e) => setApproveNotes(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800"
                ></textarea>
              </div>

              <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAccountingApproveModal(false)}
                  class="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <span>✍️</span> Terbitkan No. PR & Setujui
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal Konfirmasi Approval Standar (Step 1 Koordinator & Step 3 Yayasan) */}
      <Show when={showConfirmApproveModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-100 text-[#1877f2] flex items-center justify-center text-xl shrink-0">
                ✍️
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-800">Konfirmasi Persetujuan Dokumen</h3>
                <p class="text-xs text-slate-500">Persetujuan Tahap {confirmApproveStepNum()}</p>
              </div>
            </div>

            <div class="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-slate-700 leading-relaxed">
              Apakah Anda yakin ingin menyetujui pengajuan PR ini? Tanda tangan digital resmi Anda akan dibubuhkan secara otomatis pada dokumen.
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmApproveModal(false)}
                class="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmApprovePrId();
                  const step = confirmApproveStepNum();
                  setShowConfirmApproveModal(false);
                  if (id) {
                    await executeApprove(id, step);
                  }
                }}
                class="px-5 py-2 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
              >
                <span>✓</span> Ya, Setujui Sekarang
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
