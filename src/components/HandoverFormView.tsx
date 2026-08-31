import { createSignal, For, Show } from 'solid-js';
import type { HandoverForm, UserProfile, Department } from '../lib/types';
import { SAMPLE_SIGNATURE_1, OFFICIAL_DEPARTMENTS, COORDINATORS_MAP } from '../lib/dummyData';

interface Props {
  handovers: HandoverForm[];
  currentUser?: UserProfile;
  onOpenPdf: (handover: HandoverForm) => void;
  onOpenSignatureModal: (title: string, onSave: (sig: string) => void) => void;
}

export default function HandoverFormView(props: Props) {
  const [handovers, setHandovers] = createSignal<HandoverForm[]>(props.handovers);
  const [selectedHandover, setSelectedHandover] = createSignal<HandoverForm | null>(props.handovers[0] || null);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editHandoverId, setEditHandoverId] = createSignal<number | null>(null);

  // Form State
  const [formItemName, setFormItemName] = createSignal('Laptop Lenovo ThinkPad L14 Gen 4');
  const [formRecipientName, setFormRecipientName] = createSignal('');
  const [formRecipientEmail, setFormRecipientEmail] = createSignal('');
  const [formRecipientDept, setFormRecipientDept] = createSignal<Department>('SD');
  const [formSerialNum, setFormSerialNum] = createSignal('PF-9X28172');
  const [formSpec, setFormSpec] = createSignal('Core i5-1335U, RAM 16GB, SSD 512GB, Charger Original');
  const [formLoanPeriod, setFormLoanPeriod] = createSignal('Selama Menjabat Koordinator SD');
  const [formNotes, setFormNotes] = createSignal('Perangkat operasional kerja unit SD.');

  const resetForm = () => {
    setFormItemName('Laptop Lenovo ThinkPad L14 Gen 4');
    setFormRecipientName('');
    setFormRecipientEmail('');
    setFormRecipientDept('SD');
    setFormSerialNum('PF-9X28172');
    setFormSpec('Core i5-1335U, RAM 16GB, SSD 512GB, Charger Original');
    setFormLoanPeriod('Selama Menjabat Koordinator SD');
    setFormNotes('Perangkat operasional kerja unit SD.');
    setIsEditMode(false);
    setEditHandoverId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const populateFormForEdit = (h: HandoverForm) => {
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
    const newHandover: HandoverForm = {
      id: Date.now(),
      item_name: formItemName(),
      handover_date: new Date().toISOString().split('T')[0],
      recipient_name: formRecipientName(),
      recipient_email: formRecipientEmail(),
      recipient_department: formRecipientDept(),
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
          approverEmail: formRecipientEmail(),
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
          <For each={handovers()}>
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
                  <div class="text-[11px] font-mono text-slate-400">SN: {h.serial_number}</div>
                </div>
              );
            }}
          </For>
        </div>

        {/* Right Detail */}
        <div class="lg:col-span-7">
          <Show when={selectedHandover()}>
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
                        onClick={() => handleApprove(h.id)}
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
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Penerima</label>
                  <input
                    type="text"
                    value={formRecipientName()}
                    onInput={(e) => setFormRecipientName(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Departemen Penerima</label>
                  <select
                    value={formRecipientDept()}
                    onChange={(e) => setFormRecipientDept(e.currentTarget.value as Department)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  >
                    <For each={OFFICIAL_DEPARTMENTS}>
                      {(dept) => <option value={dept}>{dept}</option>}
                    </For>
                  </select>
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
    </div>
  );
}
