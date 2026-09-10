import { createSignal, createResource, createEffect, For, Show } from 'solid-js';
import type { HandoverForm, UserProfile, Department } from '../lib/types';
import { SAMPLE_SIGNATURE_1, OFFICIAL_DEPARTMENTS, COORDINATORS_MAP } from '../lib/dummyData';
import { ACTIVE_EMPLOYEES, type EmployeeSeed } from '../lib/employeeData';

export interface EmployeeUser {
  id?: number;
  displayName: string;
  email: string;
  username: string;
  department: string;
  jobTitle: string;
  role?: string;
  nik?: string;
}

const fetchHandovers = async () => {
  const res = await fetch('/api/handovers');
  if (!res.ok) throw new Error('Failed to fetch handovers');
  const json = await res.json();
  return (json.data || []) as HandoverForm[];
};

const fetchUsers = async () => {
  const res = await fetch('/api/users');
  if (!res.ok) return ACTIVE_EMPLOYEES as EmployeeUser[];
  const json = await res.json();
  return (json.data && json.data.length > 0 ? json.data : ACTIVE_EMPLOYEES) as EmployeeUser[];
};

interface Props {
  handovers?: HandoverForm[];
  currentUser?: UserProfile;
  onOpenPdf: (handover: HandoverForm) => void;
  onOpenSignatureModal: (title: string, onSave: (sig: string) => void) => void;
}

export default function HandoverFormView(props: Props) {
  const [handovers, { mutate: setHandovers, refetch: refetchHandovers }] = createResource(fetchHandovers, {
    initialValue: props.handovers || [],
  });
  const [usersList, { refetch: refetchUsers }] = createResource(fetchUsers, {
    initialValue: ACTIVE_EMPLOYEES as EmployeeUser[],
  });
  const [selectedHandover, setSelectedHandover] = createSignal<HandoverForm | null>(null);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editHandoverId, setEditHandoverId] = createSignal<number | null>(null);

  // Auto select Handover from URL params if present
  createEffect(() => {
    const list = handovers();
    if (list.length === 0) return;

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const idParam = urlParams.get('id') || urlParams.get('handover_id');
      const docParam = urlParams.get('doc');

      if (idParam || docParam) {
        const found = list.find((h) => {
          if (idParam && h.id === Number(idParam)) return true;
          if (docParam) {
            const cleanDoc = docParam.trim().toLowerCase();
            const hDoc = `bast-${h.id}`.toLowerCase();
            if (hDoc === cleanDoc) return true;
            // Also match if user passes "1" or "BAST-1" or "BAST-01"
            const numPart = cleanDoc.replace(/^bast-?/i, '');
            if (numPart && Number(numPart) === h.id) return true;
          }
          return false;
        });

        if (found) {
          setSelectedHandover(found);
          return;
        }
      }
    }

    if (!selectedHandover() || !list.some(h => h.id === selectedHandover()?.id)) {
      setSelectedHandover(list[0]);
    }
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filterStatus, setFilterStatus] = createSignal<'all' | 'Pending' | 'Approved'>('all');

  // Form State
  const [formItemName, setFormItemName] = createSignal('Laptop Lenovo ThinkPad L14 Gen 4');
  const [formRecipientName, setFormRecipientName] = createSignal('');
  const [formRecipientEmail, setFormRecipientEmail] = createSignal('');
  const [formRecipientDept, setFormRecipientDept] = createSignal<Department>('SD');
  const [formSerialNum, setFormSerialNum] = createSignal('PF-9X28172');
  const [formSpec, setFormSpec] = createSignal('Core i5-1335U, RAM 16GB, SSD 512GB, Charger Original');
  const [formLoanPeriod, setFormLoanPeriod] = createSignal('Selama Menjabat Koordinator SD');
  const [formNotes, setFormNotes] = createSignal('Perangkat operasional kerja unit SD.');

  // Employee Autocomplete State
  const [showEmployeeDropdown, setShowEmployeeDropdown] = createSignal(false);
  const [selectedEmployee, setSelectedEmployee] = createSignal<EmployeeUser | null>(null);

  const matchedEmployees = () => {
    const q = formRecipientName().trim().toLowerCase();
    const list = usersList() || (ACTIVE_EMPLOYEES as EmployeeUser[]);
    if (!q) return list.slice(0, 8);
    return list.filter(
      (emp) =>
        emp.displayName.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.jobTitle.toLowerCase().includes(q) ||
        (emp.username && emp.username.toLowerCase().includes(q)) ||
        (emp.nik && emp.nik.includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q))
    ).slice(0, 10);
  };

  const handleSelectEmployee = (emp: EmployeeUser) => {
    setFormRecipientName(emp.displayName);
    setFormRecipientEmail(emp.email);
    setFormRecipientDept((emp.department as Department) || 'SD');
    setSelectedEmployee(emp);
    setShowEmployeeDropdown(false);
  };

  const resetForm = () => {
    setFormItemName('Laptop Lenovo ThinkPad L14 Gen 4');
    setFormRecipientName('');
    setFormRecipientEmail('');
    setFormRecipientDept('SD');
    setFormSerialNum('PF-9X28172');
    setFormSpec('Core i5-1335U, RAM 16GB, SSD 512GB, Charger Original');
    setFormLoanPeriod('Selama Menjabat Koordinator SD');
    setFormNotes('Perangkat operasional kerja unit SD.');
    setSelectedEmployee(null);
    setIsEditMode(false);
    setEditHandoverId(null);
  };

  const openCreateModal = () => {
    resetForm();
    refetchUsers();
    setShowCreateModal(true);
  };

  const populateFormForEdit = (h: HandoverForm) => {
    refetchUsers();
    setFormItemName(h.item_name);
    setFormRecipientName(h.recipient_name);
    setFormRecipientEmail(h.recipient_email || '');
    setFormRecipientDept(h.recipient_department as Department);
    setFormSerialNum(h.serial_number || '');
    setFormSpec(h.specification || '');
    setFormLoanPeriod(h.loan_period || '');
    setFormNotes(h.notes || '');
    setIsEditMode(true);
    setEditHandoverId(h.id);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = (e: Event) => {
    e.preventDefault();
    let recipientEmail = formRecipientEmail();
    let recipientDept = formRecipientDept();

    // If recipient email is empty, attempt to match from current user list
    if (!recipientEmail && formRecipientName().trim()) {
      const match = (usersList() || []).find(
        (u) => u.displayName.trim().toLowerCase() === formRecipientName().trim().toLowerCase()
      );
      if (match) {
        recipientEmail = match.email;
        setFormRecipientEmail(match.email);
        if (match.department) {
          recipientDept = match.department as Department;
          setFormRecipientDept(recipientDept);
        }
      }
    }

    const newHandover: HandoverForm = {
      id: Date.now(),
      item_name: formItemName(),
      handover_date: new Date().toISOString().split('T')[0],
      recipient_name: formRecipientName(),
      recipient_email: recipientEmail,
      recipient_department: recipientDept,
      quantity: 1,
      serial_number: formSerialNum(),
      specification: formSpec(),
      loan_period: formLoanPeriod(),
      item_condition: 'Kondisi Baik & Siap Pakai',
      notes: formNotes(),
      status: 'Pending',
      current_approval_step: 1,
      ict_signature_path: props.currentUser?.signature_data || SAMPLE_SIGNATURE_1,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      approvals: [
        {
          step: 1,
          role: 'recipient',
          roleTitle: 'Penerima Barang',
          approverName: formRecipientName(),
          approverEmail: recipientEmail,
          status: 'current',
        },
        {
          step: 2,
          role: 'ict',
          roleTitle: 'Verifikasi ICT',
          approverName: props.currentUser?.displayName || '',
          approverEmail: props.currentUser?.email || '',
          status: 'pending',
        },
      ],
    };

    if (isEditMode() && editHandoverId()) {
      newHandover.id = editHandoverId()!;
      const existing = handovers().find(h => h.id === newHandover.id);
      if (existing) {
        newHandover.approvals = existing.approvals;
        newHandover.created_at = existing.created_at;
        newHandover.status = existing.status;
        newHandover.current_approval_step = existing.current_approval_step;
      }
      fetch(`/api/handovers/${newHandover.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHandover)
      }).then(() => {
        setHandovers(handovers().map(h => h.id === newHandover.id ? newHandover : h));
        if (selectedHandover()?.id === newHandover.id) setSelectedHandover(newHandover);
        setShowCreateModal(false);
      }).catch(err => alert("Error updating Handover: " + err));
    } else {
      fetch('/api/handovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHandover)
      }).then((res) => res.json()).then((data) => {
        if (data.id) newHandover.id = data.id;
        setHandovers([newHandover, ...handovers()]);
        setSelectedHandover(newHandover);
        setShowCreateModal(false);
      }).catch(err => alert("Error saving Handover: " + err));
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus form serah terima ini?")) return;
    fetch(`/api/handovers/${id}`, {
      method: 'DELETE'
    }).then(() => {
      setHandovers(handovers().filter(h => h.id !== id));
      if (selectedHandover()?.id === id) setSelectedHandover(null);
    }).catch(err => alert("Error deleting Handover: " + err));
  };

  // Confirmation modal state for handover verification
  const [showConfirmModal, setShowConfirmModal] = createSignal(false);
  const [handoverToConfirm, setHandoverToConfirm] = createSignal<HandoverForm | null>(null);

  const promptApprove = (h: HandoverForm) => {
    setHandoverToConfirm(h);
    setShowConfirmModal(true);
  };

  /**
   * Persist an approval decision through the server (H-01 fix).
   *
   * The browser only sends "approve"; the server resolves the approver
   * identity, role, signature and resulting status, and the UI reflects the
   * authoritative state returned in the response.
   */
  const handleApprove = async (id: number) => {
    const doc = handovers().find(h => h.id === id);
    if (!doc) return;
    const currentStep = doc.current_approval_step;

    try {
      const res = await fetch(`/api/handovers/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui dokumen.');

      setShowConfirmModal(false);
      setHandoverToConfirm(null);

      setHandovers(handovers().map(h => {
        if (h.id !== id) return h;

        const updated = {
          ...h,
          current_approval_step: data.current_approval_step ?? h.current_approval_step,
          status: (data.status as typeof h.status) ?? h.status,
          approvals: h.approvals.map(a => {
            if (a.step === currentStep) {
              return {
                ...a,
                approverName: props.currentUser?.displayName || a.approverName,
                status: 'approved' as const,
                date: new Date().toISOString().replace('T', ' ').substring(0, 19),
                signature: props.currentUser?.signature_data || SAMPLE_SIGNATURE_1,
              };
            }
            if (a.step === currentStep + 1) {
              return { ...a, status: 'current' as const };
            }
            return a;
          }),
        };

        if (selectedHandover()?.id === id) setSelectedHandover(updated);
        return updated;
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui dokumen.');
    }
  };

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-800">Form Serah Terima Perangkat ICT</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
              YSPE-ICT-FM-002 Rev.04
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Berita acara penyerahan & peminjaman laptop, inventaris, dan verifikasi tanda tangan digital peminjam.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          <span>➕</span> Serah Terima Baru
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div class="lg:col-span-5 space-y-3">
          {/* Search & Filter Bar */}
          <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <input
              type="text"
              placeholder="Cari barang, penerima, divisi, atau SN..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 transition"
            />
            <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
              <div class="flex items-center gap-1">
                {(['all', 'Pending', 'Approved'] as const).map((st) => (
                  <button
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    class={`px-2 py-0.5 rounded-lg font-medium transition ${
                      filterStatus() === st
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {st === 'all' ? 'Semua' : st}
                  </button>
                ))}
              </div>
              <span class="text-slate-400">
                {handovers().filter(h => {
                  const q = searchQuery().toLowerCase();
                  const matchQ = !q || h.item_name.toLowerCase().includes(q) ||
                    h.recipient_name.toLowerCase().includes(q) ||
                    (h.recipient_department && h.recipient_department.toLowerCase().includes(q)) ||
                    (h.serial_number && h.serial_number.toLowerCase().includes(q));
                  const matchSt = filterStatus() === 'all' || h.status === filterStatus();
                  return matchQ && matchSt;
                }).length} dokumen
              </span>
            </div>
          </div>

          <div class="space-y-3">
            <For each={handovers().filter(h => {
              const q = searchQuery().toLowerCase();
              const matchQ = !q || h.item_name.toLowerCase().includes(q) ||
                h.recipient_name.toLowerCase().includes(q) ||
                (h.recipient_department && h.recipient_department.toLowerCase().includes(q)) ||
                (h.serial_number && h.serial_number.toLowerCase().includes(q));
              const matchSt = filterStatus() === 'all' || h.status === filterStatus();
              return matchQ && matchSt;
            })}>
              {(h) => {
                const isSelected = selectedHandover()?.id === h.id;
                return (
                  <div
                    onClick={() => setSelectedHandover(h)}
                    class={`p-4 rounded-2xl border cursor-pointer transition flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                        : 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm'
                    }`}
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-800 line-clamp-1">{h.item_name}</span>
                      <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        h.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {h.status}
                      </span>
                    </div>
                    <div class="text-xs text-slate-500">Penerima: <strong class="text-slate-700">{h.recipient_name}</strong> ({h.recipient_department})</div>
                    <div class="flex items-center justify-between text-[11px] text-slate-400">
                      <span class="font-mono">SN: {h.serial_number || '-'}</span>
                      <span class="font-mono font-bold text-indigo-600">BAST-{h.id}</span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Right Detail */}
        <div class="lg:col-span-7">
          <Show
            when={selectedHandover()}
            fallback={
              <div class="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
                <div class="text-3xl">📦</div>
                <h3 class="text-sm font-bold text-slate-700">Tidak ada dokumen serah terima yang dipilih</h3>
                <p class="text-xs text-slate-500 max-w-md mx-auto">
                  {handovers().length === 0
                    ? 'Belum ada data form serah terima perangkat yang tersimpan atau Anda belum memiliki dokumen serah terima yang ditugaskan.'
                    : 'Silakan pilih salah satu form serah terima pada daftar di sebelah kiri untuk melihat detail atau melakukan konfirmasi verifikasi.'}
                </p>
                <Show when={handovers().length === 0}>
                  <button
                    onClick={openCreateModal}
                    class="mt-2 px-4 py-2 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition inline-flex items-center gap-2"
                  >
                    <span>➕</span> Buat Form Serah Terima Baru
                  </button>
                </Show>
              </div>
            }
          >
            {(() => {
              const h = selectedHandover()!;
              return (
                <div class="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        h.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {h.status}
                      </span>
                      <h2 class="text-base sm:text-lg font-bold text-slate-800 mt-1">{h.item_name}</h2>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        onClick={() => props.onOpenPdf(h)}
                        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                      >
                        📄 <span>Lihat & Cetak PDF ISO</span>
                      </button>

                      {h.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => populateFormForEdit(h)}
                            class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-sm"
                            title="Edit Form"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(h.id)}
                            class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition shadow-sm border border-rose-100"
                            title="Hapus Form"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <div class="text-slate-500">Penerima</div>
                      <div class="font-bold text-slate-800 mt-0.5">{h.recipient_name}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Departemen</div>
                      <div class="font-bold text-slate-800 mt-0.5">{h.recipient_department}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Serial Number</div>
                      <div class="font-bold text-[#1877f2] font-mono mt-0.5">{h.serial_number}</div>
                    </div>
                    <div>
                      <div class="text-slate-500">Masa Pinjam</div>
                      <div class="font-bold text-slate-800 mt-0.5">{h.loan_period}</div>
                    </div>
                  </div>

                  <div>
                    <div class="text-xs font-bold text-slate-700 mb-1">Spesifikasi & Kondisi</div>
                    <div class="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200">
                      {h.specification}
                    </div>
                  </div>

                  {/* Actions */}
                  {h.status === 'Pending' && (
                    <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                      <div class="text-xs text-amber-800 font-medium">Menunggu konfirmasi tanda tangan penerima</div>
                      <button
                        onClick={() => promptApprove(h)}
                        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition"
                      >
                        ✍️ Verifikasi Selesai
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </Show>
        </div>
      </div>

      {/* Modal Form Serah Terima */}
      <Show when={showCreateModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 class="text-base font-bold text-slate-800">
                {isEditMode() ? '✏️ Edit Form Serah Terima ICT' : '📦 Buat Form Serah Terima ICT'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} class="p-1.5 text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleCreateSubmit} class="p-6 overflow-y-auto space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Perangkat</label>
                <input
                  type="text"
                  value={formItemName()}
                  onInput={(e) => setFormItemName(e.currentTarget.value)}
                  required
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Autocomplete Nama Penerima */}
                <div class="relative">
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-xs font-semibold text-slate-700">Nama Penerima</label>
                    <span class="text-[10px] text-indigo-600 font-medium">💡 Ketik nama untuk cari</span>
                  </div>
                  <div class="relative">
                    <input
                      type="text"
                      placeholder="Cari atau ketik nama pegawai..."
                      value={formRecipientName()}
                      onFocus={() => setShowEmployeeDropdown(true)}
                      onInput={(e) => {
                        setFormRecipientName(e.currentTarget.value);
                        setShowEmployeeDropdown(true);
                      }}
                      required
                      class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1877f2] transition"
                    />
                    <Show when={formRecipientName()}>
                      <button
                        type="button"
                        onClick={() => {
                          setFormRecipientName('');
                          setFormRecipientEmail('');
                          setSelectedEmployee(null);
                        }}
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
                        title="Hapus pilihan"
                      >
                        ✕
                      </button>
                    </Show>
                  </div>

                  {/* Dropdown Hasil Pencarian Pegawai */}
                  <Show when={showEmployeeDropdown() && matchedEmployees().length > 0}>
                    <div
                      class="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100"
                    >
                      <div class="p-2 bg-slate-50 text-[11px] font-semibold text-slate-500 sticky top-0 border-b border-slate-100 flex items-center justify-between">
                        <span>Pilih Pegawai ({matchedEmployees().length})</span>
                        <button
                          type="button"
                          onClick={() => setShowEmployeeDropdown(false)}
                          class="text-slate-400 hover:text-slate-700"
                        >
                          ✕
                        </button>
                      </div>
                      <For each={matchedEmployees()}>
                        {(emp) => (
                          <div
                            onClick={() => handleSelectEmployee(emp)}
                            class="p-2.5 hover:bg-indigo-50/70 cursor-pointer transition flex flex-col gap-0.5"
                          >
                            <div class="flex items-center justify-between">
                              <span class="text-xs font-bold text-slate-800">{emp.displayName}</span>
                              <span class="text-[10px] font-mono font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md">
                                {emp.department}
                              </span>
                            </div>
                            <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <span>{emp.jobTitle}</span>
                              <span>•</span>
                              <span class="font-mono text-[10px] text-slate-400">{emp.nik || emp.username}</span>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* Departemen / Divisi Penerima (Auto terisi & bisa diedit jika perlu) */}
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-xs font-semibold text-slate-700">Departemen / Divisi Penerima</label>
                    <span class="text-[10px] text-emerald-600 font-semibold">⚡ Otomatis terisi</span>
                  </div>
                  <input
                    type="text"
                    value={formRecipientDept()}
                    onInput={(e) => setFormRecipientDept(e.currentTarget.value as Department)}
                    placeholder="Divisi otomatis terisi saat pilih pegawai"
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#1877f2] transition"
                  />
                  <Show when={formRecipientEmail()}>
                    <div class="text-[10px] text-slate-400 mt-1 truncate">
                      Email: {formRecipientEmail()}
                    </div>
                  </Show>
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Serial Number (SN)</label>
                <input
                  type="text"
                  value={formSerialNum()}
                  onInput={(e) => setFormSerialNum(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Spesifikasi & Kelengkapan</label>
                <textarea
                  rows="2"
                  value={formSpec()}
                  onInput={(e) => setFormSpec(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                ></textarea>
              </div>
              <div class="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowCreateModal(false)} class="px-4 py-2 text-xs text-slate-500 hover:text-slate-800">Batal</button>
                <button type="submit" class="px-6 py-2 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition">
                  {isEditMode() ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal Konfirmasi Persetujuan / Verifikasi Penerimaan Handover */}
      <Show when={showConfirmModal() && handoverToConfirm()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 animate-scaleUp">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                ✍️
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-800">Konfirmasi Penerimaan Barang</h3>
                <p class="text-xs text-slate-500">Berita Acara Serah Terima (BAST-{handoverToConfirm()?.id})</p>
              </div>
            </div>

            <div class="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-950 space-y-1.5 leading-relaxed">
              <p>
                Apakah Anda yakin ingin mengonfirmasi dan menyetujui penerimaan barang <strong>{handoverToConfirm()?.itemName}</strong>?
              </p>
              <p class="text-[11px] text-emerald-800">
                Tanda tangan digital resmi Anda akan dibubuhkan secara otomatis sebagai bukti serah terima yang sah.
              </p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setHandoverToConfirm(null);
                }}
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handoverToConfirm() && handleApprove(handoverToConfirm()!.id)}
                class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition flex items-center gap-1.5"
              >
                <span>✓</span> Ya, Konfirmasi & Tanda Tangani
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
