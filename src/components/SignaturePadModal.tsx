import { createSignal, onMount, onCleanup, Show, createEffect } from 'solid-js';
import SignaturePad from 'signature_pad';

interface Props {
  isOpen: boolean;
  title: string;
  onSave: (base64Signature: string) => void;
  onClose: () => void;
}

export default function SignaturePadModal(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined;
  let padInstance: SignaturePad | null = null;
  const [isEmpty, setIsEmpty] = createSignal(true);

  const initPad = () => {
    if (!canvasRef) return;
    const ratio = Math.max(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1);
    canvasRef.width = canvasRef.offsetWidth * ratio;
    canvasRef.height = canvasRef.offsetHeight * ratio;
    canvasRef.getContext('2d')?.scale(ratio, ratio);

    padInstance = new SignaturePad(canvasRef, {
      minWidth: 1.5,
      maxWidth: 3.5,
      penColor: '#0f172a',
      backgroundColor: 'rgba(255, 255, 255, 0)',
    });

    padInstance.addEventListener('beginStroke', () => setIsEmpty(false));
  };

  createEffect(() => {
    if (props.isOpen) {
      setTimeout(initPad, 100);
    }
  });

  const handleClear = () => {
    if (padInstance) {
      padInstance.clear();
      setIsEmpty(true);
    }
  };

  const handleSave = () => {
    if (padInstance && !padInstance.isEmpty()) {
      const dataUrl = padInstance.toDataURL('image/png');
      props.onSave(dataUrl);
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
        <div class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col animate-scale-in">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                ✍️ {props.title}
              </h3>
              <p class="text-xs text-slate-500">Gunakan jari di layar sentuh (HP) atau mouse (Laptop)</p>
            </div>
            <button 
              onClick={props.onClose}
              class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              ✕
            </button>
          </div>

          <div class="my-4">
            <div class="bg-slate-50 rounded-2xl p-2 border-2 border-dashed border-slate-300 relative overflow-hidden shadow-inner">
              <canvas 
                ref={canvasRef} 
                class="w-full h-44 cursor-crosshair touch-none bg-white rounded-xl shadow-sm"
              />
              <div class="absolute bottom-3 right-4 pointer-events-none text-[10px] text-slate-400 font-mono">
                AREA TANDA TANGAN DIGITAL
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              onClick={handleClear}
              class="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              🔄 Bersihkan
            </button>
            <div class="flex gap-2">
              <button
                onClick={props.onClose}
                class="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={isEmpty()}
                class={`px-5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
                  isEmpty() 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                    : 'bg-[#1877f2] hover:bg-blue-600 text-white shadow'
                }`}
              >
                ✅ Simpan TTD
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
