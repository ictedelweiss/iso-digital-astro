import { createSignal, createResource, For, Show } from 'solid-js';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { Asset, UserProfile } from '../lib/types';
import { ACTIVE_EMPLOYEES, type EmployeeSeed } from '../lib/employeeData';

const fetchAssets = async () => {
  const res = await fetch('/api/assets');
  if (!res.ok) throw new Error('Failed to fetch Assets');
  const json = await res.json();
  return (json.data || []) as Asset[];
};

const fetchUsers = async () => {
  const res = await fetch('/api/users');
  if (!res.ok) return ACTIVE_EMPLOYEES;
  const json = await res.json();
  return (json.data && json.data.length > 0 ? json.data : ACTIVE_EMPLOYEES);
};

interface Props {
  currentUser?: UserProfile;
  showToast?: (msg: string) => void;
}

const CATEGORY_OPTIONS = [
  'Laptop / Komputer',
  'Monitor & Display',
  'Proyektor & AV',
  'Printer & Scanner',
  'Jaringan & Server',
  'Audio & Speaker',
  'Furnitur Kantor',
  'Elektronik Lainnya',
];

const LOCATION_OPTIONS = [
  'Ruang Server / ICT',
  'Ruang Guru SD',
  'Ruang Guru SMP',
  'Ruang Pimpinan & Yayasan',
  'Laboratorium Komputer',
  'Perpustakaan',
  'Aula Pertemuan',
  'Tata Usaha / Kantor',
  'Gudang Inventaris',
];

const STATUS_OPTIONS = ['Digunakan', 'Tersedia', 'Dipinjam', 'Maintenance', 'Rusak'] as const;
const CONDITION_OPTIONS = ['Baik', 'Rusak Ringan', 'Rusak Berat'] as const;

export default function AssetManagementView(props: Props) {
  const [assets, { refetch: refetchAssets, mutate: setAssets }] = createResource(fetchAssets, { initialValue: [] });
  const [usersList, { refetch: refetchUsers }] = createResource(fetchUsers, {
    initialValue: ACTIVE_EMPLOYEES,
  });
  const [selectedAssetForLabel, setSelectedAssetForLabel] = createSignal<Asset | null>(null);
  const [showLabelModal, setShowLabelModal] = createSignal(false);
  const [qrCodeUrl, setQrCodeUrl] = createSignal('');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filterCategory, setFilterCategory] = createSignal<string>('all');
  const [filterStatus, setFilterStatus] = createSignal<string>('all');
  const [sortBy, setSortBy] = createSignal<'code' | 'name' | 'date' | 'value'>('code');

  // CRUD Modal State
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editAssetId, setEditAssetId] = createSignal<number | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Form Fields
  const [formAssetCode, setFormAssetCode] = createSignal('');
  const [formName, setFormName] = createSignal('');
  const [formCategory, setFormCategory] = createSignal(CATEGORY_OPTIONS[0]);
  const [formLocation, setFormLocation] = createSignal(LOCATION_OPTIONS[0]);
  const [formCondition, setFormCondition] = createSignal<string>('Baik');
  const [formStatus, setFormStatus] = createSignal<string>('Tersedia');
  const [formSerialNumber, setFormSerialNumber] = createSignal('');
  const [formPurchaseDate, setFormPurchaseDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [formValue, setFormValue] = createSignal<number | string>('');
  const [formAssignedTo, setFormAssignedTo] = createSignal('');

  // Employee Autocomplete for assignedTo
  const [showEmployeeDropdown, setShowEmployeeDropdown] = createSignal(false);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [assetToDelete, setAssetToDelete] = createSignal<Asset | null>(null);
  const [isDeleting, setIsDeleting] = createSignal(false);

  let barcodeSvgRef: SVGSVGElement | undefined;

  const generateLabelGraphics = async (asset: Asset) => {
    try {
      const qr = await QRCode.toDataURL(`https://iso.edelweiss.sch.id/asset/${asset.asset_code}`, {
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrCodeUrl(qr);

      setTimeout(() => {
        if (barcodeSvgRef) {
          JsBarcode(barcodeSvgRef, asset.asset_code, {
            format: 'CODE128',
            lineColor: '#000',
            width: 1.5,
            height: 35,
            displayValue: true,
            fontSize: 10,
            font: 'Arial',
          });
        }
      }, 50);
    } catch (e) {
      console.error(e);
    }
  };

  const openLabelModal = (asset: Asset) => {
    setSelectedAssetForLabel(asset);
    setShowLabelModal(true);
    generateLabelGraphics(asset);
  };

  // Open Create Form
  const openCreateModal = () => {
    refetchUsers();
    setIsEditMode(false);
    setEditAssetId(null);

    // Auto-generate suggestion for code: AST-YYYYMM-XXX
    const nextSeq = String(assets().length + 1).padStart(3, '0');
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    setFormAssetCode(`AST-${yr}${mo}-${nextSeq}`);

    setFormName('');
    setFormCategory(CATEGORY_OPTIONS[0]);
    setFormLocation(LOCATION_OPTIONS[0]);
    setFormCondition('Baik');
    setFormStatus('Tersedia');
    setFormSerialNumber('');
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setFormValue('');
    setFormAssignedTo('');
    setShowEmployeeDropdown(false);
    setShowFormModal(true);
  };

  // Open Edit Form
  const openEditModal = (asset: Asset) => {
    refetchUsers();
    setIsEditMode(true);
    setEditAssetId(asset.id);
    setFormAssetCode(asset.asset_code);
    setFormName(asset.name);
    setFormCategory(asset.category);
    setFormLocation(asset.location);
    setFormCondition(asset.condition);
    setFormStatus(asset.status);
    setFormSerialNumber(asset.serial_number || '');
    setFormPurchaseDate(asset.purchase_date || '');
    setFormValue(asset.value ? String(asset.value) : '');
    setFormAssignedTo(asset.assigned_to || '');
    setShowEmployeeDropdown(false);
    setShowFormModal(true);
  };

  // Open Delete Modal
  const promptDeleteAsset = (asset: Asset) => {
    setAssetToDelete(asset);
    setShowDeleteModal(true);
  };

  // Autocomplete matched employees
  const matchedEmployees = () => {
    const q = formAssignedTo().trim().toLowerCase();
    const list = usersList() || ACTIVE_EMPLOYEES;
    if (!q) return list.slice(0, 6);
    return list.filter(
      (emp: any) =>
        emp.displayName.toLowerCase().includes(q) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.jobTitle && emp.jobTitle.toLowerCase().includes(q)) ||
        (emp.username && emp.username.toLowerCase().includes(q))
    ).slice(0, 8);
  };

  const handleSelectEmployee = (emp: any) => {
    setFormAssignedTo(emp.department ? `${emp.displayName} (${emp.department})` : emp.displayName);
    if (formStatus() === 'Tersedia') {
      setFormStatus('Digunakan');
    }
    setShowEmployeeDropdown(false);
  };

  // Save (Create or Update)
  const handleSaveAsset = async (e: Event) => {
    e.preventDefault();
    if (!formAssetCode().trim() || !formName().trim()) {
      alert('Kode Aset dan Nama Aset wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      asset_code: formAssetCode().trim().toUpperCase(),
      name: formName().trim(),
      category: formCategory(),
      location: formLocation(),
      condition: formCondition(),
      status: formStatus(),
      serial_number: formSerialNumber().trim() || null,
      purchase_date: formPurchaseDate() || null,
      value: formValue() ? Number(formValue()) : null,
      assigned_to: formAssignedTo().trim() || null,
    };

    try {
      if (isEditMode() && editAssetId()) {
        const res = await fetch(`/api/assets/${editAssetId()}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Gagal memperbarui data aset.');

        // Update local resource
        setAssets((prev) =>
          prev.map((a) => (a.id === editAssetId() ? { ...a, ...payload, id: a.id } : a))
        );
        props.showToast?.('✓ Data aset berhasil diperbarui!');
      } else {
        const res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Gagal mendaftarkan aset baru.');

        await refetchAssets();
        props.showToast?.('✓ Aset baru berhasil didaftarkan!');
      }

      setShowFormModal(false);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menyimpan data aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Action
  const handleConfirmDelete = async () => {
    const ast = assetToDelete();
    if (!ast) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/assets/${ast.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus aset.');

      setAssets((prev) => prev.filter((a) => a.id !== ast.id));
      setShowDeleteModal(false);
      setAssetToDelete(null);
      props.showToast?.('✓ Data aset berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menghapus aset.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered & Sorted Assets
  const filteredAssets = () => {
    let list = [...assets()];

    const q = searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        return (
          a.name.toLowerCase().includes(q) ||
          a.asset_code.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
          (a.assigned_to && a.assigned_to.toLowerCase().includes(q))
        );
      });
    }

    const cat = filterCategory();
    if (cat !== 'all') {
      list = list.filter((a) => a.category === cat);
    }

    const st = filterStatus();
    if (st !== 'all') {
      list = list.filter((a) => a.status === st);
    }

    const sort = sortBy();
    list.sort((a, b) => {
      if (sort === 'code') return a.asset_code.localeCompare(b.asset_code);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'date') {
        const dA = new Date(a.purchase_date || '1970-01-01').getTime();
        const dB = new Date(b.purchase_date || '1970-01-01').getTime();
        return dB - dA;
      }
      if (sort === 'value') return (b.value || 0) - (a.value || 0);
      return 0;
    });

    return list;
  };

  // Summary Metrics
  const metrics = () => {
    const all = assets();
    const totalCount = all.length;
    const inUseCount = all.filter((a) => a.status === 'Digunakan' || a.status === 'Dipinjam').length;
    const availableCount = all.filter((a) => a.status === 'Tersedia').length;
    const maintenanceCount = all.filter((a) => a.status === 'Maintenance' || a.status === 'Rusak').length;
    const totalValue = all.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

    return { totalCount, inUseCount, availableCount, maintenanceCount, totalValue };
  };

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-800">Manajemen Aset & Inventaris</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
              ISO 21001:2018 Asset Tag
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Pengelolaan inventaris perangkat keras, status peminjaman, penanggung jawab, dan cetak stiker label barcode/QR standar ISO.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={openCreateModal}
            class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center gap-2"
          >
            <span>➕</span> Tambah Aset Baru
          </button>
          <Show when={assets().length > 0}>
            <button
              onClick={() => openLabelModal(assets()[0])}
              class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2 border border-slate-200"
            >
              <span>🏷️</span> Cetak Stiker
            </button>
          </Show>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
            📦
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-medium">Total Aset</div>
            <div class="text-lg font-black text-slate-800">{metrics().totalCount} Unit</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
            👤
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-medium">Sedang Digunakan</div>
            <div class="text-lg font-black text-emerald-700">{metrics().inUseCount} Unit</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-lg font-bold">
            ✨
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-medium">Tersedia di Gudang</div>
            <div class="text-lg font-black text-sky-700">{metrics().availableCount} Unit</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
            🛠️
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-medium">Perbaikan / Rusak</div>
            <div class="text-lg font-black text-amber-700">{metrics().maintenanceCount} Unit</div>
          </div>
        </div>
      </div>

      {/* Filter, Search & Sort Toolbar */}
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            placeholder="Cari kode aset, nama barang, nomor serial (SN), lokasi, atau pemegang..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] transition"
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery('')}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </Show>
        </div>

        {/* Filter Dropdowns */}
        <div class="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <select
            value={filterCategory()}
            onChange={(e) => setFilterCategory(e.currentTarget.value)}
            class="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold focus:bg-white focus:border-[#1877f2] cursor-pointer"
          >
            <option value="all">📁 Semua Kategori</option>
            <For each={CATEGORY_OPTIONS}>{(cat) => <option value={cat}>{cat}</option>}</For>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus()}
            onChange={(e) => setFilterStatus(e.currentTarget.value)}
            class="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold focus:bg-white focus:border-[#1877f2] cursor-pointer"
          >
            <option value="all">⚡ Semua Status</option>
            <For each={STATUS_OPTIONS}>{(st) => <option value={st}>{st}</option>}</For>
          </select>

          {/* Sort */}
          <select
            value={sortBy()}
            onChange={(e) => setSortBy(e.currentTarget.value as any)}
            class="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold focus:bg-white focus:border-[#1877f2] cursor-pointer"
          >
            <option value="code">🔤 Kode Aset</option>
            <option value="name">📋 Nama Barang</option>
            <option value="date">📅 Tanggal Beli</option>
            <option value="value">💰 Nilai / Harga</option>
          </select>
        </div>
      </div>

      {/* Asset Table */}
      <div class="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div class="text-xs font-bold text-slate-700">
            Daftar Inventaris Aset ({filteredAssets().length})
          </div>
          <span class="text-xs text-slate-500 font-mono">
            {assets().length} total tercatat
          </span>
        </div>

        <div class="overflow-x-auto max-h-[620px]">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th class="p-3.5 w-10 text-center">No</th>
                <th class="p-3.5">Kode Aset</th>
                <th class="p-3.5">Nama Perangkat & Spesifikasi</th>
                <th class="p-3.5">Kategori</th>
                <th class="p-3.5">Lokasi</th>
                <th class="p-3.5">Kondisi</th>
                <th class="p-3.5">Status</th>
                <th class="p-3.5">Pengguna / PJ</th>
                <th class="p-3.5 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <Show
                when={filteredAssets().length > 0}
                fallback={
                  <tr>
                    <td colspan="9" class="p-8 text-center text-xs text-slate-400">
                      {searchQuery() || filterCategory() !== 'all' || filterStatus() !== 'all'
                        ? 'Tidak ada aset yang sesuai dengan kriteria pencarian / filter.'
                        : 'Belum ada aset yang terdaftar. Klik tombol "Tambah Aset Baru" di atas untuk mendaftarkan aset.'}
                    </td>
                  </tr>
                }
              >
                <For each={filteredAssets()}>
                  {(asset, idx) => (
                    <tr class="hover:bg-blue-50/30 transition">
                      <td class="p-3.5 text-center font-bold text-slate-400">{idx() + 1}</td>
                      <td class="p-3.5 font-mono font-bold text-[#1877f2]">
                        <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-md">
                          {asset.asset_code}
                        </span>
                      </td>
                      <td class="p-3.5">
                        <div class="font-bold text-slate-800">{asset.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">
                          {asset.serial_number ? `SN: ${asset.serial_number}` : 'Tanpa SN'}
                          {asset.value ? ` • Rp ${Number(asset.value).toLocaleString('id-ID')}` : ''}
                        </div>
                      </td>
                      <td class="p-3.5 text-slate-600 font-medium">{asset.category}</td>
                      <td class="p-3.5 text-slate-600">{asset.location}</td>
                      <td class="p-3.5">
                        <span class={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          asset.condition === 'Baik'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : asset.condition === 'Rusak Ringan'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {asset.condition}
                        </span>
                      </td>
                      <td class="p-3.5">
                        <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          asset.status === 'Digunakan'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : asset.status === 'Tersedia'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : asset.status === 'Dipinjam'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {asset.status}
                        </span>
                      </td>
                      <td class="p-3.5 text-slate-600 font-medium">
                        {asset.assigned_to ? (
                          <div class="flex items-center gap-1">
                            <span>👤</span>
                            <span class="truncate max-w-[140px]">{asset.assigned_to}</span>
                          </div>
                        ) : (
                          <span class="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td class="p-3.5 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openLabelModal(asset)}
                            class="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#1877f2] border border-blue-200 rounded-lg text-xs font-semibold shadow-2xs transition"
                            title="Cetak Stiker Label Barcode/QR"
                          >
                            🏷️
                          </button>
                          <button
                            onClick={() => openEditModal(asset)}
                            class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            title="Edit Data Aset"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => promptDeleteAsset(asset)}
                            class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold transition"
                            title="Hapus Aset"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Tambah / Edit Aset (CRUD) */}
      <Show when={showFormModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <span class="text-xl">{isEditMode() ? '✏️' : '➕'}</span>
                <div>
                  <h3 class="text-base font-bold text-slate-800">
                    {isEditMode() ? 'Edit Data Aset' : 'Registrasi Aset Baru'}
                  </h3>
                  <p class="text-[11px] text-slate-500">Standar Formulir Inventaris ISO 21001:2018</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAsset} class="space-y-4 text-xs">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Kode Aset */}
                <div>
                  <label class="block font-bold text-slate-700 mb-1">
                    Kode Aset <span class="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: AST-202609-001"
                    value={formAssetCode()}
                    onInput={(e) => setFormAssetCode(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 uppercase focus:bg-white focus:border-[#1877f2]"
                  />
                  <p class="text-[10px] text-slate-400 mt-0.5">Format acuan: <code>AST-[TAHUN][BLN]-[NO]</code></p>
                </div>

                {/* Serial Number */}
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Serial Number (SN)</label>
                  <input
                    type="text"
                    placeholder="Contoh: SN-PF9X2817"
                    value={formSerialNumber()}
                    onInput={(e) => setFormSerialNumber(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  />
                </div>
              </div>

              {/* Nama Barang */}
              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  Nama Perangkat / Barang <span class="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Laptop Lenovo ThinkPad L14 Gen 4"
                  value={formName()}
                  onInput={(e) => setFormName(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:bg-white focus:border-[#1877f2]"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Kategori */}
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Kategori Aset</label>
                  <select
                    value={formCategory()}
                    onChange={(e) => setFormCategory(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  >
                    <For each={CATEGORY_OPTIONS}>{(cat) => <option value={cat}>{cat}</option>}</For>
                  </select>
                </div>

                {/* Lokasi */}
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Lokasi Penyimpanan</label>
                  <select
                    value={formLocation()}
                    onChange={(e) => setFormLocation(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  >
                    <For each={LOCATION_OPTIONS}>{(loc) => <option value={loc}>{loc}</option>}</For>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Kondisi Fisik */}
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Kondisi Fisik</label>
                  <select
                    value={formCondition()}
                    onChange={(e) => setFormCondition(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  >
                    <For each={CONDITION_OPTIONS}>{(cond) => <option value={cond}>{cond}</option>}</For>
                  </select>
                </div>

                {/* Status Operasional */}
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Status Aset</label>
                  <select
                    value={formStatus()}
                    onChange={(e) => setFormStatus(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  >
                    <For each={STATUS_OPTIONS}>{(st) => <option value={st}>{st}</option>}</For>
                  </select>
                </div>
              </div>

              {/* Tanggal & Nilai Perolehan */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Tanggal Perolehan / Pembelian</label>
                  <input
                    type="date"
                    value={formPurchaseDate()}
                    onInput={(e) => setFormPurchaseDate(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  />
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">Estimasi Nilai / Harga (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 12500000"
                    value={formValue()}
                    onInput={(e) => setFormValue(e.currentTarget.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  />
                </div>
              </div>

              {/* Penanggung Jawab / Pengguna (Autocomplete dari data karyawan) */}
              <div class="relative">
                <label class="block font-bold text-slate-700 mb-1">
                  Penanggung Jawab / Pengguna Saat Ini
                </label>
                <div class="relative">
                  <input
                    type="text"
                    placeholder="Ketik nama guru/staf penanggung jawab..."
                    value={formAssignedTo()}
                    onInput={(e) => {
                      setFormAssignedTo(e.currentTarget.value);
                      setShowEmployeeDropdown(true);
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  />
                  <Show when={formAssignedTo()}>
                    <button
                      type="button"
                      onClick={() => setFormAssignedTo('')}
                      class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </Show>
                </div>

                <Show when={showEmployeeDropdown() && matchedEmployees().length > 0}>
                  <div class="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                    <For each={matchedEmployees()}>
                      {(emp) => (
                        <div
                          onClick={() => handleSelectEmployee(emp)}
                          class="p-2.5 hover:bg-blue-50 cursor-pointer transition flex items-center justify-between"
                        >
                          <div>
                            <div class="font-bold text-slate-800">{emp.displayName}</div>
                            <div class="text-[10px] text-slate-500">{emp.jobTitle} • {emp.department}</div>
                          </div>
                          <span class="text-[10px] text-blue-600 font-semibold">Pilih</span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  class="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting()}
                  class="px-5 py-2 bg-[#1877f2] hover:bg-blue-600 text-white font-bold rounded-xl shadow transition disabled:bg-slate-400 flex items-center gap-1.5"
                >
                  <span>✓</span> {isSubmitting() ? 'Menyimpan...' : (isEditMode() ? 'Update Aset' : 'Simpan Aset')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal Konfirmasi Hapus Aset */}
      <Show when={showDeleteModal() && assetToDelete()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 animate-scaleUp">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl shrink-0">
                🗑️
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-800">Hapus Data Aset</h3>
                <p class="text-xs text-slate-500">Konfirmasi Penghapusan Inventaris</p>
              </div>
            </div>

            <div class="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-950 space-y-1 leading-relaxed">
              <p>
                Apakah Anda yakin ingin menghapus data aset <strong>{assetToDelete()?.name}</strong> ({assetToDelete()?.asset_code})?
              </p>
              <p class="text-[11px] text-rose-700">
                Tindakan ini tidak dapat dibatalkan. Riwayat audit penghapusan akan tetap tercatat di sistem.
              </p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting()}
                onClick={() => {
                  setShowDeleteModal(false);
                  setAssetToDelete(null);
                }}
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting()}
                onClick={handleConfirmDelete}
                class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition flex items-center gap-1.5"
              >
                <span>🗑️</span> {isDeleting() ? 'Menghapus...' : 'Ya, Hapus Aset'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Modal Cetak Label Barcode & QR */}
      <Show when={showLabelModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                🏷️ Cetak Stiker Label Aset ISO
              </h3>
              <button onClick={() => setShowLabelModal(false)} class="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <Show when={selectedAssetForLabel()}>
              {(() => {
                const ast = selectedAssetForLabel()!;
                return (
                  <div class="space-y-4">
                    {/* Printable Label Preview Box (Physical Sticker Simulation) */}
                    <div id="printable-asset-label" class="bg-white text-black p-4 rounded-xl border-2 border-black shadow-sm space-y-2">
                      <div class="flex items-center justify-between border-b-2 border-black pb-2">
                        <div class="font-black text-xs leading-tight">
                          YAYASAN SINAR PUTIH EDELWEISS<br />
                          <span class="text-[10px] font-semibold text-slate-600">INVENTARIS ASET ISO 21001:2018</span>
                        </div>
                        <div class="text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                          {ast.asset_code}
                        </div>
                      </div>

                      <div class="flex items-center justify-between gap-3 pt-1">
                        <div class="flex-1 space-y-1 text-xs">
                          <div class="font-bold text-sm leading-tight text-slate-900">{ast.name}</div>
                          <div class="text-[11px] text-slate-700"><strong>SN:</strong> {ast.serial_number || '-'}</div>
                          <div class="text-[11px] text-slate-700"><strong>Lokasi:</strong> {ast.location}</div>
                          <div class="text-[10px] text-slate-500 font-mono">Tgl: {ast.purchase_date || '-'}</div>
                          <Show when={ast.assigned_to}>
                            <div class="text-[11px] text-slate-700"><strong>PJ:</strong> {ast.assigned_to}</div>
                          </Show>
                        </div>

                        <div class="shrink-0">
                          <Show when={qrCodeUrl()}>
                            <img src={qrCodeUrl()} alt="QR" class="w-20 h-20 border border-slate-300 p-0.5 rounded" />
                          </Show>
                        </div>
                      </div>

                      <div class="flex justify-center pt-1 border-t border-slate-300">
                        <svg ref={barcodeSvgRef} class="max-w-full h-10"></svg>
                      </div>
                    </div>

                    <div class="flex items-center justify-between pt-2">
                      <span class="text-xs text-slate-500">Ukuran Label: Standar 70 x 45 mm</span>
                      <button
                        onClick={() => window.print()}
                        class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
                      >
                        🖨️ Cetak Stiker Sekarang
                      </button>
                    </div>
                  </div>
                );
              })()}
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
