import { createSignal, Show } from 'solid-js';

interface Props {
  isOpen: boolean;
  title: string;
  htmlContent: string;
  docCode: string;
  onClose: () => void;
}

export default function PdfPreviewModal(props: Props) {
  let iframeRef: HTMLIFrameElement | undefined;
  const [zoom, setZoom] = createSignal(100);

  const handlePrint = () => {
    if (!iframeRef || !iframeRef.contentWindow) return;
    iframeRef.contentWindow.focus();
    iframeRef.contentWindow.print();
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([props.htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.docCode.replace(/[\/\s]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
        <div class="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
          {/* Top Bar */}
          <div class="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 text-xs font-mono font-bold bg-blue-50 text-[#1877f2] border border-blue-200 rounded-lg">
                {props.docCode}
              </span>
              <div>
                <h3 class="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                  📄 Live Preview Dokumen ISO
                </h3>
                <p class="text-[11px] text-slate-500 truncate max-w-[200px] sm:max-w-md">
                  {props.title}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div class="flex items-center gap-2">
              {/* Zoom controls (hidden on small mobile) */}
              <div class="hidden sm:flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1 gap-1 text-xs text-slate-600 shadow-sm">
                <button 
                  onClick={() => setZoom(Math.max(50, zoom() - 10))}
                  class="px-2 py-0.5 hover:text-slate-900 font-bold"
                  title="Zoom Out"
                >
                  -
                </button>
                <span class="w-10 text-center font-mono font-bold">{zoom()}%</span>
                <button 
                  onClick={() => setZoom(Math.min(150, zoom() + 10))}
                  class="px-2 py-0.5 hover:text-slate-900 font-bold"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleDownloadHtml}
                class="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition"
                title="Download HTML"
              >
                💾 Unduh HTML
              </button>

              <button
                onClick={handlePrint}
                class="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition"
              >
                🖨️ <span class="hidden sm:inline">Cetak /</span> Ekspor PDF
              </button>

              <button
                onClick={props.onClose}
                class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Iframe Viewport Container */}
          <div class="flex-1 bg-slate-100 p-2 sm:p-6 overflow-auto flex justify-center items-start">
            <div 
              class="bg-white shadow-xl border border-slate-300 rounded-sm transition-transform duration-150 origin-top overflow-hidden"
              style={{
                width: '210mm',
                'min-height': '297mm',
                transform: `scale(${zoom() / 100})`,
              }}
            >
              {/*
                A `srcdoc` iframe inherits the parent's origin. Without
                `sandbox`, any script in the generated document — e.g. an
                injected signature payload — could read cookies and act as the
                user. The template needs no JavaScript, so `allow-scripts` is
                deliberately omitted: scripts simply cannot run.
                `allow-same-origin` is safe here and keeps print() working.
              */}
              <iframe
                ref={iframeRef}
                srcdoc={props.htmlContent}
                sandbox="allow-same-origin allow-modals"
                class="w-full h-[1100px] border-0 bg-white"
                title="ISO Document Preview"
              />
            </div>
          </div>

          {/* Bottom Info Banner */}
          <div class="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Format Standar ISO 21001:2018 Terverifikasi (Identik dengan format cetak fisik)</span>
            </div>
            <div class="text-[11px] font-mono text-slate-400 font-medium">
              Kertas: A4 (210 x 297 mm)
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
