import { createSignal, createResource, For, Show } from 'solid-js';
import type { LeaveRequest, UserProfile, Department } from '../lib/types';
import { SAMPLE_SIGNATURE_1, OFFICIAL_DEPARTMENTS, COORDINATORS_MAP } from '../lib/dummyData';

const fetchLeaves = async () => {
  const res = await fetch('/api/leaves');
  if (!res.ok) throw new Error('Failed to fetch Leaves');
  const json = await res.json();
  return json.data as LeaveRequest[];
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

  // Form State
  const [formName, setFormName] = createSignal(props.currentUser?.displayName || '');
  const [formPosition, setFormPosition] = createSignal(props.currentUser?.jobTitle || 'Staff IT & Lead Developer');
  const [formDepartment, setFormDepartment] = createSignal<Department>((props.currentUser?.department as Department) || 'ICT');
  const [formStartDate, setFormStartDate] = createSignal('2026-08-26');
  const [formEndDate, setFormEndDate] = createSignal('2026-08-28');
  const [formWorkDays, setFormWorkDays] = createSignal(3);
  const [formPurpose, setFormPurpose] = createSignal('Keperluan keluarga mendesak di luar kota.');
  const [formHakPrev, setFormHakPrev] = createSignal(2);
  const [formHakCurr, setFormHakCurr] = createSignal(12);
  const [formTakenUntil, setFormTakenUntil] = createSignal(3);
  const [formSignature, setFormSignature] = createSignal(props.currentUser?.signature_data || SAMPLE_SIGNATURE_1);

  const resetForm = () => {
    setFormName(props.currentUser?.displayName || '');
    setFormPosition(props.currentUser?.jobTitle || 'Staff IT & Lead Developer');
    setFormDepartment((props.currentUser?.department as Department) || 'ICT');
    setFormStartDate('2026-08-26');
    setFormEndDate('2026-08-28');
    setFormWorkDays(3);
    setFormPurpose('Keperluan keluarga mendesak di luar kota.');
    setFormHakPrev(2);
    setFormHakCurr(12);
    setFormTakenUntil(3);
    setIsEditMode(false);
    setEditLeaveId(null);
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
    return leaves().filter(l => {
      return l.name.toLowerCase().includes(searchQuery().toLowerCase()) ||
             l.department.toLowerCase().includes(searchQuery().toLowerCase()) ||
             l.purpose.toLowerCase().includes(searchQuery().toLowerCase());
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

        <button
          onClick={openCreateModal}
          class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          <span>➕</span> Ajukan Cuti Baru
        </button>
      </div>

      {/* Main Grid Layout */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Leave List (5 cols) */}
        <div class="lg:col-span-5 space-y-3">
          <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <input
              type="text"
              placeholder="Cari nama karyawan atau unit..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white"
            />
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
                          onClick={() => handleApproveStep(lv.id)}
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
    </div>
  );
}
