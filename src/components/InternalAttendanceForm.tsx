import { createSignal, Show } from 'solid-js';
import SignaturePadModal from './SignaturePadModal';

interface Props {
  meetingId: string;
  user: {
    displayName: string;
    department: string;
    jobTitle: string;
    hasSignature: boolean;
  };
  initialAttended?: boolean;
}

export default function InternalAttendanceForm(props: Props) {
  const [hasSignature, setHasSignature] = createSignal(props.user.hasSignature);
  const [showSignModal, setShowSignModal] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [attended, setAttended] = createSignal(props.initialAttended || false);
  const [message, setMessage] = createSignal<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    props.initialAttended
      ? { text: 'Anda sudah mengisi daftar hadir untuk rapat ini.', type: 'info' }
      : null
  );

  const handleAttend = async () => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      // Backend automatically retrieves signature from database for authenticated session
      const res = await fetch(`/api/meetings/${props.meetingId}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (res.ok) {
        setAttended(true);
        setMessage({ text: 'Berhasil mengisi daftar hadir!', type: 'success' });
      } else if (res.status === 409) {
        setAttended(true);
        setMessage({ text: data.message || 'Anda sudah mengisi daftar hadir untuk rapat ini.', type: 'info' });
      } else if (data.error === 'SIGNATURE_REQUIRED') {
        setHasSignature(false);
        setMessage({
          text: 'Tanda tangan digital Anda belum terdaftar. Silakan rekam tanda tangan di bawah.',
          type: 'error',
        });
      } else {
        setMessage({ text: data.message || data.error || 'Gagal mengisi absensi.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Terjadi kesalahan koneksi ke server.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSignatureAndAttend = async (sigData: string) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      // 1. Save signature to user profile
      const saveRes = await fetch('/api/user/save-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: sigData }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        setMessage({
          text: 'Gagal menyimpan tanda tangan: ' + (err.message || err.error || 'Server error'),
          type: 'error',
        });
        setIsSubmitting(false);
        return;
      }

      setHasSignature(true);

      // 2. Submit attendance with newly recorded signature
      const attendRes = await fetch(`/api/meetings/${props.meetingId}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signaturePath: sigData }),
      });

      const attendData = await attendRes.json();

      if (attendRes.ok) {
        setAttended(true);
        setMessage({
          text: '✓ Tanda tangan digital berhasil disimpan & kehadiran Anda telah tercatat!',
          type: 'success',
        });
      } else if (attendRes.status === 409) {
        setAttended(true);
        setMessage({
          text: '✓ Tanda tangan tersimpan. Anda sudah mengisi daftar hadir untuk rapat ini.',
          type: 'info',
        });
      } else {
        setMessage({
          text: 'Tanda tangan berhasil disimpan, namun absensi gagal: ' + (attendData.message || attendData.error),
          type: 'error',
        });
      }
    } catch {
      setMessage({ text: 'Terjadi kesalahan saat memproses data.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="space-y-4">
      <div class="p-5 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-center shadow-sm">
        <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
          👤
        </div>
        <h2 class="font-bold text-slate-800 text-lg">{props.user.displayName}</h2>
        <p class="text-xs text-slate-500 mb-4">
          {props.user.department} &bull; {props.user.jobTitle}
        </p>

        <Show when={attended()}>
          <div class="p-3 bg-emerald-100/80 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-800 flex items-center justify-center gap-2">
            <span>✅</span> Kehadiran Telah Dikonfirmasi
          </div>
        </Show>

        <Show when={!attended()}>
          <Show
            when={hasSignature()}
            fallback={
              <div class="space-y-3">
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
                  <div class="flex items-center gap-2 text-amber-800 text-xs font-bold mb-1">
                    <span>⚠️</span> Tanda Tangan Belum Ada
                  </div>
                  <p class="text-[11px] text-amber-700 leading-snug">
                    Akun Anda belum memiliki tanda tangan digital tersimpan. Buat tanda tangan sekali untuk absensi ini dan dokumen ISO selanjutnya.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSignModal(true)}
                  disabled={isSubmitting()}
                  class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <span>✍️</span> Rekam Tanda Tangan & Hadir
                </button>
              </div>
            }
          >
            <div class="space-y-2">
              <button
                type="button"
                onClick={handleAttend}
                disabled={isSubmitting()}
                class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition transform hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
              >
                {isSubmitting() ? 'Memproses Kehadiran...' : 'Konfirmasi Kehadiran'}
              </button>

              <div class="flex items-center justify-center gap-2 pt-1">
                <span class="text-[11px] text-slate-400">Tanda tangan siap disematkan &bull;</span>
                <button
                  type="button"
                  onClick={() => setShowSignModal(true)}
                  class="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>🖌️</span> Ubah Tanda Tangan
                </button>
              </div>
            </div>
          </Show>
        </Show>
      </div>

      <Show when={message()}>
        <div
          class={`p-3 rounded-xl text-sm font-semibold text-center transition animate-fadeIn ${
            message()?.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : message()?.type === 'info'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-rose-100 text-rose-800 border border-rose-200'
          }`}
        >
          {message()?.text}
        </div>
      </Show>

      {/* Signature Pad Modal for internal user */}
      <SignaturePadModal
        isOpen={showSignModal()}
        title="Rekam Tanda Tangan Digital Resmi"
        onSave={handleSaveSignatureAndAttend}
        onClose={() => setShowSignModal(false)}
      />
    </div>
  );
}
