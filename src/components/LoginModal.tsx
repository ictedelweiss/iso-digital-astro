import { createSignal, For, Show } from 'solid-js';
import type { UserProfile } from '../lib/types';
import { MOCK_USERS, OFFICIAL_DEPARTMENTS } from '../lib/dummyData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal(props: Props) {
  const [selectedDept, setSelectedDept] = createSignal<string>('all');
  const [isRedirecting, setIsRedirecting] = createSignal(false);

  const handleMs365Login = () => {
    setIsRedirecting(true);
    // Redirect to Microsoft OAuth route, preserving current query params for deep links
    const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
    window.location.href = `/api/auth/ms-login?return_to=${encodeURIComponent(returnTo)}`;
  };

  const filteredUsers = () => {
    if (selectedDept() === 'all') return MOCK_USERS;
    return MOCK_USERS.filter((u) => u.department === selectedDept());
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-md animate-fadeIn">
        <div class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-5 animate-slideUp">
          
          {/* Header */}
          <div class="flex items-start justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20 shrink-0">
                <svg class="w-6 h-6" viewBox="0 0 23 23" fill="currentColor">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
              </div>
              <div>
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-[#1877f2] text-[11px] font-bold rounded-full mb-0.5">
                  <span>🏢</span> Microsoft 365 Single Sign-On
                </div>
                <h2 class="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  Login Portal ISO Digital
                </h2>
                <p class="text-xs text-slate-500">Yayasan Sinar Putih Edelweiss</p>
              </div>
            </div>

            <button
              onClick={props.onClose}
              class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              ✕
            </button>
          </div>

          {/* Primary MS 365 Button */}
          <div class="space-y-3">
            <button
              onClick={handleMs365Login}
              disabled={isRedirecting()}
              class="w-full py-3.5 px-5 bg-[#1877f2] hover:bg-blue-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3 transition transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <Show when={isRedirecting()} fallback={
                <>
                  <svg class="w-5 h-5" viewBox="0 0 23 23" fill="currentColor">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  <span>Masuk dengan Microsoft 365 (@edelweiss.sch.id)</span>
                </>
              }>
                <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mengarahkan ke Microsoft Login...</span>
              </Show>
            </button>

            <p class="text-[11px] text-center text-slate-500">
              Gunakan email resmi institusi Microsoft 365 Anda untuk otentikasi aman terintegrasi.
            </p>
          </div>

          {/* Footer Info */}
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-center gap-2">
            <span>🔒</span>
            <span>
              Portal terintegrasi penuh dengan <strong>Microsoft Azure Active Directory</strong>
            </span>
          </div>

        </div>
      </div>
    </Show>
  );
}
