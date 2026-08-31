import { createSignal, onMount, onCleanup, Show, createEffect } from 'solid-js';
import type { UserProfile } from '../lib/types';

interface Props {
  user: UserProfile;
  isOpen: boolean;
  onSaveSignature: (signatureBase64: string) => Promise<void> | void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export default function FirstTimeSignatureModal(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined;
  const [isDrawing, setIsDrawing] = createSignal(false);
  const [hasDrawn, setHasDrawn] = createSignal(false);
  const [agreed, setAgreed] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);
  const [strokeColor, setStrokeColor] = createSignal('#1e3a8a'); // Professional deep navy/blue ink

  let ctx: CanvasRenderingContext2D | null = null;
  let lastX = 0;
  let lastY = 0;

  const initCanvas = () => {
    if (!canvasRef) return;
    const canvas = canvasRef;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor();
      drawGuidelines();
    }
  };

  const drawGuidelines = () => {
    if (!ctx || !canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();

    // Baseline guide
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.moveTo(30, rect.height - 40);
    ctx.lineTo(rect.width - 30, rect.height - 40);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Garis Dasar Tanda Tangan (Baseline)', 30, rect.height - 46);
    ctx.restore();
  };

  const clearCanvas = () => {
    if (!ctx || !canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawGuidelines();
    setHasDrawn(false);
  };

  const getCanvasCoords = (e: MouseEvent | TouchEvent) => {
    if (!canvasRef) return { x: 0, y: 0 };
    const rect = canvasRef.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing() || !ctx) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = strokeColor();
    ctx.lineWidth = 2.6;
    ctx.stroke();

    lastX = x;
    lastY = y;
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSave = async () => {
    if (!hasDrawn() || !canvasRef || !agreed()) return;
    setIsSaving(true);

    try {
      // Export as clean high-res PNG
      const dataUrl = canvasRef.toDataURL('image/png');
      await props.onSaveSignature(dataUrl);
    } catch (err) {
      console.error('Failed to save signature', err);
    } finally {
      setIsSaving(false);
    }
  };

  createEffect(() => {
    if (props.isOpen && typeof window !== 'undefined') {
      setTimeout(initCanvas, 100);
      window.addEventListener('resize', initCanvas);
    } else if (!props.isOpen && typeof window !== 'undefined') {
      window.removeEventListener('resize', initCanvas);
    }
  });

  onCleanup(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', initCanvas);
    }
  });

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-md animate-fadeIn">
        <div class="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl space-y-5 transform transition-all animate-slideUp">
          
          {/* Header */}
          <div class="flex items-start justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-blue-50 text-[#1877f2] flex items-center justify-center text-2xl font-bold shadow-sm shrink-0">
                ✍️
              </div>
              <div>
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-[#1877f2] text-[11px] font-bold rounded-full mb-1">
                  <span>🔐</span> Onboarding Tanda Tangan Digital Pertama
                </div>
                <h2 class="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  Rekam Tanda Tangan Digital Resmi
                </h2>
              </div>
            </div>

            <Show when={props.canDismiss && props.onClose}>
              <button
                onClick={props.onClose}
                class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </Show>
          </div>

          {/* User Welcome Notice */}
          <div class="p-3.5 bg-[#f0f7ff] border border-[#bae0fd] rounded-2xl flex items-center gap-3 text-xs">
            <div class="w-10 h-10 rounded-full bg-[#1877f2] text-white flex items-center justify-center font-bold text-sm shrink-0">
              {props.user.displayName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div class="font-bold text-slate-800">
                Halo, {props.user.displayName} ({props.user.department})
              </div>
              <p class="text-slate-600 text-[11px] mt-0.5 leading-snug">
                Akun Microsoft 365 Anda (<span class="font-mono text-[#1877f2]">{props.user.email}</span>) belum memiliki tanda tangan tersimpan. Tanda tangan ini akan otomatis digunakan untuk approval dokumen ISO & presensi rapat.
              </p>
            </div>
          </div>

          {/* Canvas Area */}
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-700 flex items-center gap-1.5">
                <span>🖌️</span> Silakan Tanda Tangan di Kotak Berikut:
              </span>
              
              {/* Ink Color Selector */}
              <div class="flex items-center gap-2">
                <span class="text-slate-400 text-[11px]">Warna Tinta:</span>
                <button
                  type="button"
                  onClick={() => { setStrokeColor('#1e3a8a'); if (ctx) ctx.strokeStyle = '#1e3a8a'; }}
                  class={`w-5 h-5 rounded-full bg-blue-900 border-2 transition ${strokeColor() === '#1e3a8a' ? 'border-amber-400 scale-110 shadow-sm' : 'border-white'}`}
                  title="Biru Dokumen (Standar)"
                />
                <button
                  type="button"
                  onClick={() => { setStrokeColor('#0f172a'); if (ctx) ctx.strokeStyle = '#0f172a'; }}
                  class={`w-5 h-5 rounded-full bg-slate-900 border-2 transition ${strokeColor() === '#0f172a' ? 'border-amber-400 scale-110 shadow-sm' : 'border-white'}`}
                  title="Hitam Resmi"
                />
                <button
                  type="button"
                  onClick={clearCanvas}
                  class="ml-2 px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                >
                  🗑️ Bersihkan
                </button>
              </div>
            </div>

            <div class="relative bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden touch-none hover:border-[#1877f2] transition">
              <canvas
                ref={canvasRef}
                class="w-full h-44 cursor-crosshair block"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <Show when={!hasDrawn()}>
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-slate-400 font-medium">
                  ✍️ Gunakan sentuhan jari, stylus, atau kursor mouse untuk menandatangani
                </div>
              </Show>
            </div>
          </div>

          {/* Legal / Policy Agreement */}
          <label class="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={agreed()}
              onChange={(e) => setAgreed(e.currentTarget.checked)}
              class="mt-0.5 w-4 h-4 rounded text-[#1877f2] focus:ring-[#1877f2]"
            />
            <span class="leading-snug">
              Saya menyatakan bahwa rekaman ini adalah <strong>tanda tangan digital sah saya</strong> untuk keperluan verifikasi operasional dan mutu ISO 21001:2018 di Yayasan Sinar Putih Edelweiss.
            </span>
          </label>

          {/* Actions */}
          <div class="flex items-center justify-between pt-2 border-t border-slate-100">
            <div class="text-[11px] text-slate-400 flex items-center gap-1">
              <span>🔒</span> Terenkripsi & Disimpan di Database
            </div>

            <div class="flex items-center gap-2">
              <Show when={props.canDismiss && props.onClose}>
                <button
                  type="button"
                  onClick={props.onClose}
                  class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Nanti Saja
                </button>
              </Show>

              <button
                type="button"
                disabled={!hasDrawn() || !agreed() || isSaving()}
                onClick={handleSave}
                class={`px-6 py-2.5 text-xs font-bold rounded-xl shadow transition flex items-center gap-2 ${
                  hasDrawn() && agreed() && !isSaving()
                    ? 'bg-[#1877f2] hover:bg-blue-600 text-white shadow-blue-500/25 hover:scale-[1.02]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Show when={isSaving()} fallback={<span>✓ Simpan & Aktifkan Tanda Tangan</span>}>
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan ke Database...</span>
                </Show>
              </button>
            </div>
          </div>

        </div>
      </div>
    </Show>
  );
}
