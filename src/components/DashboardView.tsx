import { createSignal, For, Show } from 'solid-js';
import type { NavTab, PurchaseRequisition, LeaveRequest, HandoverForm, Meeting } from '../lib/types';
import {
  RequestsTasksIcon,
  EmployeesIcon,
  VibeIcon,
  ReimbursementIcon,
  CompensationIcon,
  AttendanceIcon,
  LeaveIcon,
  HrDocumentsIcon,
  RecruitmentIcon,
  CalendarIcon,
  PerformanceIcon,
  ProjectIcon,
  HelpdeskIcon,
  TravelIcon,
  RecognitionIcon,
  TimeSheetsIcon,
  ReportsIcon,
  ReportsBuilderIcon,
} from './DarwinboxIcons';

interface Props {
  onNavigate: (tab: NavTab) => void;
  prs?: PurchaseRequisition[];
  prList?: PurchaseRequisition[];
  leaves?: LeaveRequest[];
  leaveList?: LeaveRequest[];
  handovers?: HandoverForm[];
  handoverList?: HandoverForm[];
  meetings?: Meeting[];
  searchQuery?: string;
  onOpenPrPdf: (pr: PurchaseRequisition) => void;
  onOpenLeavePdf: (leave: LeaveRequest) => void;
  onOpenHandoverPdf?: (h: HandoverForm) => void;
  onOpenMeetingPdf?: (m: Meeting) => void;
}

export default function DashboardView(props: Props) {
  const [selectedFeatureModal, setSelectedFeatureModal] = createSignal<{
    title: string;
    description: string;
    icon: string;
    details: Array<{ label: string; value: string }>;
  } | null>(null);

  const [showPolicyModal, setShowPolicyModal] = createSignal(false);

  // Safe accessor functions
  const prs = () => props.prs || props.prList || [];
  const leaves = () => props.leaves || props.leaveList || [];
  const handovers = () => props.handovers || props.handoverList || [];
  const meetings = () => props.meetings || [];

  // 18 Darwinbox Applications Grid items
  const darwinboxApps = [
    {
      id: 'requests-tasks',
      name: 'Requests & Tasks',
      icon: RequestsTasksIcon,
      badge: '2',
      badgeColor: 'bg-rose-500',
      action: () => props.onNavigate('purchase-requisition'),
      description: 'Daftar permohonan PR, cuti & disposisi yang membutuhkan persetujuan Anda.',
    },
    {
      id: 'employees',
      name: 'Employees',
      icon: EmployeesIcon,
      action: () => setSelectedFeatureModal({
        title: 'Direktori Pegawai & Guru',
        description: 'Daftar seluruh staf pengajar TK, SD, SMP & Yayasan Sinar Putih Edelweiss dengan status kepegawaian resmi.',
        icon: '👨‍🏫',
        details: [
          { label: 'Total Guru & Karyawan', value: '48 Orang' },
          { label: 'Unit SD', value: '22 Guru & Staf' },
          { label: 'Unit SMP', value: '16 Guru & Staf' },
          { label: 'KB/TK & Yayasan', value: '10 Staf' },
        ],
      }),
      description: 'Direktori profil seluruh guru, staf akademik, dan pengurus yayasan.',
    },
    {
      id: 'vibe',
      name: 'Vibe',
      icon: VibeIcon,
      badge: 'NEW',
      badgeColor: 'bg-emerald-500',
      action: () => setSelectedFeatureModal({
        title: 'Vibe - Ruang Apresiasi Sekolah',
        description: 'Umpan balik internal, pengumuman prestasi siswa/guru, dan apresiasi capaian ISO 21001:2018.',
        icon: '🎉',
        details: [
          { label: 'Status Akreditasi Mutu', value: 'ISO 21001:2018 Terverifikasi' },
          { label: 'Prestasi Bulan Ini', value: 'Juara 1 Olimpiade Sains Tingkat Kota' },
          { label: 'Indeks Kepuasan Guru', value: '96.4%' },
        ],
      }),
      description: 'Forum komunikasi budaya positif dan apresiasi antar civitas sekolah.',
    },
    {
      id: 'reimbursement',
      name: 'Reimbursement',
      icon: ReimbursementIcon,
      action: () => props.onNavigate('purchase-requisition'),
      description: 'Klaim biaya operasional sekolah, transport kegiatan luar, dan konsumsi rapat.',
    },
    {
      id: 'compensation',
      name: 'Compensation',
      icon: CompensationIcon,
      action: () => setSelectedFeatureModal({
        title: 'Kompensasi & Tunjangan Guru',
        description: 'Struktur gaji, tunjangan sertifikasi, insentif wali kelas, dan tunjangan jabatan sekolah.',
        icon: '💳',
        details: [
          { label: 'Periode Payroll', value: 'Agustus 2026' },
          { label: 'Status Slip Gaji', value: 'Telah Terbit' },
          { label: 'Tunjangan Fungsional', value: 'Aktif' },
        ],
      }),
      description: 'Informasi slip gaji, tunjangan fungsional guru, dan insentif yayasan.',
    },
    {
      id: 'attendance',
      name: 'Attendance',
      icon: AttendanceIcon,
      badge: 'LIVE',
      badgeColor: 'bg-emerald-600',
      action: () => props.onNavigate('meeting-attendance'),
      description: 'Presensi digital rapat berstandar ISO dengan scan QR di HP dan verifikasi kehadiran langsung.',
    },
    {
      id: 'leave',
      name: 'Leave',
      icon: LeaveIcon,
      action: () => props.onNavigate('leave-request'),
      description: 'Kalkulator kuota hak cuti tahunan, rekap saldo cuti, dan alur approval berjenjang.',
    },
    {
      id: 'hr-documents',
      name: 'HR Documents',
      icon: HrDocumentsIcon,
      action: () => setSelectedFeatureModal({
        title: 'Repositori Dokumen ISO HRD',
        description: 'Standar Operasional Prosedur (SOP), Formulir Mutu ISO 21001:2018, SK Pengangkatan, dan Buku Pedoman Guru.',
        icon: '📁',
        details: [
          { label: 'Kode Dokumen Utama', value: 'YSPE-HRD-SOP-001' },
          { label: 'Formulir Cuti', value: 'YSPE-HRD-FM-019 Rev.02' },
          { label: 'Formulir Evaluasi Guru', value: 'YSPE-HRD-FM-012 Rev.01' },
        ],
      }),
      description: 'Repositori formulir resmi ISO 21001:2018, SOP guru, dan kebijakan sekolah.',
    },
    {
      id: 'recruitment',
      name: 'Recruitment',
      icon: RecruitmentIcon,
      action: () => setSelectedFeatureModal({
        title: 'Perekrutan Guru & Tenaga Kependidikan',
        description: 'Portal seleksi calon tenaga pendidik dan tenaga kependidikan tahun ajaran baru.',
        icon: '🎯',
        details: [
          { label: 'Posisi Dibuka', value: 'Guru Bahasa Inggris & Guru BK' },
          { label: 'Pelamar Masuk', value: '14 Berkas' },
          { label: 'Jadwal Microteaching', value: '28 Agustus 2026' },
        ],
      }),
      description: 'Manajemen rekrutmen guru baru dan seleksi microteaching.',
    },
    {
      id: 'calendar',
      name: 'Calendar',
      icon: CalendarIcon,
      action: () => props.onNavigate('meeting-attendance'),
      description: 'Kalender akademik, jadwal rapat yayasan, dan agenda supervisi kelas.',
    },
    {
      id: 'performance',
      name: 'Performance',
      icon: PerformanceIcon,
      action: () => setSelectedFeatureModal({
        title: 'Penilaian Kinerja Guru (PKG)',
        description: 'Evaluasi kompetensi pedagogik, kepribadian, sosial, dan profesional guru sesuai standar ISO.',
        icon: '📈',
        details: [
          { label: 'Siklus Penilaian', value: 'Semester Ganjil 2026/2027' },
          { label: 'Supervisi Kelas', value: 'Selesai 100%' },
          { label: 'Rata-rata Skor PKG', value: '92.8 (Sangat Baik)' },
        ],
      }),
      description: 'Penilaian Kinerja Guru (PKG) dan audit kepatuhan mutu mengajar.',
    },
    {
      id: 'project',
      name: 'Project',
      icon: ProjectIcon,
      action: () => setSelectedFeatureModal({
        title: 'Proyek Strategis Yayasan',
        description: 'Pelaksanaan program ISO Digital, modernisasi laboratorium komputer, dan smart classroom.',
        icon: '🚀',
        details: [
          { label: 'Proyek Aktif', value: 'Sistem Portal ISO Digital (Astro/Cloudflare)' },
          { label: 'Pengembang', value: 'Tim ICT Yayasan (Contoh)' },
          { label: 'Target Go-Live', value: 'September 2026' },
        ],
      }),
      description: 'Manajemen proyek digitalisasi sekolah dan sarana prasarana.',
    },
    {
      id: 'helpdesk',
      name: 'Helpdesk',
      icon: HelpdeskIcon,
      action: () => props.onNavigate('handover-form'),
      description: 'Tiket bantuan teknis ICT, serah terima perangkat laptop/PC, dan maintenance printer sekolah.',
    },
    {
      id: 'travel',
      name: 'Travel',
      icon: TravelIcon,
      action: () => props.onNavigate('purchase-requisition'),
      description: 'Surat Tugas dinas luar sekolah, studi banding guru, dan pendampingan lomba siswa.',
    },
    {
      id: 'recognition',
      name: 'Recognition',
      icon: RecognitionIcon,
      action: () => setSelectedFeatureModal({
        title: 'Apresiasi & Penghargaan Guru',
        description: 'Penghargaan Masa Kerja 10/15/20 Tahun dan Pendidik Berdedikasi Terbaik.',
        icon: '🏆',
        details: [
          { label: 'Guru Teladan 2026', value: 'Pendidik Berdedikasi (Contoh)' },
          { label: 'Inovasi Pembelajaran', value: 'Modul Gamifikasi Matematika SD' },
        ],
      }),
      description: 'Penghargaan dedikasi guru dan apresiasi inovasi belajar mengajar.',
    },
    {
      id: 'timesheets',
      name: 'Time Sheets',
      icon: TimeSheetsIcon,
      action: () => setSelectedFeatureModal({
        title: 'Log Jam Mengajar & Kegiatan',
        description: 'Rekapitulasi jam tatap muka di kelas, jam bimbingan ekstrakurikuler, dan piket guru.',
        icon: '⏱️',
        details: [
          { label: 'Jam Tatap Muka/Minggu', value: '24 Jam Pelajaran (Terpenuhi)' },
          { label: 'Ekskul Binaan', value: 'Robotik & Coding Club' },
          { label: 'Verifikasi Kurikulum', value: 'Sesuai Standar Kemendikbudristek' },
        ],
      }),
      description: 'Pencatatan jam mengajar dan kegiatan sekolah.',
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: ReportsIcon,
      action: () => setSelectedFeatureModal({
        title: 'Laporan Eksekutif Mutu ISO',
        description: 'Dashboard analitik kepatuhan ISO 21001:2018, statistik pengadaan PR, dan audit kehadiran rapat.',
        icon: '📊',
        details: [
          { label: 'Kepatuhan Alur Approval', value: '99.2%' },
          { label: 'Waktu Rata-rata TTD Dokumen', value: '< 4 Jam' },
          { label: 'Dokumen Ter-digitalisasi', value: '1.420 Dokumen' },
        ],
      }),
      description: 'Laporan berkala dan analitik kepatuhan sistem mutu.',
    },
    {
      id: 'reports-builder',
      name: 'Reports Builder',
      icon: ReportsBuilderIcon,
      action: () => props.onNavigate('asset-management'),
      description: 'Pembuat laporan kustom manajemen aset, inventaris QR code, dan ekspor data audit.',
    },
  ];

  // Search filter
  const filteredApps = () => {
    const q = (props.searchQuery || '').toLowerCase().trim();
    if (!q) return darwinboxApps;
    return darwinboxApps.filter(app => 
      app.name.toLowerCase().includes(q) || app.description.toLowerCase().includes(q)
    );
  };

  return (
    <div class="p-3 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Top Health Check / Policy Ribbon Bar (Darwinbox Signature Feature) */}
      <div class="w-full bg-[#e8f4fd] border border-[#b9e2fe] rounded-2xl p-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div class="flex items-center gap-3 text-xs sm:text-sm text-slate-800">
          <div class="w-7 h-7 rounded-full bg-[#1877f2] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
            i
          </div>
          <div class="leading-snug">
            <span class="font-bold text-[#1877f2]">Employee Daily Health Check</span>
            <span class="mx-2 text-slate-400">||</span>
            <span class="text-slate-700">Kindly Sign Off the ISO 21001:2018 School Operation & Health Guideline Policies</span>
          </div>
        </div>

        <button
          onClick={() => setShowPolicyModal(true)}
          class="shrink-0 px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow transition transform hover:scale-105"
        >
          Click here →
        </button>
      </div>

      {/* Main Darwinbox "My Access" Section */}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              My Access
            </h1>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#1877f2]">
              {filteredApps().length} Layanan
            </span>
          </div>

          <div class="text-xs text-slate-500 hidden sm:block">
            Yayasan Sinar Putih Edelweiss • ISO 21001:2018 Certified Portal
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          <For each={filteredApps()}>
            {(app, index) => {
              const IconComp = app.icon;
              return (
                <div
                  onClick={app.action}
                  style={{ "animation-delay": `${index() * 50}ms` }}
                  class="darwin-squircle rounded-3xl p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer relative group aspect-square hover:bg-gradient-to-br hover:from-white hover:to-blue-50 animate-fade-in-up opacity-0"
                >
                  {/* Notification Badge if available */}
                  <Show when={app.badge}>
                    <span
                      class={`absolute top-2.5 right-2.5 px-2 py-0.5 text-[10px] font-bold text-white rounded-full shadow-sm ${app.badgeColor || 'bg-rose-500'} animate-pulse-soft`}
                    >
                      {app.badge}
                    </span>
                  </Show>

                  {/* High-Fidelity 3D Icon */}
                  <div class="transform group-hover:-translate-y-2 group-hover:scale-110 group-hover:drop-shadow-xl transition-all duration-300 ease-out">
                    <IconComp size={54} />
                  </div>

                  {/* Label */}
                  <span class="text-xs sm:text-sm font-bold text-slate-700 mt-3 group-hover:text-[#1877f2] transition-colors duration-200 line-clamp-1 leading-tight">
                    {app.name}
                  </span>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* School Overview Metrics */}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
        <div class="glass-card p-4 rounded-3xl flex items-center gap-3 cursor-default group hover:shadow-glow-brand">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-[#1877f2] flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform duration-300">
            📝
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Purchase Requisition</div>
            <div class="text-xl font-black text-slate-800 tracking-tight">{prs().length} <span class="text-xs text-slate-500 font-semibold tracking-normal">Pengajuan</span></div>
          </div>
        </div>

        <div class="glass-card p-4 rounded-3xl flex items-center gap-3 cursor-default group hover:shadow-glow-emerald">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform duration-300">
            🏖️
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Permohonan Cuti</div>
            <div class="text-xl font-black text-slate-800 tracking-tight">{leaves().length} <span class="text-xs text-slate-500 font-semibold tracking-normal">Berkas</span></div>
          </div>
        </div>

        <div class="glass-card p-4 rounded-3xl flex items-center gap-3 cursor-default group hover:shadow-darwin-hover">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform duration-300">
            📦
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Serah Terima ICT</div>
            <div class="text-xl font-black text-slate-800 tracking-tight">{handovers().length} <span class="text-xs text-slate-500 font-semibold tracking-normal">Perangkat</span></div>
          </div>
        </div>

        <div class="glass-card p-4 rounded-3xl flex items-center gap-3 cursor-default group hover:shadow-darwin-hover">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform duration-300">
            👥
          </div>
          <div>
            <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Presensi Rapat</div>
            <div class="text-xl font-black text-slate-800 tracking-tight">{meetings().length} <span class="text-xs text-slate-500 font-semibold tracking-normal">Sesi Terbuka</span></div>
          </div>
        </div>
      </div>

      {/* Pending Approvals Quick Table */}
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 class="text-base font-bold text-slate-800">
              ⚡ Dokumen Menunggu Persetujuan & Tanda Tangan
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Alur otorisasi berstandar ISO 21001:2018 dengan tanda tangan digital tersertifikasi.
            </p>
          </div>
          <span class="text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full self-start sm:self-auto">
            Prioritas Verifikasi
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th class="p-3">Jenis Dokumen</th>
                <th class="p-3">No. Dokumen ISO</th>
                <th class="p-3">Pemohon</th>
                <th class="p-3">Keterangan / Keperluan</th>
                <th class="p-3">Tahap Approval</th>
                <th class="p-3 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <For each={prs()}>
                {(pr) => (
                  <tr class="hover:bg-blue-50/30 transition">
                    <td class="p-3 font-semibold text-slate-800 flex items-center gap-2">
                      <span>📝</span> Purchase Requisition
                    </td>
                    <td class="p-3 font-mono font-bold text-[#1877f2]">{pr.pr_number}</td>
                    <td class="p-3 text-slate-700">{pr.requester} ({pr.department})</td>
                    <td class="p-3 text-slate-600 max-w-xs truncate">{pr.notes}</td>
                    <td class="p-3">
                      <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        pr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {pr.status} (Tahap {pr.current_approval_step}/3)
                      </span>
                    </td>
                    <td class="p-3 text-center">
                      <button
                        onClick={() => props.onOpenPrPdf(pr)}
                        class="px-3 py-1 bg-[#1877f2] hover:bg-blue-600 text-white rounded-lg font-semibold shadow-sm transition"
                      >
                        📄 Preview ISO PDF
                      </button>
                    </td>
                  </tr>
                )}
              </For>

              <For each={leaves()}>
                {(leave) => (
                  <tr class="hover:bg-blue-50/30 transition">
                    <td class="p-3 font-semibold text-slate-800 flex items-center gap-2">
                      <span>🏖️</span> Permohonan Cuti
                    </td>
                    <td class="p-3 font-mono font-bold text-[#1877f2]">CUTI-{leave.id}</td>
                    <td class="p-3 text-slate-700">{leave.name} ({leave.department})</td>
                    <td class="p-3 text-slate-600">{leave.work_days} Hari - {leave.purpose}</td>
                    <td class="p-3">
                      <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {leave.status} (Tahap {leave.current_approval_step}/3)
                      </span>
                    </td>
                    <td class="p-3 text-center">
                      <button
                        onClick={() => props.onOpenLeavePdf(leave)}
                        class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm transition"
                      >
                        📄 Preview ISO PDF
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Detail Modal */}
      <Show when={selectedFeatureModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-3">
                <span class="text-3xl">{selectedFeatureModal()!.icon}</span>
                <div>
                  <h3 class="text-base font-bold text-slate-800">
                    {selectedFeatureModal()!.title}
                  </h3>
                  <p class="text-xs text-slate-500">
                    Layanan Terintegrasi Portal Darwinbox ISO
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFeatureModal(null)}
                class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed">
              {selectedFeatureModal()!.description}
            </p>

            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div class="text-xs font-bold text-slate-700 mb-2">Informasi & Data Operasional:</div>
              <For each={selectedFeatureModal()!.details}>
                {(item) => (
                  <div class="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0">
                    <span class="text-slate-500">{item.label}</span>
                    <span class="font-bold text-slate-800">{item.value}</span>
                  </div>
                )}
              </For>
            </div>

            <div class="flex justify-end pt-2">
              <button
                onClick={() => setSelectedFeatureModal(null)}
                class="px-5 py-2 bg-[#1877f2] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Policy Sign Off Modal */}
      <Show when={showPolicyModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div class="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <span class="text-2xl">📋</span>
                <div>
                  <h3 class="text-base font-bold text-slate-800">
                    ISO 21001:2018 School Operation Policy Sign-off
                  </h3>
                  <p class="text-xs text-slate-500">Konfirmasi Kepatuhan Kebijakan Sekolah</p>
                </div>
              </div>
              <button
                onClick={() => setShowPolicyModal(false)}
                class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div class="space-y-3 text-xs text-slate-600">
              <p>
                Dengan menandatangani lembar ini secara digital, Anda menyatakan bahwa:
              </p>
              <ul class="list-disc pl-5 space-y-1 text-slate-700">
                <li>Memahami dan mematuhi Standar Prosedur Operasional (SOP) Yayasan Sinar Putih Edelweiss.</li>
                <li>Melakukan verifikasi seluruh pengadaan barang melalui formulir Purchase Requisition (PR) resmi.</li>
                <li>Menjaga keamanan data inventaris dan perangkat ICT sekolah yang dipinjamkan.</li>
                <li>Mengisi presensi rapat dan permohonan cuti secara digital dan transparan.</li>
              </ul>
            </div>

            <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
              <span>✓</span> Status Anda hari ini: Sehat & Siap Menjalankan Operasional Pendidikan.
            </div>

            <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPolicyModal(false)}
                class="px-4 py-2 text-xs text-slate-500 hover:text-slate-800"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  alert('Terima kasih! Kebijakan ISO telah berhasil ditandatangani secara digital.');
                  setShowPolicyModal(false);
                }}
                class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition"
              >
                ✍️ Setujui & Simpan
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
