import { createSignal, createResource, For, Show } from 'solid-js';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { Asset } from '../lib/types';

const fetchAssets = async () => {
  const res = await fetch('/api/assets');
  if (!res.ok) throw new Error('Failed to fetch Assets');
  const json = await res.json();
  return json.data as Asset[];
};

export default function AssetManagementView() {
  const [assets] = createResource(fetchAssets, { initialValue: [] });
  const [selectedAssetForLabel, setSelectedAssetForLabel] = createSignal<Asset | null>(null);
  const [showLabelModal, setShowLabelModal] = createSignal(false);
  const [qrCodeUrl, setQrCodeUrl] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');

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

  const filteredAssets = () => {
    return assets().filter(a => {
      return a.name.toLowerCase().includes(searchQuery().toLowerCase()) ||
             a.asset_code.toLowerCase().includes(searchQuery().toLowerCase()) ||
             a.location.toLowerCase().includes(searchQuery().toLowerCase());
    });
  };

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-800">Manajemen Aset & Label Barcode</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
              ISO 21001:2018 Asset Tag
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Inventaris perangkat keras, status peminjaman, dan cetak stiker label QR / Barcode standar ISO.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick={() => openLabelModal(assets()[0])}
            class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center gap-2"
          >
            🏷️ Cetak Stiker Barcode Aset
          </button>
        </div>
      </div>

      {/* Asset Table */}
      <div class="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <input
            type="text"
            placeholder="Cari kode aset, nama barang, lokasi..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full max-w-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400"
          />
          <span class="text-xs text-slate-500 font-mono hidden sm:inline">Total {filteredAssets().length} Unit</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th class="p-3.5">Kode Aset</th>
                <th class="p-3.5">Nama Perangkat</th>
                <th class="p-3.5">Kategori</th>
                <th class="p-3.5">Lokasi</th>
                <th class="p-3.5">Status</th>
                <th class="p-3.5">Pengguna / PJ</th>
                <th class="p-3.5 text-center">Label</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <For each={filteredAssets()}>
                {(asset) => (
                  <tr class="hover:bg-blue-50/30 transition">
                    <td class="p-3.5 font-mono font-bold text-[#1877f2]">{asset.asset_code}</td>
                    <td class="p-3.5">
                      <div class="font-semibold text-slate-800">{asset.name}</div>
                      <div class="text-[10px] text-slate-400 font-mono">SN: {asset.serial_number}</div>
                    </td>
                    <td class="p-3.5 text-slate-600">{asset.category}</td>
                    <td class="p-3.5 text-slate-600">{asset.location}</td>
                    <td class="p-3.5">
                      <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        asset.status === 'Digunakan' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td class="p-3.5 text-slate-600">{asset.assigned_to || '-'}</td>
                    <td class="p-3.5 text-center">
                      <button
                        onClick={() => openLabelModal(asset)}
                        class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#1877f2] border border-blue-200 rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        🏷️ Label
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

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
                          <div class="text-[11px] text-slate-700"><strong>SN:</strong> {ast.serial_number}</div>
                          <div class="text-[11px] text-slate-700"><strong>Lokasi:</strong> {ast.location}</div>
                          <div class="text-[10px] text-slate-500 font-mono">Tgl: {ast.purchase_date}</div>
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
