import { createSignal, createResource, createEffect, For, Show } from 'solid-js';
import type { LeaveRequest, UserProfile, Department, EmployeeLeaveAllocation } from '../lib/types';
import { SAMPLE_SIGNATURE_1, OFFICIAL_DEPARTMENTS, COORDINATORS_MAP } from '../lib/dummyData';

const fetchLeaves = async () => {
  const res = await fetch('/api/leaves');
  if (!res.ok) throw new Error('Failed to fetch Leaves');
  const json = await res.json();
  return json.data as LeaveRequest[];
};

const fetchMyAllocation = async (year: number) => {
  const res = await fetch(`/api/leaves/allocations?year=${year}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
};

interface Props {
  currentUser?: UserProfile;
  onOpenPdf: (leave: LeaveRequest) => void;
  onOpenSignatureModal: (title: string, onSave: (sig: string) => void) => void;
}

export default function LeaveRequestView(props: Props) {
  const [leaves, { mutate: setLeaves }] = createResource(fetchLeaves, { initialValue: [] });
  const [selectedLeave, setSelectedLeave] = createSignal<LeaveRequest | null>(null);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editLeaveId, setEditLeaveId] = createSignal<number | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filterPeriod, setFilterPeriod] = createSignal<'all' | 'weekly' | 'monthly'>('all');
  const [filterStatus, setFilterStatus] = createSignal<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [sortBy, setSortBy] = createSignal<'newest' | 'oldest' | 'days'>('newest');

  // Allocation Management State (HRD & Admin only)
  const isHRorAdmin = () => {
    if (!props.currentUser) return false;
    if (props.currentUser.role === 'admin') return true;
    const dept = (props.currentUser.department || '').toLowerCase();
    return dept.includes('hr') || dept.includes('human resource') || dept.includes('sdm');
  };

  const [showAllocModal, setShowAllocModal] = createSignal(false);
  const [allocYear, setAllocYear] = createSignal(new Date().getFullYear());
  const [allocList, setAllocList] = createSignal<EmployeeLeaveAllocation[]>([]);
  const [allocSearch, setAllocSearch] = createSignal('');
  const [isLoadingAlloc, setIsLoadingAlloc] = createSignal(false);
  const [isSavingAlloc, setIsSavingAlloc] = createSignal(false);
  const [allocSaveSuccess, setAllocSaveSuccess] = createSignal<string | null>(null);

  const loadAllocations = async (year: number) => {
    setIsLoadingAlloc(true);
    setAllocSaveSuccess(null);
    try {
      const res = await fetch(`/api/leaves/allocations?year=${year}`);
      if (!res.ok) throw new Error('Gagal mengambil alokasi cuti.');
      const data = await res.json();
      if (data.data?.allocations) {
        setAllocList(data.data.allocations);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memuat data alokasi.');
    } finally {
      setIsLoadingAlloc(false);
    }
  };

  const handleOpenAllocModal = () => {
    setShowAllocModal(true);
    loadAllocations(allocYear());
  };

  const updateAllocItem = (userId: number, field: 'hakPrev' | 'hakCurr' | 'notes', val: any) => {
    setAllocList(prev =>
      prev.map(item => {
        if (item.userId !== userId) return item;
        const updated = { ...item, [field]: val };
        updated.totalHak = (Number(updated.hakPrev) || 0) + (Number(updated.hakCurr) || 0);
        updated.sisa = Math.max(0, updated.totalHak - (item.takenDays || 0));
        return updated;
      })
    );
  };

  const saveAllocItem = async (item: EmployeeLeaveAllocation) => {
    try {
      const res = await fetch('/api/leaves/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: item.userId,
          year: allocYear(),
          hak_prev: Number(item.hakPrev) || 0,
          hak_curr: Number(item.hakCurr) || 0,
          notes: item.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setAllocSaveSuccess(`Alokasi ${item.displayName} berhasil disimpan.`);
      setTimeout(() => setAllocSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan alokasi.');
    }
  };

  const saveAllAllocations = async () => {
    if (isSavingAlloc()) return;
    setIsSavingAlloc(true);
    try {
      const payload = {
        year: allocYear(),
        allocations: allocList().map(a => ({
          user_id: a.userId,
          hak_prev: Number(a.hakPrev) || 0,
          hak_curr: Number(a.hakCurr) || 0,
          notes: a.notes || null,
        })),
      };
      const res = await fetch('/api/leaves/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan batch alokasi.');
      setAllocSaveSuccess(`Semua alokasi tahun ${allocYear()} berhasil disimpan!`);
      setTimeout(() => setAllocSaveSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan.');
    } finally {
      setIsSavingAlloc(false);
    }
  };

  // Auto select Leave from URL params if present, otherwise first leave
  createEffect(() => {
    const list = leaves();
    if (list.length === 0) return;

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const idParam = urlParams.get('id') || urlParams.get('leave_id');
      const docParam = urlParams.get('doc');

      if (idParam || docParam) {
        const found = list.find(
          (lv) =>
            (idParam && lv.id === Number(idParam)) ||
            (docParam && `CUTI-${lv.id}`.toLowerCase() === docParam.toLowerCase())
        );
        if (found) {
          setSelectedLeave(found);
          return;
        }
      }
    }

    if (!selectedLeave()) {
      setSelectedLeave(list[0]);
    }
  });

  // Form State
  const [formName, setFormName] = createSignal(props.currentUser?.displayName || '');
  const [formPosition, setFormPosition] = createSignal(props.currentUser?.jobTitle || 'Staff IT & Lead Developer');
  const [formDepartment, setFormDepartment] = createSignal<Department>((props.currentUser?.department as Department) || 'ICT');
  const [formStartDate, setFormStartDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [formEndDate, setFormEndDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [formWorkDays, setFormWorkDays] = createSignal(1);
  const [formPurpose, setFormPurpose] = createSignal('');
  const [formHakPrev, setFormHakPrev] = createSignal(0);
  const [formHakCurr, setFormHakCurr] = createSignal(12);
  const [formTakenUntil, setFormTakenUntil] = createSignal(0);
  const [formSignature, setFormSignature] = createSignal(props.currentUser?.signature_data || SAMPLE_SIGNATURE_1);

  // Auto fetch quota for current user when opening create form
  const loadUserAllocation = async () => {
    try {
      const thisYear = new Date().getFullYear();
      const alloc = await fetchMyAllocation(thisYear);
      if (alloc) {
        setFormHakPrev(alloc.hak_prev ?? 0);
        setFormHakCurr(alloc.hak_curr ?? 12);
        setFormTakenUntil(alloc.taken_days ?? 0);
      }
    } catch {
      // Keep defaults
    }
  };

  const resetForm = () => {
    setFormName(props.currentUser?.displayName || '');
    setFormPosition(props.currentUser?.jobTitle || 'Staff IT & Lead Developer');
    setFormDepartment((props.currentUser?.department as Department) || 'ICT');
    const today = new Date().toISOString().substring(0, 10);
    setFormStartDate(today);
    setFormEndDate(today);
    setFormWorkDays(1);
    setFormPurpose('');
    setIsEditMode(false);
    setEditLeaveId(null);
    loadUserAllocation();
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const populateFormForEdit = (lv: LeaveRequest) => {
    setFormName(lv.name);
    setFormPosition(lv.position);
    setFormDepartment(lv.department as Department);
    setFormStartDate(lv.start_date);
    setFormEndDate(lv.end_date);
    setFormWorkDays(lv.work_days);
    setFormPurpose(lv.purpose);
    setFormHakPrev(lv.hak_prev);
    setFormHakCurr(lv.hak_curr);
    setFormTakenUntil(lv.taken_until);
    setIsEditMode(true);
    setEditLeaveId(lv.id);
    setShowCreateModal(true);
  };

  const calcTotalHak = () => formHakPrev() + formHakCurr();
  const calcSisaCurr = () => calcTotalHak() - formTakenUntil();
  const calcSisaAfter = () => calcSisaCurr() - formWorkDays();

  const handleCreateSubmit = (e: Event) => {
    e.preventDefault();
    const newLeave: LeaveRequest = {
      id: Date.now(),
      name: formName(),
      position: formPosition(),
      department: formDepartment(),
      work_days: formWorkDays(),
      start_date: formStartDate(),
      end_date: formEndDate(),
      purpose: formPurpose(),
      status: 'Pending',
      current_approval_step: 1,
      hak_prev: formHakPrev(),
      hak_curr: formHakCurr(),
      total_hak: calcTotalHak(),
      taken_until: formTakenUntil(),
      sisa_curr: calcSisaCurr(),
      request_days: formWorkDays(),
      sisa_after: calcSisaAfter(),
      signature_pemohon: props.currentUser?.signature_data || formSignature(),
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      approvals: [
        {
          step: 1,
          role: 'koordinator',
          roleTitle: `Atasan Langsung (${formDepartment()})`,
          approverName: COORDINATORS_MAP[formDepartment() as Department]?.name || 'Koordinator Unit',
          approverEmail: COORDINATORS_MAP[formDepartment() as Department]?.email || 'koordinator@edelweiss.sch.id',
          status: 'current',
        },
        {
          step: 2,
          role: 'hrd',
          roleTitle: 'HRD',
          approverName: '',
          approverEmail: '',
          status: 'pending',
        },
        {
          step: 3,
          role: 'ketua_yayasan',
          roleTitle: 'Ketua Yayasan',
          approverName: '',
          approverEmail: '',
          status: 'pending',
        },
      ],
    };

    if (isEditMode() && editLeaveId()) {
      newLeave.id = editLeaveId()!;
      const existingLeave = leaves().find(l => l.id === newLeave.id);
      if (existingLeave) {
        newLeave.approvals = existingLeave.approvals;
        newLeave.created_at = existingLeave.created_at;
        newLeave.status = existingLeave.status;
        newLeave.current_approval_step = existingLeave.current_approval_step;
      }
      
      fetch(`/api/leaves/${newLeave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLeave)
      }).then(() => {
        setLeaves(leaves().map(l => l.id === newLeave.id ? newLeave : l));
        if (selectedLeave()?.id === newLeave.id) setSelectedLeave(newLeave);
        setShowCreateModal(false);
      }).catch(err => alert("Error updating Leave: " + err));
    } else {
      fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLeave)
      }).then((res) => res.json()).then((data) => {
        if (data.leaveId) newLeave.id = data.leaveId;
        setLeaves([newLeave, ...leaves()]);
        setSelectedLeave(newLeave);
        setShowCreateModal(false);
      }).catch(err => alert("Error saving Leave: " + err));
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus permohonan cuti ini?")) return;
    fetch(`/api/leaves/${id}`, {
      method: 'DELETE'
    }).then(() => {
      setLeaves(leaves().filter(l => l.id !== id));
      if (selectedLeave()?.id === id) setSelectedLeave(null);
    }).catch(err => alert("Error deleting Leave: " + err));
  };

  // State Modal Konfirmasi Approval Cuti
  const [showConfirmApproveModal, setShowConfirmApproveModal] = createSignal(false);
  const [confirmApproveLeaveId, setConfirmApproveLeaveId] = createSignal<number | null>(null);
  const [confirmApproveStepNum, setConfirmApproveStepNum] = createSignal<number>(1);

  const promptApproveStep = (leaveId: number, stepNum: number) => {
    setConfirmApproveLeaveId(leaveId);
    setConfirmApproveStepNum(stepNum);
    setShowConfirmApproveModal(true);
  };

  /**
   * Persist an approval decision through the server (H-01 fix).
   *
   * The browser only sends "approve"; the server resolves the approver
   * identity, role, signature and resulting status, and the UI reflects the
   * authoritative state returned in the response.
   */
  const handleApproveStep = async (leaveId: number) => {
    const doc = leaves().find(l => l.id === leaveId);
    if (!doc) return;
    const currentStep = doc.current_approval_step;

    try {
      const res = await fetch(`/api/leaves/${leaveId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui dokumen.');

      setShowConfirmApproveModal(false);
      setConfirmApproveLeaveId(null);

      setLeaves(leaves().map(l => {
        if (l.id !== leaveId) return l;

        const updatedApprovals = l.approvals.map(app => {
          if (app.step === currentStep) {
            return {
              ...app,
              approverName: props.currentUser?.displayName || app.approverName,
              status: 'approved' as const,
              date: new Date().toISOString().replace('T', ' ').substring(0, 19),
              signature: props.currentUser?.signature_data || SAMPLE_SIGNATURE_1,
            };
          }
          if (app.step === currentStep + 1) {
            return { ...app, status: 'current' as const };
          }
          return app;
        });

        const updatedLeave: LeaveRequest = {
          ...l,
          current_approval_step: data.current_approval_step ?? l.current_approval_step,
          status: (data.status as LeaveRequest['status']) ?? l.status,
          approvals: updatedApprovals,
        };

        if (selectedLeave()?.id === leaveId) setSelectedLeave(updatedLeave);
        return updatedLeave;
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui dokumen.');
    }
  };

  const filteredLeaves = () => {
    let result = leaves().filter(l => {
      // Search
      const matchSearch =
        l.name.toLowerCase().includes(searchQuery().toLowerCase()) ||
        l.department.toLowerCase().includes(searchQuery().toLowerCase()) ||
        l.purpose.toLowerCase().includes(searchQuery().toLowerCase());

      if (!matchSearch) return false;

      // Status Filter
      if (filterStatus() !== 'all' && l.status !== filterStatus()) {
        return false;
      }

      // Period Filter
      if (filterPeriod() !== 'all') {
        const dateStr = l.start_date || l.created_at;
        if (dateStr) {
          const itemDate = new Date(dateStr);
          const now = new Date();
          if (filterPeriod() === 'weekly') {
            const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 7 || diffDays < -1) return false;
          } else if (filterPeriod() === 'monthly') {
            if (
              itemDate.getFullYear() !== now.getFullYear() ||
              itemDate.getMonth() !== now.getMonth()
            ) {
              return false;
            }
          }
        }
      }

      return true;
    });

    // Sort
    return result.sort((a, b) => {
      if (sortBy() === 'newest') {
        return (b.id || 0) - (a.id || 0);
      } else if (sortBy() === 'oldest') {
        return (a.id || 0) - (b.id || 0);
      } else if (sortBy() === 'days') {
        return (b.work_days || 0) - (a.work_days || 0);
      }
      return 0;
    });
  };

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-800">Form Permohonan Cuti</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">
              YSPE-HRD-FM-019 Rev.02
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Kalkulator kuota hak cuti tahunan, rekap saldo cuti, dan persetujuan atasan langsung & HRD.
          </p>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          {/* Tombol Khusus HRD & Admin untuk Kelola Kuota Cuti */}
          <Show when={isHRorAdmin()}>
            <button
              onClick={handleOpenAllocModal}
              class="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
              title="Khusus HRD dan Admin: Kelola Kuota Cuti Tahunan Pegawai"
            >
              <span>💼</span> Kelola Alokasi Cuti (HRD)
            </button>
          </Show>

          <button
            onClick={openCreateModal}
            class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>➕</span> Ajukan Cuti Baru
          </button>
        </div>
      </div>

      {/* Filter & Sort Bar (Clean, simple, consistent) */}
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="w-full sm:w-80 relative">
          <input
            type="text"
            placeholder="Cari nama karyawan, unit, atau alasan..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white"
          />
        </div>

        <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Filter Periode */}
          <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span class="text-[11px] font-semibold text-slate-500 px-1.5">📅</span>
            {[
              { key: 'all', label: 'Semua' },
              { key: 'weekly', label: 'Mingguan' },
              { key: 'monthly', label: 'Bulan Ini' },
            ].map((p) => (
              <button
                type="button"
                onClick={() => setFilterPeriod(p.key as any)}
                class={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterPeriod() === p.key
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filter Status */}
          <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span class="text-[11px] font-semibold text-slate-500 px-1.5">Status:</span>
            {(['all', 'Pending', 'Approved'] as const).map((st) => (
              <button
                type="button"
                onClick={() => setFilterStatus(st)}
                class={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterStatus() === st
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {st === 'all' ? 'Semua' : st}
              </button>
            ))}
          </div>

          {/* Sort Pill Dropdown */}
          <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span class="text-[11px] font-semibold text-slate-500 px-1.5">Sort:</span>
            {[
              { key: 'newest', label: 'Terbaru' },
              { key: 'oldest', label: 'Terlama' },
              { key: 'days', label: 'Hari Terbanyak' },
            ].map((s) => (
              <button
                type="button"
                onClick={() => setSortBy(s.key as any)}
                class={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  sortBy() === s.key
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Leave List (5 cols) */}
        <div class="lg:col-span-5 space-y-3">
          <div class="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Ditemukan <b>{filteredLeaves().length}</b> permohonan cuti</span>
            <Show when={filterPeriod() !== 'all' || filterStatus() !== 'all' || searchQuery()}>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterPeriod('all');
                  setFilterStatus('all');
                }}
                class="text-indigo-600 hover:underline font-semibold"
              >
                Reset Filter
              </button>
            </Show>
          </div>

          <div class="space-y-3">
            <For each={filteredLeaves()}>
              {(lv) => {
                const isSelected = selectedLeave()?.id === lv.id;
                return (
                  <div
                    onClick={() => setSelectedLeave(lv)}
                    class={`p-4 rounded-2xl border cursor-pointer transition flex flex-col gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm'
                    }`}
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-800">{lv.name}</span>
                      <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        lv.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {lv.status}
                      </span>
                    </div>

                    <div class="text-xs text-slate-600 line-clamp-1">{lv.purpose}</div>

                    <div class="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                      <span>{lv.department} • {lv.work_days} Hari</span>
                      <span class="text-[11px] font-mono text-slate-600">{lv.start_date} s/d {lv.end_date}</span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Right Column: Selected Leave Detail (7 cols) */}
        <div class="lg:col-span-7">
          <Show when={selectedLeave()} fallback={
            <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
              Pilih permohonan cuti untuk melihat detail.
            </div>
          }>
            {(() => {
              const lv = selectedLeave()!;

              return (
                <div class="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  {/* Top Action Bar */}
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-mono font-bold text-indigo-600">CUTI-{lv.department}</span>
                        <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          lv.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {lv.status}
                        </span>
                      </div>
                      <h2 class="text-base sm:text-lg font-bold text-slate-800 mt-1">
                        Permohonan Cuti: {lv.name} ({lv.work_days} Hari Kerja)
                      </h2>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        onClick={() => props.onOpenPdf(lv)}
                        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center justify-center gap-2 shrink-0"
                      >
                        📄 <span>Lihat & Cetak PDF ISO</span>
                      </button>
                      
                      {lv.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => populateFormForEdit(lv)}
                            class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-sm"
                            title="Edit Cuti"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(lv.id)}
                            class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition shadow-sm border border-rose-100"
                            title="Hapus Cuti"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <div class="text-slate-500">Jabatan</div>
                      <div class="font-bold text-slate-800 mt-0.5">{lv.position}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Departemen</div>
                      <div class="font-bold text-slate-800 mt-0.5">{lv.department}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Periode Cuti</div>
                      <div class="font-bold text-indigo-600 mt-0.5">{lv.start_date} s/d {lv.end_date}</div>
                    </div>
                  </div>

                  {/* Quota Calculation Table Preview */}
                  <div>
                    <div class="text-xs font-bold text-slate-700 mb-2">Perhitungan Saldo Hak Cuti</div>
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                      <div class="flex justify-between py-1 border-b border-slate-200">
                        <span class="text-slate-600">Hak Cuti Thn. Sebelumnya:</span>
                        <span class="font-bold text-slate-800">{lv.hak_prev} Hari</span>
                      </div>
                      <div class="flex justify-between py-1 border-b border-slate-200">
                        <span class="text-slate-600">Hak Cuti Thn. Berjalan:</span>
                        <span class="font-bold text-slate-800">{lv.hak_curr} Hari</span>
                      </div>
                      <div class="flex justify-between py-1 border-b border-slate-200">
                        <span class="text-slate-600">Total Hak Cuti:</span>
                        <span class="font-bold text-indigo-600">{lv.total_hak} Hari</span>
                      </div>
                      <div class="flex justify-between py-1 border-b border-slate-200">
                        <span class="text-slate-600">Cuti Terpakai s/d Hari Ini:</span>
                        <span class="font-bold text-rose-600">{lv.taken_until} Hari</span>
                      </div>
                      <div class="flex justify-between py-1 border-b border-slate-200 font-bold bg-white px-2 rounded-lg">
                        <span class="text-slate-700">Permohonan Cuti Ini:</span>
                        <span class="text-amber-600">{lv.request_days} Hari</span>
                      </div>
                      <div class="flex justify-between pt-1 font-bold text-emerald-700 text-sm px-2">
                        <span>Sisa Cuti Akhir:</span>
                        <span>{lv.sisa_after} Hari</span>
                      </div>
                    </div>
                  </div>

                  {/* Approval Stepper */}
                  <div class="space-y-3 pt-2 border-t border-slate-100">
                    <div class="flex items-center justify-between">
                      <div class="text-xs font-bold text-slate-700">Alur Persetujuan Cuti</div>
                      {lv.status === 'Pending' && (
                        <button
                          onClick={() => promptApproveStep(lv.id, lv.current_approval_step)}
                          class="px-3.5 py-1.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                        >
                          ✍️ Setujui Step {lv.current_approval_step}
                        </button>
                      )}
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {lv.approvals.map((app) => (
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
                              <span>Belum TTD</span>
                            )}
                            <span class="font-mono text-slate-500">{app.date ? app.date.split(' ')[0] : '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </Show>
        </div>
      </div>

      {/* Modal Form Cuti Baru */}
      <Show when={showCreateModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                  {isEditMode() ? '✏️ Edit Permohonan Cuti' : '🏖️ Form Pengajuan Cuti (ISO 21001:2018)'}
                </h3>
                <p class="text-xs text-slate-500">Isi data permohonan cuti dan hitung saldo cuti</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} class="flex-1 overflow-y-auto p-6 space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Karyawan</label>
                  <input
                    type="text"
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    value={formPosition()}
                    onInput={(e) => setFormPosition(e.currentTarget.value)}
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

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Tgl Mulai</label>
                  <input
                    type="date"
                    value={formStartDate()}
                    onInput={(e) => setFormStartDate(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Tgl Selesai</label>
                  <input
                    type="date"
                    value={formEndDate()}
                    onInput={(e) => setFormEndDate(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Jumlah Hari Kerja</label>
                  <input
                    type="number"
                    value={formWorkDays()}
                    onInput={(e) => setFormWorkDays(parseInt(e.currentTarget.value) || 1)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Keperluan Cuti</label>
                <textarea
                  rows="2"
                  value={formPurpose()}
                  onInput={(e) => setFormPurpose(e.currentTarget.value)}
                  required
                  placeholder="Alasan cuti..."
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                ></textarea>
              </div>

              {/* Leave Calculator preview in form */}
              <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div class="text-xs font-bold text-indigo-700">Kalkulasi Otomatis Saldo Cuti</div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label class="text-[11px] text-slate-500">Hak Thn Lalu</label>
                    <input
                      type="number"
                      value={formHakPrev()}
                      onInput={(e) => setFormHakPrev(parseInt(e.currentTarget.value) || 0)}
                      class="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label class="text-[11px] text-slate-500">Hak Thn Ini</label>
                    <input
                      type="number"
                      value={formHakCurr()}
                      onInput={(e) => setFormHakCurr(parseInt(e.currentTarget.value) || 0)}
                      class="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label class="text-[11px] text-slate-500">Cuti Terpakai</label>
                    <input
                      type="number"
                      value={formTakenUntil()}
                      onInput={(e) => setFormTakenUntil(parseInt(e.currentTarget.value) || 0)}
                      class="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label class="text-[11px] text-slate-500">Sisa Akhir</label>
                    <div class="p-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                      {calcSisaAfter()} Hari
                    </div>
                  </div>
                </div>
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
                  class="px-6 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  {isEditMode() ? '🚀 Update Cuti' : '🚀 Simpan & Ajukan Cuti'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal Manajemen Alokasi Cuti Tahunan Pegawai (Khusus HRD & Admin) */}
      <Show when={showAllocModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div class="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-lg">
                  💼
                </div>
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    Alokasi Kuota Cuti Tahunan Pegawai
                    <span class="text-[11px] font-mono font-semibold px-2 py-0.5 bg-emerald-500/30 text-emerald-300 rounded-md border border-emerald-500/40">
                      HRD & Admin Only
                    </span>
                  </h3>
                  <p class="text-xs text-slate-300">
                    Atur saldo hak cuti tahun lalu (hakPrev) dan tahun berjalan (hakCurr) masing-masing pegawai.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllocModal(false)}
                class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            {/* Toolbar Filter & Year Selector */}
            <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div class="flex items-center gap-2 w-full sm:w-auto">
                <label class="text-xs font-bold text-slate-700 whitespace-nowrap">📅 Tahun Kuota:</label>
                <select
                  value={allocYear()}
                  onChange={(e) => {
                    const y = Number(e.currentTarget.value);
                    setAllocYear(y);
                    loadAllocations(y);
                  }}
                  class="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-[#1877f2]"
                >
                  <option value={2027}>2027</option>
                  <option value={2026}>2026 (Tahun Berjalan)</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>

                <button
                  type="button"
                  onClick={() => loadAllocations(allocYear())}
                  disabled={isLoadingAlloc()}
                  class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-xl font-medium transition"
                  title="Muat Ulang"
                >
                  🔄
                </button>
              </div>

              <div class="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Cari nama pegawai / unit..."
                  value={allocSearch()}
                  onInput={(e) => setAllocSearch(e.currentTarget.value)}
                  class="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 w-full sm:w-60 focus:border-[#1877f2]"
                />
                <button
                  type="button"
                  onClick={saveAllAllocations}
                  disabled={isSavingAlloc() || isLoadingAlloc()}
                  class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition shrink-0 flex items-center gap-1.5"
                >
                  <span>💾</span>
                  <span>{isSavingAlloc() ? 'Menyimpan...' : 'Simpan Semua'}</span>
                </button>
              </div>
            </div>

            {/* Alert Notification */}
            <Show when={allocSaveSuccess()}>
              <div class="mx-6 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
                <span>✅ {allocSaveSuccess()}</span>
                <button onClick={() => setAllocSaveSuccess(null)} class="text-emerald-700 font-bold">✕</button>
              </div>
            </Show>

            {/* Table Allocations */}
            <div class="flex-1 overflow-y-auto p-4 sm:p-6">
              <Show when={!isLoadingAlloc()} fallback={
                <div class="py-12 text-center text-slate-400 text-xs">
                  <div class="animate-spin text-2xl mb-2">⏳</div>
                  Memuat data kuota cuti pegawai...
                </div>
              }>
                <div class="border border-slate-200 rounded-2xl overflow-hidden">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th class="p-3">Pegawai / Unit</th>
                        <th class="p-3 text-center w-24">Hak Thn Lalu</th>
                        <th class="p-3 text-center w-24">Hak Thn Ini</th>
                        <th class="p-3 text-center w-24">Total Kuota</th>
                        <th class="p-3 text-center w-24">Terpakai</th>
                        <th class="p-3 text-center w-24">Sisa Saldo</th>
                        <th class="p-3">Catatan</th>
                        <th class="p-3 text-center w-20">Aksi</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <For each={allocList().filter(a =>
                        a.displayName.toLowerCase().includes(allocSearch().toLowerCase()) ||
                        a.department.toLowerCase().includes(allocSearch().toLowerCase()) ||
                        a.jobTitle.toLowerCase().includes(allocSearch().toLowerCase())
                      )}>
                        {(item) => (
                          <tr class="hover:bg-slate-50/80 transition">
                            <td class="p-3">
                              <div class="font-bold text-slate-800">{item.displayName}</div>
                              <div class="text-[11px] text-slate-500">{item.jobTitle} • <span class="font-medium text-indigo-600">{item.department}</span></div>
                            </td>

                            {/* Hak Prev Input */}
                            <td class="p-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={item.hakPrev}
                                onInput={(e) => updateAllocItem(item.userId, 'hakPrev', parseInt(e.currentTarget.value) || 0)}
                                class="w-16 bg-white border border-slate-300 rounded-lg p-1 text-xs text-center font-semibold text-slate-800 focus:border-[#1877f2]"
                              />
                            </td>

                            {/* Hak Curr Input */}
                            <td class="p-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={item.hakCurr}
                                onInput={(e) => updateAllocItem(item.userId, 'hakCurr', parseInt(e.currentTarget.value) || 0)}
                                class="w-16 bg-white border border-slate-300 rounded-lg p-1 text-xs text-center font-semibold text-slate-800 focus:border-[#1877f2]"
                              />
                            </td>

                            {/* Total Hak */}
                            <td class="p-3 text-center font-bold text-slate-700">
                              {item.totalHak}
                            </td>

                            {/* Taken Days */}
                            <td class="p-3 text-center text-amber-700 font-semibold">
                              {item.takenDays}
                            </td>

                            {/* Sisa Saldo */}
                            <td class="p-3 text-center font-bold">
                              <span class={`px-2 py-0.5 rounded-md text-[11px] ${
                                item.sisa > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {item.sisa} Hari
                              </span>
                            </td>

                            {/* Catatan */}
                            <td class="p-3">
                              <input
                                type="text"
                                placeholder="Ket / sisa cuti..."
                                value={item.notes || ''}
                                onInput={(e) => updateAllocItem(item.userId, 'notes', e.currentTarget.value)}
                                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:bg-white"
                              />
                            </td>

                            {/* Aksi Simpan Baris */}
                            <td class="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => saveAllocItem(item)}
                                class="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition"
                                title="Simpan baris ini"
                              >
                                Simpan
                              </button>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </div>

            {/* Footer Modal */}
            <div class="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Total: <b>{allocList().length}</b> pegawai terdaftar dalam kuota tahun {allocYear()}.</span>
              <button
                type="button"
                onClick={() => setShowAllocModal(false)}
                class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal Konfirmasi Persetujuan Cuti */}
      <Show when={showConfirmApproveModal() && confirmApproveLeaveId() !== null}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 animate-scaleUp">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-100 text-[#1877f2] flex items-center justify-center text-xl shrink-0">
                ✍️
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-800">Konfirmasi Persetujuan Cuti</h3>
                <p class="text-xs text-slate-500">Persetujuan Tahap {confirmApproveStepNum()}</p>
              </div>
            </div>

            <div class="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-slate-700 space-y-1.5 leading-relaxed">
              <p>
                Apakah Anda yakin ingin menyetujui pengajuan permohonan cuti ini?
              </p>
              <p class="text-[11px] text-blue-800">
                Tanda tangan digital resmi Anda akan dibubuhkan secara otomatis pada lembar persetujuan cuti.
              </p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmApproveModal(false);
                  setConfirmApproveLeaveId(null);
                }}
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => confirmApproveLeaveId() !== null && handleApproveStep(confirmApproveLeaveId()!)}
                class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1877f2] hover:bg-blue-600 shadow-md transition flex items-center gap-1.5"
              >
                <span>✓</span> Ya, Setujui & Tanda Tangani
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
