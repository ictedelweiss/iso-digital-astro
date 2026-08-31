import { createSignal, Show } from 'solid-js';
import type { DeviceView, NavTab, UserProfile } from '../lib/types';

interface Props {
  currentTab: NavTab;
  deviceView: DeviceView;
  currentUser: UserProfile;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSelectDevice: (view: DeviceView) => void;
  onToggleMobileMenu: () => void;
  onOpenLoginModal: () => void;
  onOpenSignatureModal: () => void;
  onLogout?: () => void;
}

export default function Navbar(props: Props) {
  const [showProfileMenu, setShowProfileMenu] = createSignal(false);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header class="sticky top-0 z-30 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white shadow-xl shadow-blue-900/10 border-b border-white/10 animate-fade-in-up">
      {/* Top Main Navigation Bar */}
      <div class="px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Menu Trigger & Logo */}
        <div class="flex items-center gap-3 shrink-0">
          <button
            onClick={props.onToggleMobileMenu}
            class="lg:hidden p-2 text-white/90 hover:text-white rounded-xl hover:bg-white/10 transition"
            aria-label="Toggle menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-white to-blue-50 text-blue-700 flex items-center justify-center font-black text-sm shadow-[0_0_15px_rgba(255,255,255,0.4)] animate-float">
              ISO
            </div>
            <div class="hidden md:block">
              <div class="text-sm font-extrabold text-white leading-tight flex items-center gap-2">
                ISO Digital Portal
                <span class="px-2 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded-full border border-white/30">
                  Yayasan Sinar Putih Edelweiss
                </span>
              </div>
              <div class="text-[11px] text-blue-100 font-medium">Sistem Digitalisasi Dokumen & Alur Approval</div>
            </div>
          </div>
        </div>

        {/* Center: Darwinbox Prominent Search Bar */}
        <div class="flex-1 max-w-xl mx-2 sm:mx-4">
          <div class="relative w-full">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-300">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari permohonan PR, Cuti, Berita Acara, atau Nama Guru..."
              value={props.searchQuery || ''}
              onInput={(e) => props.onSearchChange && props.onSearchChange(e.currentTarget.value)}
              class="w-full pl-10 pr-4 py-2 bg-white text-slate-800 placeholder-slate-400 rounded-full text-xs sm:text-sm font-medium shadow-sm border border-transparent focus:border-white focus:ring-2 focus:ring-white/40 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Right: Device Mode Switcher & User Profile */}
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Device Simulator Bar */}
          <div class="hidden xl:flex items-center bg-white/15 p-1 rounded-full border border-white/20 text-xs font-semibold">
            <button
              onClick={() => props.onSelectDevice('responsive')}
              class={`px-2.5 py-1 rounded-full transition ${
                props.deviceView === 'responsive'
                  ? 'bg-white text-[#1877f2] shadow-sm font-bold'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
              title="Auto Responsif"
            >
              ⚡ Auto
            </button>
            <button
              onClick={() => props.onSelectDevice('desktop')}
              class={`px-2.5 py-1 rounded-full transition ${
                props.deviceView === 'desktop'
                  ? 'bg-white text-[#1877f2] shadow-sm font-bold'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
              title="Laptop"
            >
              💻 Laptop
            </button>
            <button
              onClick={() => props.onSelectDevice('tablet')}
              class={`px-2.5 py-1 rounded-full transition ${
                props.deviceView === 'tablet'
                  ? 'bg-white text-[#1877f2] shadow-sm font-bold'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
              title="Tablet"
            >
              📟 Tablet
            </button>
            <button
              onClick={() => props.onSelectDevice('mobile')}
              class={`px-2.5 py-1 rounded-full transition ${
                props.deviceView === 'mobile'
                  ? 'bg-emerald-400 text-slate-900 font-bold shadow-sm'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
              title="Mode HP Smartphone"
            >
              📱 HP View
            </button>
          </div>

          {/* Quick Signature Status Badge */}
          <button
            onClick={props.onOpenSignatureModal}
            class={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${
              props.currentUser.has_signature
                ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/30 hover:bg-emerald-500/30'
                : 'bg-amber-400 text-slate-900 font-black animate-pulse hover:bg-amber-300 shadow-amber-400/30'
            }`}
            title={props.currentUser.has_signature ? 'Tanda Tangan Digital Terverifikasi' : 'Klik untuk rekam tanda tangan pertama kali'}
          >
            <span>{props.currentUser.has_signature ? '✓' : '⚠️'}</span>
            <span>{props.currentUser.has_signature ? 'TTD Siap' : 'Rekam TTD'}</span>
          </button>

          {/* User Profile Pill */}
          <div class="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu())}
              class="flex items-center gap-2 p-1 bg-white/15 hover:bg-white/25 border border-white/20 rounded-full transition text-left"
            >
              <div class="w-8 h-8 rounded-full bg-white text-[#1877f2] font-black text-xs flex items-center justify-center shadow-sm">
                {getInitials(props.currentUser.displayName)}
              </div>
              <div class="hidden sm:block text-xs pr-2">
                <div class="font-bold text-white leading-tight">{props.currentUser.displayName}</div>
                <div class="text-[10px] text-blue-100">{props.currentUser.department}</div>
              </div>
              <svg class="w-4 h-4 text-white/80 hidden sm:block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <Show when={showProfileMenu()}>
              <div class="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-3xl p-4 shadow-2xl z-50 animate-fadeIn text-slate-800 space-y-3">
                {/* User Card */}
                <div class="pb-3 border-b border-slate-100 flex items-center gap-3">
                  <div class="w-11 h-11 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md">
                    {getInitials(props.currentUser.displayName)}
                  </div>
                  <div>
                    <div class="font-bold text-xs text-slate-900 leading-snug">{props.currentUser.displayName}</div>
                    <div class="text-slate-500 text-[11px] font-mono">{props.currentUser.email}</div>
                    <div class="mt-1 inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-[#1877f2] rounded-md border border-blue-200">
                      {props.currentUser.department} • {props.currentUser.jobTitle}
                    </div>
                  </div>
                </div>

                {/* Signature Status Card */}
                <div class={`p-3 rounded-2xl border ${
                  props.currentUser.has_signature 
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <div class="flex items-center justify-between text-xs font-bold mb-1">
                    <span>✍️ Status Tanda Tangan:</span>
                    <span>{props.currentUser.has_signature ? 'Aktif' : 'Belum Ada'}</span>
                  </div>
                  <p class="text-[11px] leading-tight text-slate-600 mb-2">
                    {props.currentUser.has_signature
                      ? 'Tanda tangan digital Anda tersimpan aman dan otomatis tersemat saat approval.'
                      : 'Anda belum merekam tanda tangan digital untuk keperluan approval & presensi.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      props.onOpenSignatureModal();
                    }}
                    class="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm transition"
                  >
                    {props.currentUser.has_signature ? '🖌️ Ubah Tanda Tangan' : '✍️ Rekam Tanda Tangan Sekarang'}
                  </button>
                </div>

                {/* Actions Menu */}
                <div class="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      props.onOpenLoginModal();
                    }}
                    class="w-full py-2 px-3 text-xs font-bold text-[#1877f2] hover:bg-blue-50 rounded-xl transition flex items-center justify-between"
                  >
                    <span class="flex items-center gap-2">
                      <span>🔄</span> Ganti Akun / Login MS 365
                    </span>
                    <span>→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (props.onLogout) props.onLogout();
                      else props.onOpenLoginModal();
                    }}
                    class="w-full py-2 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center justify-between"
                  >
                    <span class="flex items-center gap-2">
                      <span>🚪</span> Logout Sesi
                    </span>
                    <span>✕</span>
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </header>
  );
}
