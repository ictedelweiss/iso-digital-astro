import { createSignal, createResource, For, Show } from 'solid-js';
import type { PurchaseRequisition, PrItem, UserProfile, Department } from '../lib/types';
import { SAMPLE_SIGNATURE_1, OFFICIAL_DEPARTMENTS, COORDINATORS_MAP } from '../lib/dummyData';

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
  const [prs, { mutate: setPrs }] = createResource(fetchPrs, { initialValue: [] });
  const [selectedPr, setSelectedPr] = createSignal<PurchaseRequisition | null>(null);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editPrId, setEditPrId] = createSignal<number | null>(null);
  const [filterStatus, setFilterStatus] = createSignal<string>('all');
  const [searchQuery, setSearchQuery] = createSignal<string>('');

  // Form State
  const [formTitle, setFormTitle] = createSignal('');
  const [formRequester, setFormRequester] = createSignal(props.currentUser?.displayName || '');
  const [formDepartment, setFormDepartment] = createSignal<Department>((props.currentUser?.department as Department) || 'ICT');
  const [formNeededDate, setFormNeededDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [formBudgetStatus, setFormBudgetStatus] = createSignal<'Dianggarkan' | 'Belum dianggarkan'>('Dianggarkan');
  const [formNotes, setFormNotes] = createSignal('');
  const [formSignature, setFormSignature] = createSignal(props.currentUser?.signature_data || SAMPLE_SIGNATURE_1);
  const [formItems, setFormItems] = createSignal<PrItem[]>([
    { id: 1, item_name: 'Access Point TP-Link Omada EAP610 WiFi 6', qty: 2, unit: 'Unit', price: 1350000 },
    { id: 2, item_name: 'Patch Cord Cat6 2 Meter Original', qty: 10, unit: 'Pcs', price: 35000 },
  ]);

  const addItemRow = () => {
    const nextId = formItems().length + 1;
    setFormItems([...formItems(), { id: nextId, item_name: '', qty: 1, unit: 'Unit', price: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (formItems().length > 1) {
      setFormItems(formItems().filter((_, i) => i !== index));
    }
  };

  const populateFormForEdit = (pr: PurchaseRequisition) => {
    setFormTitle(pr.title);
    setFormRequester(pr.requester);
    setFormDepartment(pr.department as Department);
    setFormNeededDate(pr.needed_date);
    setFormBudgetStatus(pr.budget_status);
    setFormNotes(pr.notes || '');
    setFormItems(pr.items.length > 0 ? pr.items : [{ id: 1, item_name: '', qty: 1, unit: 'Unit', price: 0 }]);
    setIsEditMode(true);
    setEditPrId(pr.id);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormRequester(props.currentUser?.displayName || '');
    setFormDepartment((props.currentUser?.department as Department) || 'ICT');
    setFormNeededDate(new Date().toISOString().split('T')[0]);
    setFormBudgetStatus('Dianggarkan');
    setFormNotes('');
    setFormItems([
      { id: 1, item_name: 'Access Point TP-Link Omada EAP610 WiFi 6', qty: 2, unit: 'Unit', price: 1350000 },
      { id: 2, item_name: 'Patch Cord Cat6 2 Meter Original', qty: 10, unit: 'Pcs', price: 35000 },
    ]);
    setIsEditMode(false);
    setEditPrId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const updateItem = (index: number, key: keyof PrItem, value: any) => {
    const updated = [...formItems()];
    updated[index] = { ...updated[index], [key]: value };
    setFormItems(updated);
  };

  const calcGrandTotal = () => {
    return formItems().reduce((acc, item) => acc + (Number(item.qty || 0) * Number(item.price || 0)), 0);
  };

  const handleCreateSubmit = (e: Event) => {
    e.preventDefault();
    const newPr: PurchaseRequisition = {
      id: Date.now(),
      pr_number: `PR/${formDepartment().toUpperCase()}/2026/08/${String(prs().length + 1).padStart(3, '0')}`,
      title: formTitle() || 'Pengadaan Perangkat Baru',
      requester: formRequester(),
      department: formDepartment(),
      needed_date: formNeededDate(),
      budget_status: formBudgetStatus(),
      notes: formNotes(),
      status: 'Pending',
      current_approval_step: 1,
      requester_signature: props.currentUser?.signature_data || formSignature(),
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      items: formItems().filter(item => item.item_name.trim() !== ''),
      approvals: [
        {
          step: 1,
          role: 'koordinator',
          roleTitle: `Koordinator ${formDepartment()}`,
          approverName: COORDINATORS_MAP[formDepartment() as Department]?.name || 'Koordinator Unit',
          approverEmail: COORDINATORS_MAP[formDepartment() as Department]?.email || 'koordinator@edelweiss.sch.id',
          status: 'current',
        },
        {
          step: 2,
          role: 'accounting',
          roleTitle: 'Accounting',
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

    if (isEditMode() && editPrId()) {
      newPr.id = editPrId()!;
      // Keep existing PR number and approvals for edit unless we want to reset them
      const existingPr = prs().find(p => p.id === newPr.id);
      if (existingPr) {
          newPr.pr_number = existingPr.pr_number;
          newPr.approvals = existingPr.approvals;
          newPr.created_at = existingPr.created_at;
          newPr.status = existingPr.status;
          newPr.current_approval_step = existingPr.current_approval_step;
      }
      
      fetch(`/api/prs/${newPr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPr)
      }).then(() => {
        setPrs(prs().map(p => p.id === newPr.id ? newPr : p));
        if (selectedPr()?.id === newPr.id) setSelectedPr(newPr);
        setShowCreateModal(false);
      }).catch(err => alert("Error updating PR: " + err));
    } else {
      fetch('/api/prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPr)
      }).then((res) => res.json()).then((data) => {
        if (data.prId) newPr.id = data.prId;
        setPrs([newPr, ...prs()]);
        setSelectedPr(newPr);
        setShowCreateModal(false);
      }).catch(err => alert("Error saving PR: " + err));
    }
  };

  const handleDelete = (prId: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus PR ini?")) return;
    fetch(`/api/prs/${prId}`, {
      method: 'DELETE'
    }).then(() => {
      setPrs(prs().filter(p => p.id !== prId));
      if (selectedPr()?.id === prId) setSelectedPr(null);
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

    try {
      const res = await fetch(`/api/prs/${prId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui dokumen.');

      setPrs(prs().map(p => {
        if (p.id !== prId) return p;
        const updatedApprovals = p.approvals.map(app => {
          if (app.step === currentStep) {
            return {
              ...app,
              approverName: props.currentUser?.displayName || app.approverName,
              approverEmail: props.currentUser?.email || app.approverEmail,
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

        const updatedPr: PurchaseRequisition = {
          ...p,
          current_approval_step: data.current_approval_step ?? p.current_approval_step,
          status: (data.status as PurchaseRequisition['status']) ?? p.status,
          approvals: updatedApprovals,
        };

        if (selectedPr()?.id === prId) setSelectedPr(updatedPr);
        return updatedPr;
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui dokumen.');
    }
  };

  const filteredPrs = () => {
    return prs().filter(pr => {
      const matchStatus = filterStatus() === 'all' || pr.status.toLowerCase() === filterStatus().toLowerCase();
      const matchSearch = pr.title.toLowerCase().includes(searchQuery().toLowerCase()) ||
                          pr.pr_number.toLowerCase().includes(searchQuery().toLowerCase()) ||
                          pr.requester.toLowerCase().includes(searchQuery().toLowerCase());
      return matchStatus && matchSearch;
    });
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

        <div class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span class="text-xs text-slate-500 whitespace-nowrap">Filter Status:</span>
          {(['all', 'Pending', 'Approved'] as const).map(st => (
            <button
              onClick={() => setFilterStatus(st)}
              class={`px-3 py-1 text-xs font-semibold rounded-xl transition ${
                filterStatus() === st
                  ? 'bg-[#1877f2] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'Semua' : st}
            </button>
          ))}
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
                return (
                  <div
                    onClick={() => setSelectedPr(pr)}
                    class={`p-4 rounded-2xl border cursor-pointer transition flex flex-col gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50/70 border-[#1877f2] shadow-sm ring-1 ring-[#1877f2]'
                        : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'
                    }`}
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-mono font-bold text-[#1877f2]">{pr.pr_number}</span>
                      <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        pr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {pr.status}
                      </span>
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
              const totalAmount = pr.items.reduce((acc, i) => acc + (i.qty * i.price), 0);

              return (
                <div class="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  {/* Top Bar inside Detail */}
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-mono font-bold text-[#1877f2]">{pr.pr_number}</span>
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
                      <div class="font-bold text-amber-600 mt-0.5">{pr.budget_status}</div>
                    </div>
                  </div>

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
                          {pr.items.map((item, idx) => (
                            <tr>
                              <td class="p-3 text-center text-slate-400">{idx + 1}</td>
                              <td class="p-3 font-semibold text-slate-800">{item.item_name}</td>
                              <td class="p-3 text-center text-slate-700">{item.qty}</td>
                              <td class="p-3 text-center text-slate-500">{item.unit}</td>
                              <td class="p-3 text-right font-mono text-slate-700">Rp {item.price.toLocaleString('id-ID')}</td>
                              <td class="p-3 text-right font-mono font-bold text-slate-900">
                                Rp {(item.qty * item.price).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
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
                    <div class="flex items-center justify-between">
                      <div class="text-xs font-bold text-slate-700">Alur Persetujuan (3-Step Approval)</div>
                      {pr.status === 'Pending' && (
                        <button
                          onClick={() => handleApproveStep(pr.id)}
                          class="px-3.5 py-1.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                        >
                          ✍️ Setujui Step {pr.current_approval_step}
                        </button>
                      )}
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {pr.approvals.map((app) => (
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
                      ))}
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

              {/* Budget Toggle */}
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Status Anggaran (Budget)</label>
                <div class="flex items-center gap-4">
                  <label class="flex items-center gap-2 text-xs cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="budget_status"
                      checked={formBudgetStatus() === 'Dianggarkan'}
                      onChange={() => setFormBudgetStatus('Dianggarkan')}
                      class="text-[#1877f2]"
                    />
                    <span>Dianggarkan (Sesuai RKAS)</span>
                  </label>
                  <label class="flex items-center gap-2 text-xs cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="budget_status"
                      checked={formBudgetStatus() === 'Belum dianggarkan'}
                      onChange={() => setFormBudgetStatus('Belum dianggarkan')}
                      class="text-[#1877f2]"
                    />
                    <span>Belum Dianggarkan (Tambahan)</span>
                  </label>
                </div>
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
                  {formItems().map((item, idx) => (
                    <div class="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span class="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        placeholder="Nama / Deskripsi Barang"
                        value={item.item_name}
                        onInput={(e) => updateItem(idx, 'item_name', e.currentTarget.value)}
                        required
                        class="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.qty}
                        onInput={(e) => updateItem(idx, 'qty', parseFloat(e.currentTarget.value) || 0)}
                        required
                        class="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center text-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Satuan"
                        value={item.unit}
                        onInput={(e) => updateItem(idx, 'unit', e.currentTarget.value)}
                        class="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center text-slate-800"
                      />
                      <input
                        type="number"
                        placeholder="Harga Satuan"
                        value={item.price}
                        onInput={(e) => updateItem(idx, 'price', parseFloat(e.currentTarget.value) || 0)}
                        required
                        class="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        class="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg text-xs"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
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
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                ></textarea>
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
                  class="px-6 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  🚀 Simpan & Kirim Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
