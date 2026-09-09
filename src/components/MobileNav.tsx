import { For } from 'solid-js';
import type { NavTab, PermissionMap } from '../lib/types';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  permissions?: PermissionMap | null;
  isSimulated?: boolean;
}

export default function MobileNav(props: Props) {
  const allTabs: Array<{ id: NavTab; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'purchase-requisition', label: 'PR', icon: '📝' },
    { id: 'leave-request', label: 'Cuti', icon: '🏖️' },
    { id: 'handover-form', label: 'ICT', icon: '📦' },
    { id: 'meeting-attendance', label: 'Rapat', icon: '👥' },
    { id: 'asset-management', label: 'Aset', icon: '🏷️' },
    { id: 'admin-access', label: 'Admin', icon: '⚙️' },
  ];

  const tabs = () => {
    if (!props.permissions) return allTabs;
    const filtered = allTabs.filter((tab) => {
      if (tab.id === 'dashboard') return true;
      return props.permissions?.[tab.id]?.view === true;
    });
    return filtered.length > 1 ? filtered : allTabs.filter(t => t.id !== 'admin-access');
  };

  const containerClass = () => {
    if (props.isSimulated) {
      return "w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg shrink-0";
    }
    return "lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg";
  };

  return (
    <div class={containerClass()}>
      <For each={tabs()}>
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
