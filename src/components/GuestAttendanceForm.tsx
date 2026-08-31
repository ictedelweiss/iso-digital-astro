import { createSignal, Show } from 'solid-js';
import SignaturePadModal from './SignaturePadModal';

export default function GuestAttendanceForm(props: { meetingId: string }) {
  const [name, setName] = createSignal('');
  const [division, setDivision] = createSignal('');
  const [signatureData, setSignatureData] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal<{ text: string, type: 'success' | 'error' } | null>(null);
  
  const [showSignModal, setShowSignModal] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!signatureData()) {
      setMessage({ text: 'Mohon isi tanda tangan Anda.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/meetings/${props.meetingId}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: null,
          name: name(),
          division: division(),
          email: '', // Optional for guest
          signaturePath: signatureData(),
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessage({ text: 'Berhasil mengisi daftar hadir tamu!', type: 'success' });
        setName('');
        setDivision('');
        setSignatureData('');
      } else {
        setMessage({ text: data.message || data.error, type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Gagal terhubung ke server.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="space-y-4">
      <Show when={message()}>
        <div class={`p-3 rounded-xl text-sm font-semibold ${
          message()?.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
        }`}>
          {message()?.text}
        </div>
      </Show>

      <Show when={message()?.type !== 'success'}>
        <form onSubmit={handleSubmit} class="space-y-4 text-left">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              placeholder="Contoh: Budi Santoso"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              required
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Instansi / Organisasi</label>
            <input
              type="text"
              placeholder="Contoh: Dinas Pendidikan / PT. XYZ"
              value={division()}
              onInput={(e) => setDivision(e.currentTarget.value)}
              required
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Tanda Tangan</label>
            <Show when={!signatureData()}>
              <button
                type="button"
                onClick={() => setShowSignModal(true)}
                class="w-full py-3 bg-slate-100 border border-slate-200 border-dashed rounded-xl text-sm text-slate-500 font-semibold hover:bg-slate-200 transition"
              >
                ✍️ Klik untuk Tanda Tangan
              </button>
            </Show>
            <Show when={signatureData()}>
              <div class="relative bg-white border border-slate-200 rounded-xl p-2 text-center group cursor-pointer" onClick={() => setShowSignModal(true)}>
                <img src={signatureData()} class="h-16 mx-auto" alt="Signature" />
                <div class="absolute inset-0 bg-slate-900/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <span class="text-white text-xs font-bold">Ubah TTD</span>
                </div>
              </div>
            </Show>
          </div>

          <button
            type="submit"
            disabled={isSubmitting()}
            class={`w-full py-3 text-white font-bold rounded-xl shadow transition ${
              isSubmitting() ? 'bg-slate-400' : 'bg-slate-800 hover:bg-slate-900'
            }`}
          >
            {isSubmitting() ? 'Memproses...' : 'Kirim Kehadiran Tamu'}
          </button>
        </form>
      </Show>

      <SignaturePadModal
        isOpen={showSignModal()}
        title="Tanda Tangan Kehadiran"
        onSave={(sig) => setSignatureData(sig)}
        onClose={() => setShowSignModal(false)}
      />
    </div>
  );
}
