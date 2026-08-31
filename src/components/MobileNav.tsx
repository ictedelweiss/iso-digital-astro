import { For } from 'solid-js';
import type { NavTab } from '../lib/types';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export default function MobileNav(props: Props) {
  const tabs: Array<{ id: NavTab; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'purchase-requisition', label: 'PR', icon: '📝' },
    { id: 'leave-request', label: 'Cuti', icon: '🏖️' },
    { id: 'handover-form', label: 'ICT', icon: '📦' },
    { id: 'meeting-attendance', label: 'Rapat', icon: '👥' },
    { id: 'asset-management', label: 'Aset', icon: '🏷️' },
  ];

  return (
    <div class="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
      <For each={tabs}>
        {(tab) => (
          <button
            onClick={() => props.onSelectTab(tab.id)}
            class={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
              props.activeTab === tab.id ? 'text-[#1877f2] font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span class="text-base">{tab.icon}</span>
            <span class="text-[10px] mt-0.5">{tab.label}</span>
            {props.activeTab === tab.id && <span class="w-1.5 h-1.5 rounded-full bg-[#1877f2] mt-0.5"></span>}
          </button>
        )}
      </For>
    </div>
  );
}
