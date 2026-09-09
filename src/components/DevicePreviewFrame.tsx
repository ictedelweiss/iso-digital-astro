import { type JSX, Show } from 'solid-js';
import type { DeviceView } from '../lib/types';

interface Props {
  deviceView: DeviceView;
  onSelectDevice: (view: DeviceView) => void;
  children: JSX.Element;
  bottomNav?: JSX.Element;
}

export default function DevicePreviewFrame(props: Props) {
  return (
    <div class="flex-1 w-full flex flex-col items-center">
      <Show
        when={props.deviceView !== 'responsive'}
        fallback={
          <div class="w-full flex-1 flex flex-col">
            {props.children}
          </div>
        }
      >
        <div class="w-full py-4 px-2 flex flex-col items-center justify-start min-h-screen bg-slate-200/70">
          {/* Device Frame Header */}
          <div class="mb-3 flex items-center gap-3 px-4 py-1.5 bg-white border border-slate-300 rounded-full text-xs text-slate-700 shadow-sm">
            <span>
              {props.deviceView === 'mobile' && '📱 Mode HP Smartphone (390 x 844 px)'}
              {props.deviceView === 'tablet' && '📟 Mode Tablet / iPad (768 x 1024 px)'}
              {props.deviceView === 'desktop' && '💻 Mode Laptop / Desktop (1280 x 800 px)'}
            </span>
            <button
              onClick={() => props.onSelectDevice('responsive')}
              class="text-[#1877f2] hover:underline font-bold ml-2 text-[11px]"
            >
              Kembali ke Layar Penuh
            </button>
          </div>

          {/* Simulated Hardware Frame */}
          <div
            class={`transition-all duration-300 ease-out bg-white border-4 border-slate-700 shadow-2xl overflow-hidden flex flex-col ${
              props.deviceView === 'mobile'
                ? 'w-[390px] min-h-[844px] rounded-[48px] ring-12 ring-slate-800 shadow-2xl relative'
                : props.deviceView === 'tablet'
                ? 'w-[768px] min-h-[900px] rounded-[32px] ring-8 ring-slate-700'
                : 'w-full max-w-[1280px] min-h-[750px] rounded-2xl ring-4 ring-slate-700'
            }`}
          >
            {/* Mobile Notch / Dynamic Island */}
            {props.deviceView === 'mobile' && (
              <div class="w-full h-7 bg-slate-900 flex items-center justify-between px-6 shrink-0 select-none text-[10px] text-white">
                <span>09:41</span>
                <div class="w-20 h-4 bg-black rounded-full mx-auto"></div>
                <div class="flex items-center gap-1">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Inner Content Area */}
            <div class="flex-1 w-full bg-[#f0f4f9] overflow-y-auto pb-14 lg:pb-0">
              {props.children}
            </div>

            {/* Simulated Mobile Bottom Nav */}
            {props.deviceView === 'mobile' && props.bottomNav}

            {/* Mobile Home Bar */}
            {props.deviceView === 'mobile' && (
              <div class="w-full h-4 bg-slate-900 flex items-center justify-center shrink-0">
                <div class="w-32 h-1 bg-slate-400 rounded-full"></div>
              </div>
            )}
          </div>
        </div>
      </Show>
    </div>
  );
}
