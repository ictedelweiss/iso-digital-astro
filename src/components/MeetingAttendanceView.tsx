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
  const [activeMeeting, setActiveMeeting] = createSignal<Meeting | null>(props.meetings[0] || null);
  const [qrDataUrl, setQrDataUrl] = createSignal('');
  const [showPublicSignModal, setShowPublicSignModal] = createSignal(false);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [editMeetingId, setEditMeetingId] = createSignal<string | null>(null);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [showQrFullscreen, setShowQrFullscreen] = createSignal(false);

  // Search, Filter & Sort State for Meetings
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filterPeriod, setFilterPeriod] = createSignal<'all' | 'weekly' | 'monthly'>('all');
  const [sortBy, setSortBy] = createSignal<'newest' | 'oldest' | 'attendees' | 'title'>('newest');

  // Filtered & Sorted Meetings list
  const filteredMeetings = () => {
    let list = [...meetings()];

    // Filter by text search (title, id, location, leader)
    const q = searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          (m.location && m.location.toLowerCase().includes(q)) ||
          (m.leader && m.leader.toLowerCase().includes(q))
      );
    }

    // Filter by period (weekly, monthly)
    const period = filterPeriod();
    if (period !== 'all') {
      const now = new Date();
      list = list.filter((m) => {
        const mDate = new Date(m.date);
        if (isNaN(mDate.getTime())) return true;
        if (period === 'weekly') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          return mDate >= sevenDaysAgo && mDate <= now;
        }
        if (period === 'monthly') {
          return mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    // Sort
    const sort = sortBy();
    list.sort((a, b) => {
      if (sort === 'newest') {
        const dateA = new Date(`${a.date} ${a.time || '00:00'}`).getTime() || 0;
        const dateB = new Date(`${b.date} ${b.time || '00:00'}`).getTime() || 0;
        return dateB - dateA;
      }
      if (sort === 'oldest') {
        const dateA = new Date(`${a.date} ${a.time || '00:00'}`).getTime() || 0;
        const dateB = new Date(`${b.date} ${b.time || '00:00'}`).getTime() || 0;
        return dateA - dateB;
      }
      if (sort === 'attendees') {
        return (b.attendees?.length || 0) - (a.attendees?.length || 0);
      }
      if (sort === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return list;
  };

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
          } else if (!activeMeeting()) {
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

    // Escape key closes fullscreen modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showQrFullscreen()) {
        setShowQrFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    onCleanup(() => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    });
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
          <Show when={activeMeeting()}>
            <button
              onClick={() => props.onOpenPdf(activeMeeting()!)}
              class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              📄 <span>Lihat PDF ISO</span>
            </button>
          </Show>
        </div>
      </div>

      {/* Filter, Search & Sort Control Bar */}
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Cari judul rapat, ID rapat, lokasi, atau pimpinan..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] transition"
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery('')}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </Show>
        </div>

        {/* Filter & Sort Controls */}
        <div class="flex items-center gap-2 flex-wrap">
          {/* Period Filter */}
          <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {[
              { key: 'all', label: 'Semua Waktu' },
              { key: 'weekly', label: '7 Hari Ini' },
              { key: 'monthly', label: 'Bulan Ini' },
            ].map((p) => (
              <button
                type="button"
                onClick={() => setFilterPeriod(p.key as any)}
                class={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterPeriod() === p.key
                    ? 'bg-white text-[#1877f2] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span class="text-slate-400 text-xs">Urutkan:</span>
            <select
              value={sortBy()}
              onChange={(e) => setSortBy(e.currentTarget.value as any)}
              class="bg-transparent border-0 text-slate-700 font-semibold focus:ring-0 text-xs cursor-pointer pr-2"
            >
              <option value="newest">📅 Terbaru (Tanggal)</option>
              <option value="oldest">⏳ Terlama</option>
              <option value="attendees">👥 Peserta Terbanyak</option>
              <option value="title">🔤 Judul (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Column Layout (Meeting List on Left, Live Detail & Attendees on Right) */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Meeting List (5 cols on desktop) */}
        <div class="lg:col-span-5 space-y-3">
          <div class="flex items-center justify-between px-1">
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daftar Rapat ({filteredMeetings().length})
            </div>
            <Show when={isRefreshing()}>
              <span class="text-[10px] text-blue-500 font-bold animate-pulse">Syncing...</span>
            </Show>
          </div>

          <Show
            when={filteredMeetings().length > 0}
            fallback={
              <div class="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
                <div class="text-3xl">👥</div>
                <h3 class="text-sm font-bold text-slate-700">Rapat tidak ditemukan</h3>
                <p class="text-xs text-slate-500">
                  {searchQuery()
                    ? `Tidak ada rapat yang sesuai dengan pencarian "${searchQuery()}".`
                    : 'Belum ada data rapat yang tersimpan.'}
                </p>
                <Show when={searchQuery()}>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterPeriod('all');
                    }}
                    class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    Reset Filter
                  </button>
                </Show>
              </div>
            }
          >
            <div class="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              <For each={filteredMeetings()}>
                {(m) => {
                  const isSelected = activeMeeting()?.id === m.id;
                  const attendeeCount = m.attendees?.length || 0;

                  return (
                    <div
                      onClick={() => setActiveMeeting(m)}
                      class={`p-4 rounded-2xl border cursor-pointer transition flex flex-col gap-2 relative ${
                        isSelected
                          ? 'bg-blue-50/80 border-[#1877f2] shadow-sm ring-2 ring-[#1877f2]'
                          : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'
                      }`}
                    >
                      {/* Top Row: Meeting ID & Date */}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                          <span class="px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-50 text-[#1877f2] border border-sky-200 rounded-md">
                            {m.id}
                          </span>
                          <span class="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <span>📅</span> {m.date}
                          </span>
                        </div>
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span>👥</span> {attendeeCount} Hadir
                        </span>
                      </div>

                      {/* Title */}
                      <h3 class={`text-sm font-bold line-clamp-2 leading-snug ${
                        isSelected ? 'text-[#1877f2]' : 'text-slate-800'
                      }`}>
                        {m.title}
                      </h3>

                      {/* Meta: Time, Location, Leader */}
                      <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100/80">
                        <div class="flex items-center gap-2 truncate">
                          <span class="truncate">⏰ {m.time}</span>
                          <span class="truncate max-w-[120px]">📍 {m.location}</span>
                        </div>
                        <span class="text-slate-600 font-medium truncate max-w-[130px]">
                          👑 {m.leader}
                        </span>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* Right Column: Active Meeting Detail, Live QR & Attendees Roster (7 cols on desktop) */}
        <div class="lg:col-span-7 space-y-4">
          <Show
            when={activeMeeting()}
            fallback={
              <div class="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
                <div class="text-4xl">👥</div>
                <h3 class="text-base font-bold text-slate-700">Pilih Rapat</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto">
                  Silakan pilih salah satu agenda rapat dari daftar di sebelah kiri untuk melihat detail, membagikan QR absensi, dan melihat presensi peserta.
                </p>
              </div>
            }
          >
            {/* Active Meeting Info Card */}
            <div class="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-0.5 text-xs font-mono font-bold text-[#1877f2] bg-blue-50 border border-blue-200 rounded-lg">
                      {activeMeeting()!.id}
                    </span>
                    <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                      🔴 Rapat Berlangsung
                    </span>
                  </div>
                  <h2 class="text-base sm:text-lg font-extrabold text-slate-800 mt-1.5 leading-snug">
                    {activeMeeting()!.title}
                  </h2>
                </div>

                <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => setShowQrFullscreen(true)}
                    class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 animate-pulse"
                    title="Tampilkan QR Code Layar Penuh (Proyektor / TV Rapat)"
                  >
                    <span>📺</span> Layar Penuh QR
                  </button>
                  <button
                    onClick={() => populateFormForEdit(activeMeeting()!)}
                    class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                    title="Edit Rapat"
                  >
                    <span>✏️</span> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMeeting(activeMeeting()!.id)}
                    class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                    title="Hapus Rapat"
                  >
                    <span>🗑️</span> Hapus
                  </button>
                  <button
                    onClick={() => props.onOpenPdf(activeMeeting()!)}
                    class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                  >
                    <span>📄</span> PDF
                  </button>
                </div>
              </div>

              {/* Meeting Meta Details Grid */}
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Tanggal</span>
                  <span class="font-bold text-slate-800">{activeMeeting()!.date}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Waktu</span>
                  <span class="font-bold text-slate-800">{activeMeeting()!.time}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Lokasi</span>
                  <span class="font-bold text-slate-800 truncate block">{activeMeeting()!.location}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Pimpinan</span>
                  <span class="font-bold text-slate-800 truncate block">{activeMeeting()!.leader}</span>
                </div>
              </div>

              {/* QR Code Presentation Box & Quick Share */}
              <div class="bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-5">
                <div class="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-200 shrink-0 relative group cursor-pointer" onClick={() => setShowQrFullscreen(true)}>
                  <Show when={qrDataUrl()}>
                    <img src={qrDataUrl()} alt="QR Absensi" class="w-36 h-36 rounded-lg group-hover:opacity-90 transition" />
                  </Show>
                  <div class="absolute inset-0 bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-[11px] font-bold gap-1">
                    <span>🔍 Perbesar</span>
                    <span class="text-[9px] font-normal text-slate-200">Klik untuk Full Screen</span>
                  </div>
                </div>

                <div class="space-y-3 flex-1 text-center sm:text-left">
                  <div>
                    <h4 class="text-xs font-bold text-slate-800">📲 Scan QR Presensi Kehadiran</h4>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      Peserta rapat cukup scan QR code ini dengan kamera smartphone untuk mengisi daftar hadir dan tanda tangan digital.
                    </p>
                  </div>

                  <div class="flex flex-col sm:flex-row gap-2 flex-wrap">
                    <button
                      onClick={() => setShowQrFullscreen(true)}
                      class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
                    >
                      📺 Tampilkan di Layar TV / Proyektor
                    </button>
                    <button
                      onClick={handleCopyLink}
                      class="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 border border-slate-200"
                    >
                      🔗 Salin Link
                    </button>
                    <button
                      onClick={() => setShowPublicSignModal(true)}
                      class="px-3.5 py-2 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
                    >
                      📱 Buka Form Input
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Attendees Roster Section */}
              <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between px-1">
                  <div class="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span>Peserta Hadir</span>
                    <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      {activeMeeting()!.attendees?.length || 0} Orang
                    </span>
                  </div>
                  <span class="text-[11px] font-mono text-slate-400">Format Resmi YSPE-MGT-FM-007</span>
                </div>

                <div class="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                  <div class="overflow-x-auto max-h-[380px]">
                    <table class="w-full text-xs text-left">
                      <thead class="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200 font-bold">
                        <tr>
                          <th class="p-3 text-center w-10">No</th>
                          <th class="p-3">Nama Lengkap</th>
                          <th class="p-3">Jabatan / Unit</th>
                          <th class="p-3 text-center w-28">TTD Digital</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 bg-white">
                        <Show
                          when={(activeMeeting()!.attendees || []).length > 0}
                          fallback={
                            <tr>
                              <td colspan="4" class="p-6 text-center text-xs text-slate-400">
                                Belum ada peserta yang mengisi kehadiran rapat ini.
                              </td>
                            </tr>
                          }
                        >
                          <For each={activeMeeting()!.attendees || []}>
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
                                    <div class="bg-slate-50 border border-slate-200 p-1 rounded-lg inline-block shadow-xs">
                                      <img src={att.signature_path} alt="TTD" class="h-6 max-w-[90px]" />
                                    </div>
                                  </Show>
                                </td>
                              </tr>
                            )}
                          </For>
                        </Show>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Show>
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

      {/* Modal QR Code Fullscreen untuk Layar Proyektor / TV Rapat */}
      <Show when={showQrFullscreen() && activeMeeting()}>
        <div class="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8 lg:p-12 animate-fadeIn text-white">
          {/* Header Fullscreen */}
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xl">
                📺
              </span>
              <div>
                <span class="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
                  PRESENSI RAPAT RESMI • {activeMeeting()!.id}
                </span>
                <p class="text-sm text-slate-400">Scan QR Code dengan kamera smartphone untuk mengisi daftar hadir</p>
              </div>
            </div>

            <button
              onClick={() => setShowQrFullscreen(false)}
              class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 border border-slate-700"
            >
              <span>✕</span> Tutup Layar Penuh (ESC)
            </button>
          </div>

          {/* Main Fullscreen Body: Huge QR + Rich Meeting Info */}
          <div class="my-auto py-6 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 max-w-6xl mx-auto w-full">
            {/* Big QR Display */}
            <div class="flex flex-col items-center text-center space-y-4">
              <div class="p-6 bg-white rounded-3xl shadow-2xl border-4 border-indigo-500/30 ring-8 ring-indigo-500/10">
                <Show when={qrDataUrl()}>
                  <img
                    src={qrDataUrl()}
                    alt="QR Absensi Fullscreen"
                    class="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-2xl object-contain"
                  />
                </Show>
              </div>
              <div class="px-4 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full text-xs font-semibold animate-pulse flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Kamera HP diarahkan langsung ke QR Code di atas
              </div>
            </div>

            {/* Meeting Details & Schedule Card */}
            <div class="space-y-6 max-w-lg w-full">
              <div>
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold mb-3">
                  <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                  RAPAT SEDANG BERLANGSUNG
                </div>
                <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  {activeMeeting()!.title}
                </h1>
              </div>

              {/* Schedule Details */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-inner text-sm">
                <div class="space-y-1">
                  <span class="text-slate-400 text-xs uppercase font-bold flex items-center gap-1.5">
                    <span>📅</span> Tanggal Rapat
                  </span>
                  <p class="font-bold text-base text-slate-100">{activeMeeting()!.date}</p>
                </div>
                <div class="space-y-1">
                  <span class="text-slate-400 text-xs uppercase font-bold flex items-center gap-1.5">
                    <span>⏰</span> Waktu Pelaksanaan
                  </span>
                  <p class="font-bold text-base text-slate-100">{activeMeeting()!.time}</p>
                </div>
                <div class="space-y-1">
                  <span class="text-slate-400 text-xs uppercase font-bold flex items-center gap-1.5">
                    <span>📍</span> Ruangan / Tempat
                  </span>
                  <p class="font-bold text-base text-slate-100 truncate">{activeMeeting()!.location}</p>
                </div>
                <div class="space-y-1">
                  <span class="text-slate-400 text-xs uppercase font-bold flex items-center gap-1.5">
                    <span>👑</span> Pimpinan Rapat
                  </span>
                  <p class="font-bold text-base text-slate-100 truncate">{activeMeeting()!.leader}</p>
                </div>
              </div>

              {/* Live Attendee Counter Status */}
              <div class="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg font-bold">
                    👥
                  </div>
                  <div>
                    <div class="text-xs text-slate-400">Total Peserta Hadir Saat Ini</div>
                    <div class="text-lg font-extrabold text-white">
                      {activeMeeting()!.attendees?.length || 0} Orang
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCopyLink}
                  class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white rounded-xl font-semibold border border-slate-700 transition flex items-center gap-1.5"
                >
                  🔗 Salin URL
                </button>
              </div>
            </div>
          </div>

          {/* Footer ISO Standard Watermark */}
          <div class="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-800/80 gap-2">
            <div>
              Sistem Informasi Manajemen Presensi Digital Yayasan Edelweiss • Standar Dokumen ISO 9001
            </div>
            <div class="font-mono text-slate-400">
              YSPE-MGT-FM-007 Rev.01
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
