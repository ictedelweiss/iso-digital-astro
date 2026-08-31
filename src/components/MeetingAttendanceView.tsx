import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import QRCode from 'qrcode';
import type { Meeting, Attendee, UserProfile, Department } from '../lib/types';
import { SAMPLE_SIGNATURE_1, SAMPLE_SIGNATURE_2, SAMPLE_SIGNATURE_3, OFFICIAL_DEPARTMENTS } from '../lib/dummyData';

interface Props {
  meetings: Meeting[];
  currentUser?: UserProfile;
  onOpenPdf: (meeting: Meeting) => void;
  onOpenSignatureModal: (title: string, onSave: (sig: string) => void) => void;
}

export default function MeetingAttendanceView(props: Props) {
  const [meetings, setMeetings] = createSignal<Meeting[]>(props.meetings);
  const [activeMeeting, setActiveMeeting] = createSignal<Meeting>(props.meetings[0]);
  const [qrDataUrl, setQrDataUrl] = createSignal('');
  const [showPublicSignModal, setShowPublicSignModal] = createSignal(false);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editMeetingId, setEditMeetingId] = createSignal<string | null>(null);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Create Meeting Form State
  const [newTitle, setNewTitle] = createSignal('');
  const [newDate, setNewDate] = createSignal('');
  const [newTime, setNewTime] = createSignal('');
  const [newLocation, setNewLocation] = createSignal('');
  const [newLeader, setNewLeader] = createSignal('');

  const openCreateModal = () => {
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewLocation('');
    setNewLeader(props.currentUser?.displayName || 'Admin');
    setIsEditMode(false);
    setEditMeetingId(null);
    setShowCreateModal(true);
  };

  const populateFormForEdit = (meeting: Meeting) => {
    setNewTitle(meeting.title);
    setNewDate(meeting.date);
    setNewTime(meeting.time);
    setNewLocation(meeting.location);
    setNewLeader(meeting.leader);
    setIsEditMode(true);
    setEditMeetingId(meeting.id);
    setShowCreateModal(true);
  };

  // Sign Form State (Simulates attendee on phone)
  const [attendeeName, setAttendeeName] = createSignal(props.currentUser?.displayName || '');
  const [attendeeDivision, setAttendeeDivision] = createSignal<Department>((props.currentUser?.department as Department) || 'SD');
  const [attendeeEmail, setAttendeeEmail] = createSignal(props.currentUser?.email || '');
  const [attendeeSig, setAttendeeSig] = createSignal(props.currentUser?.signature_data || SAMPLE_SIGNATURE_2);

  const fetchMeetings = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setMeetings(data.data);
          // If current active meeting is in the new list, update it to reflect new attendees
          const updatedActive = data.data.find((m: Meeting) => m.id === activeMeeting()?.id);
          if (updatedActive) {
            setActiveMeeting(updatedActive);
          } else {
            setActiveMeeting(data.data[0]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch meetings', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  onMount(async () => {
    // Initial Fetch
    await fetchMeetings();

    // Auto-refresh every 5 seconds for live attendees updates
    const interval = setInterval(fetchMeetings, 5000);
    onCleanup(() => clearInterval(interval));
  });

  // Auto-regenerate QR Code when active meeting changes
  createEffect(() => {
    const meeting = activeMeeting();
    if (meeting?.id) {
      const generateQr = async () => {
        try {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://iso.edelweiss.sch.id';
          const url = await QRCode.toDataURL(`${baseUrl}/meeting/${meeting.id}`, {
            width: 240,
            margin: 1.5,
            color: {
              dark: '#1e293b',
              light: '#ffffff',
            },
          });
          setQrDataUrl(url);
        } catch (err) {
          console.error('Failed to generate QR code', err);
        }
      };
      generateQr();
    }
  });

  const handleAddAttendee = async (e: Event) => {
    e.preventDefault();
    if (!attendeeName()) return;

    try {
      const res = await fetch(`/api/meetings/${activeMeeting().id}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: null,
          name: attendeeName(),
          division: attendeeDivision(),
          email: attendeeEmail() || `${attendeeName().toLowerCase().replace(/\s+/g, '.')}@edelweiss.sch.id`,
          signaturePath: attendeeSig(),
        })
      });

      if (res.ok) {
        await fetchMeetings(); // Refresh list to get new attendee
        setAttendeeName('');
        setShowPublicSignModal(false);
      } else {
        const data = await res.json();
        alert('Gagal mengirim kehadiran: ' + (data.message || data.error));
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi saat mengirim kehadiran.');
    }
  };

  const handleCopyLink = async () => {
    const meeting = activeMeeting();
    if (meeting?.id) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://iso.edelweiss.sch.id';
      const url = `${baseUrl}/meeting/${meeting.id}`;
      try {
        await navigator.clipboard.writeText(url);
        alert('Link absensi berhasil disalin!');
      } catch (err) {
        console.error('Gagal menyalin link', err);
        alert('Gagal menyalin link absensi.');
      }
    }
  };


  const handleCreateMeeting = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditMode() && editMeetingId()) {
        const res = await fetch(`/api/meetings/${editMeetingId()}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle(),
            date: newDate(),
            time: newTime(),
            location: newLocation(),
            leader: newLeader()
          })
        });
        if (res.ok) {
          await fetchMeetings();
          setShowCreateModal(false);
        } else {
          alert('Gagal mengupdate rapat.');
        }
      } else {
        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle(),
            date: newDate(),
            time: newTime(),
            location: newLocation(),
            leader: newLeader()
          })
        });
        
        if (res.ok) {
          await fetchMeetings(); // Refresh list to get new meeting
          setShowCreateModal(false);
        } else {
          alert('Gagal membuat rapat baru.');
        }
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus rapat ini beserta seluruh daftar hadirnya?')) return;
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchMeetings();
      } else {
        alert('Gagal menghapus rapat.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi saat menghapus.');
    }
  };

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-800">Daftar Hadir / Absensi Rapat</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 rounded-lg">
              YSPE-MGT-FM-007 Rev.01
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Presensi digital rapat berstandar ISO dengan scan QR di HP smartphone dan export daftar hadir resmi.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={openCreateModal}
            class="px-4 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
          >
            ➕ Buat Rapat Baru
          </button>
          <button
            onClick={() => props.onOpenPdf(activeMeeting())}
            class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
          >
            📄 <span>Lihat PDF ISO</span>
          </button>
        </div>
      </div>

      {/* Meeting Selection (Optional for quickly switching between active meetings) */}
      <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <For each={meetings()}>
          {(m) => (
            <button
              onClick={() => setActiveMeeting(m)}
              class={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition ${
                activeMeeting()?.id === m.id
                  ? 'bg-blue-50 border-[#1877f2] text-[#1877f2]'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {m.title}
            </button>
          )}
        </For>
      </div>

      {/* Main Grid: QR & Info on Left, Live Attendees Table on Right */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Meeting Info & Live QR (5 cols) */}
        <div class="lg:col-span-5 space-y-4">
          {/* Meeting Card */}
          <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-[#1877f2]">{activeMeeting()?.id}</span>
              <div class="flex items-center gap-2">
                <button
                  onClick={() => populateFormForEdit(activeMeeting())}
                  class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  title="Edit Rapat"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDeleteMeeting(activeMeeting().id)}
                  class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                  title="Hapus Rapat"
                >
                  🗑️
                </button>
                <Show when={isRefreshing()}>
                  <span class="text-[10px] text-slate-400 font-bold animate-pulse ml-2">Syncing...</span>
                </Show>
                <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  🔴 Rapat Berlangsung
                </span>
              </div>
            </div>

            <h2 class="text-base font-bold text-slate-800 leading-snug">{activeMeeting()?.title}</h2>

            <div class="space-y-1.5 text-xs text-slate-600">
              <div class="flex items-center gap-2">
                <span class="text-slate-400">📅 Tanggal:</span>
                <span class="font-semibold text-slate-800">{activeMeeting()?.date}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-slate-400">⏰ Waktu:</span>
                <span class="font-semibold text-slate-800">{activeMeeting()?.time}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-slate-400">📍 Lokasi:</span>
                <span class="font-semibold text-slate-800">{activeMeeting()?.location}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-slate-400">👑 Pimpinan:</span>
                <span class="font-semibold text-slate-800">{activeMeeting()?.leader}</span>
              </div>
            </div>

            {/* QR Code Presentation Box */}
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-3">
              <div class="text-xs font-bold text-slate-700">
                📲 Scan QR atau Bagikan Link Absensi
              </div>

              <div class="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                <Show when={qrDataUrl()}>
                  <img src={qrDataUrl()} alt="QR Absensi" class="w-44 h-44 rounded-lg" />
                </Show>
              </div>

              <div class="flex flex-col sm:flex-row w-full gap-2">
                <button
                  onClick={handleCopyLink}
                  class="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 border border-slate-300"
                >
                  🔗 Salin Link
                </button>
                <button
                  onClick={() => setShowPublicSignModal(true)}
                  class="flex-1 py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  📱 Simulasi HP
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Attendees Roster (7 cols) */}
        <div class="lg:col-span-7 space-y-3">
          <div class="flex items-center justify-between px-1">
            <div class="text-xs font-bold text-slate-700">
              Peserta Hadir ({activeMeeting()?.attendees?.length || 0})
            </div>
            <span class="text-[11px] font-mono text-emerald-600 font-semibold">16 Baris per Halaman Dokumen ISO</span>
          </div>

          <div class="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
            <div class="overflow-x-auto max-h-[560px]">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th class="p-3 text-center w-10">No</th>
                    <th class="p-3">Nama Lengkap</th>
                    <th class="p-3">Jabatan / Unit</th>
                    <th class="p-3 text-center w-28">TTD Digital</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  <For each={activeMeeting()?.attendees || []}>
                    {(att, idx) => (
                      <tr class="hover:bg-blue-50/40 transition">
                        <td class="p-3 text-center text-slate-400 font-bold">{idx() + 1}</td>
                        <td class="p-3 font-semibold text-slate-800">
                          <div>{att.name}</div>
                          <div class="text-[10px] text-slate-400 font-mono">{att.email}</div>
                        </td>
                        <td class="p-3 text-slate-600">{att.division}</td>
                        <td class="p-3 text-center">
                          <Show when={att.signature_path} fallback={<span class="text-slate-400">-</span>}>
                            <div class="bg-slate-50 border border-slate-200 p-1 rounded-lg inline-block shadow-sm">
                              <img src={att.signature_path} alt="TTD" class="h-6 max-w-[90px]" />
                            </div>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Simulasi Form HP Peserta */}
      <Show when={showPublicSignModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                📱 Presensi Rapat (Mobile Form)
              </h3>
              <button onClick={() => setShowPublicSignModal(false)} class="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleAddAttendee} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso, S.Kom"
                  value={attendeeName()}
                  onInput={(e) => setAttendeeName(e.currentTarget.value)}
                  required
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Departemen / Unit</label>
                <select
                  value={attendeeDivision()}
                  onChange={(e) => setAttendeeDivision(e.currentTarget.value as Department)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#1877f2]"
                >
                  <For each={OFFICIAL_DEPARTMENTS}>
                    {(dept) => <option value={dept}>{dept}</option>}
                  </For>
                </select>
              </div>

              {/* Signature Trigger & Auto-Applied Status */}
              <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Tanda Tangan Kehadiran</span>
                    {props.currentUser?.has_signature && (
                      <span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-bold">
                        ✓ Otomatis dari Profil
                      </span>
                    )}
                  </div>
                  <div class="text-[10px] text-slate-500">
                    {props.currentUser?.has_signature
                      ? 'Tanda tangan digital akun login Anda otomatis tersemat.'
                      : 'Sentuh layar smartphone untuk menandatangani.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => props.onOpenSignatureModal('Tanda Tangan Kehadiran Rapat', (sig) => setAttendeeSig(sig))}
                  class="px-3 py-1.5 bg-white border border-slate-200 text-[#1877f2] rounded-xl text-xs font-semibold shadow-sm hover:bg-slate-50 shrink-0"
                >
                  ✍️ {props.currentUser?.has_signature ? 'Ubah TTD' : 'Gambar TTD'}
                </button>
              </div>

              <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowPublicSignModal(false)} class="px-4 py-2 text-xs text-slate-500 hover:text-slate-800">Batal</button>
                <button type="submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow">
                  ✅ Kirim Kehadiran
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Modal Create Meeting */}
      <Show when={showCreateModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in-up">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                {isEditMode() ? '✏️ Edit Rapat' : '➕ Buat Rapat Baru'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} class="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateMeeting} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Judul / Agenda Rapat</label>
                <input
                  type="text"
                  placeholder="Contoh: Rapat Koordinasi Kurikulum"
                  value={newTitle()}
                  onInput={(e) => setNewTitle(e.currentTarget.value)}
                  required
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#1877f2]"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={newDate()}
                    onInput={(e) => setNewDate(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Waktu</label>
                  <input
                    type="time"
                    value={newTime()}
                    onInput={(e) => setNewTime(e.currentTarget.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#1877f2]"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Lokasi</label>
                <input
                  type="text"
                  placeholder="Contoh: Ruang Rapat Lt. 1"
                  value={newLocation()}
                  onInput={(e) => setNewLocation(e.currentTarget.value)}
                  required
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-[#1877f2]"
                />
              </div>

              <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateModal(false)} class="px-4 py-2 text-xs text-slate-500 hover:text-slate-800">Batal</button>
                <button type="submit" disabled={isSubmitting()} class={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow transition ${isSubmitting() ? 'bg-slate-400' : 'bg-[#1877f2] hover:bg-blue-600'}`}>
                  {isSubmitting() ? 'Memproses...' : (isEditMode() ? '✅ Update Rapat' : '✅ Simpan Rapat')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
