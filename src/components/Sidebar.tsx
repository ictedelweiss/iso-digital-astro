import { For, Show } from 'solid-js';
import type { NavTab, PermissionMap } from '../lib/types';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  permissions?: PermissionMap | null;
  badgeCounts: {
    pr: number;
    leave: number;
    handover: number;
    meetings: number;
    assets: number;
  };
}

export default function Sidebar(props: Props) {
  const allItems = () => [
    { id: 'dashboard', label: 'Dashboard / My Access', icon: '🏠' },
    { id: 'purchase-requisition', label: 'Purchase Requisition', icon: '📝', badge: props.badgeCounts.pr },
    { id: 'leave-request', label: 'Permohonan Cuti', icon: '🏖️', badge: props.badgeCounts.leave },
    { id: 'handover-form', label: 'Serah Terima ICT', icon: '📦', badge: props.badgeCounts.handover },
    { id: 'meeting-attendance', label: 'Absensi Rapat', icon: '👥', badge: props.badgeCounts.meetings },
    { id: 'asset-management', label: 'Manajemen Aset', icon: '🏷️', badge: props.badgeCounts.assets },
    { id: 'admin-access', label: 'Admin & Hak Akses', icon: '⚙️' },
  ] as Array<{ id: NavTab; label: string; icon: string; badge?: number }>;

  const menuItems = () => {
    const list = allItems();
    if (!props.permissions) return list;
    const filtered = list.filter((item) => {
      if (item.id === 'dashboard') return true;
      return props.permissions?.[item.id]?.view === true;
    });
    // Safety: if filter results in only dashboard or empty due to DB unmigrated, show standard items
    return filtered.length > 1 ? filtered : list.filter(item => item.id !== 'admin-access');
  };

  const handleSelect = (tab: NavTab) => {
    props.onSelectTab(tab);
    props.onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {props.isOpenMobile && (
        <div 
          onClick={props.onCloseMobile}
          class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden animate-fadeIn"
        />
      )}

      {/* Sidebar Container */}
      <aside
        class={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out shadow-sm ${
          props.isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header in Drawer */}
        <div class="lg:hidden p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-[#1877f2] flex items-center justify-center font-bold text-white text-xs">
              ISO
            </div>
            <span class="font-bold text-slate-800 text-sm">ISO Digital Menu</span>
          </div>
          <button
            onClick={props.onCloseMobile}
            class="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* System Info Banner */}
        <div class="p-4 hidden lg:block">
          <div class="p-4 rounded-3xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 shadow-sm relative overflow-hidden group">
            <div class="absolute -right-6 -top-6 w-20 h-20 bg-blue-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
            <div class="text-[10px] font-black text-[#1877f2] uppercase tracking-wider relative z-10 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ISO 21001:2018
            </div>
            <div class="text-xs font-bold text-slate-900 mt-1 relative z-10">
              Edelweiss Digital Hub
            </div>
            <div class="text-[10px] font-semibold text-slate-500 mt-1 relative z-10">
              Portal Guru & Karyawan
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav class="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div class="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Menu Utama
          </div>

          <For each={menuItems()}>
            {(item) => (
              <button
                onClick={() => handleSelect(item.id)}
                class={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-300 relative group overflow-hidden ${
                  props.activeTab === item.id
                    ? 'text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-[#1877f2]'
                }`}
              >
                {/* Active Indicator Background Animation */}
                <Show when={props.activeTab === item.id}>
                  <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl -z-10 animate-fade-in-up"></div>
                </Show>
                <div class="flex items-center gap-3">
                  <span class="text-base group-hover:scale-110 transition-transform">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      props.activeTab === item.id
                        ? 'bg-[#1877f2] text-white'
                        : 'bg-rose-100 text-rose-600 group-hover:bg-rose-500 group-hover:text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )}
          </For>
        </nav>

        {/* Sidebar Footer */}
        <div class="p-3 border-t border-slate-100 bg-slate-50/70">
          <div class="flex items-center justify-between text-[11px] text-slate-500 px-2 py-1">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              Cloudflare Ready
            </span>
            <span class="font-mono text-[10px] text-slate-400">Astro SSR</span>
          </div>
        </div>
      </aside>
    </>
  );
}
