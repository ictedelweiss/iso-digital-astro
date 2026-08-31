import { createSignal, onMount, Show } from 'solid-js';
import type { DeviceView, NavTab, PurchaseRequisition, LeaveRequest, HandoverForm, Meeting, UserProfile } from '../lib/types';
import { 
  INITIAL_PURCHASE_REQUISITIONS, 
  INITIAL_LEAVE_REQUESTS, 
  INITIAL_HANDOVER_FORMS, 
  INITIAL_MEETINGS, 
  INITIAL_ASSETS,
  MOCK_USERS
} from '../lib/dummyData';
import { 
  generatePrPdfHtml, 
  generateLeavePdfHtml, 
  generateHandoverPdfHtml, 
  generateMeetingPdfHtml 
} from '../lib/pdfTemplates';

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import DevicePreviewFrame from './DevicePreviewFrame';
import DashboardView from './DashboardView';
import PurchaseRequisitionView from './PurchaseRequisitionView';
import LeaveRequestView from './LeaveRequestView';
import HandoverFormView from './HandoverFormView';
import MeetingAttendanceView from './MeetingAttendanceView';
import AssetManagementView from './AssetManagementView';
import PdfPreviewModal from './PdfPreviewModal';
import SignaturePadModal from './SignaturePadModal';
import LoginModal from './LoginModal';
import FirstTimeSignatureModal from './FirstTimeSignatureModal';

export default function App() {
  // Navigation & Viewport State
  const [currentTab, setCurrentTab] = createSignal<NavTab>('dashboard');
  const [deviceView, setDeviceView] = createSignal<DeviceView>('responsive');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [globalSearch, setGlobalSearch] = createSignal('');

  // Authentication & User State
  const [currentUser, setCurrentUser] = createSignal<UserProfile | null>(null);
  const [loginModalOpen, setLoginModalOpen] = createSignal(true); // Open by default if no user
  const [signatureOnboardingOpen, setSignatureOnboardingOpen] = createSignal(false);
  const [toastMessage, setToastMessage] = createSignal<string | null>(null);

  // Entities State
  const [prs] = createSignal<PurchaseRequisition[]>(INITIAL_PURCHASE_REQUISITIONS);
  const [leaves] = createSignal<LeaveRequest[]>(INITIAL_LEAVE_REQUESTS);
  const [handovers] = createSignal<HandoverForm[]>(INITIAL_HANDOVER_FORMS);
  const [meetings] = createSignal<Meeting[]>(INITIAL_MEETINGS);

  // Modals State
  const [pdfModalOpen, setPdfModalOpen] = createSignal(false);
  const [pdfTitle, setPdfTitle] = createSignal('');
  const [pdfDocCode, setPdfDocCode] = createSignal('');
  const [pdfHtml, setPdfHtml] = createSignal('');

  const [sigModalOpen, setSigModalOpen] = createSignal(false);
  const [sigModalTitle, setSigModalTitle] = createSignal('');
  const [sigCallback, setSigCallback] = createSignal<((sig: string) => void) | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check login state and first-time signature onboarding
  onMount(async () => {
    // Check URL parameters for MS auth feedback
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('login_success') === '1') {
        showToast('✓ Berhasil login dengan Microsoft 365!');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get('auth_error')) {
        showToast(`❌ Gagal login: ${urlParams.get('auth_error')}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          // The signature image is no longer kept in localStorage (it persisted
          // indefinitely on shared devices) nor in the session cookie (too big).
          // It is fetched on demand from an authenticated endpoint.
          const hasSig = !!data.user.has_signature;
          let sigData: string | undefined;

          if (hasSig) {
            try {
              const sigRes = await fetch('/api/user/signature');
              if (sigRes.ok) {
                const sigJson = await sigRes.json();
                sigData = sigJson?.signatureData || undefined;
              }
            } catch (e) {
              // Non-fatal: the user can re-enrol their signature later.
            }
          }

          setCurrentUser({
            id: data.user.id,
            displayName: data.user.displayName,
            email: data.user.email,
            jobTitle: data.user.jobTitle || 'Staff',
            department: data.user.department || 'ICT',
            role: data.user.role || 'staff',
            has_signature: hasSig,
            signature_data: sigData,
          });
          setLoginModalOpen(false); // Close login modal on success
          
          if (!hasSig) {
            setTimeout(() => {
              setSignatureOnboardingOpen(true);
            }, 500);
          }
        }
      }
    } catch (e) {
      // API down or error
    }
  });

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch(e) {}
    setCurrentUser(null);
    setLoginModalOpen(true);
    showToast('Sesi ditutup.');
  };

  // Handle Saving Signature (First time or update)
  const handleSaveSignature = async (sigData: string) => {
    const current = currentUser();
    if (!current) return;

    try {
      await fetch('/api/user/save-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData: sigData,
        }),
      });
    } catch (e) {
      // ignore
    }

    const updated: UserProfile = {
      ...current,
      has_signature: true,
      signature_data: sigData,
    };
    setCurrentUser(updated);

    setSignatureOnboardingOpen(false);
    showToast('✓ Tanda tangan digital resmi berhasil disimpan dan diaktifkan!');
  };

  // Handlers for PDF live previews
  const openPrPdf = (pr: PurchaseRequisition) => {
    const html = generatePrPdfHtml(pr, '/logo.png');
    setPdfTitle(`Purchase Requisition - ${pr.pr_number} (${pr.title})`);
    setPdfDocCode('YSPE-FNA-FM-001 Rev.03');
    setPdfHtml(html);
    setPdfModalOpen(true);
  };

  const openLeavePdf = (lv: LeaveRequest) => {
    const html = generateLeavePdfHtml(lv, '/logo.png');
    setPdfTitle(`Permohonan Cuti - ${lv.name} (${lv.department})`);
    setPdfDocCode('YSPE-HRD-FM-019 Rev.02');
    setPdfHtml(html);
    setPdfModalOpen(true);
  };

  const openHandoverPdf = (h: HandoverForm) => {
    const html = generateHandoverPdfHtml(h, '/logo.png');
    setPdfTitle(`Serah Terima Aset - ${h.item_name} (${h.recipient_name})`);
    setPdfDocCode('YSPE-ICT-FM-002 Rev.04');
    setPdfHtml(html);
    setPdfModalOpen(true);
  };

  const openMeetingPdf = (m: Meeting) => {
    const html = generateMeetingPdfHtml(m, '/logo.png');
    setPdfTitle(`Daftar Hadir Rapat - ${m.title}`);
    setPdfDocCode('YSPE-MGT-FM-007 Rev.01');
    setPdfHtml(html);
    setPdfModalOpen(true);
  };

  const triggerSignaturePad = (title: string, onSave: (sig: string) => void) => {
    setSigModalTitle(title);
    setSigCallback(() => onSave);
    setSigModalOpen(true);
  };

  const badgeCounts = () => ({
    pr: prs().filter(p => p.status === 'Pending').length,
    leave: leaves().filter(l => l.status === 'Pending').length,
    handover: handovers().filter(h => h.status === 'Pending').length,
    meetings: meetings().length,
    assets: INITIAL_ASSETS.length,
  });

  return (
    <div class="min-h-screen bg-[#f0f4f9] text-slate-800 flex flex-col antialiased">
      {/* Toast Notification */}
      <Show when={toastMessage()}>
        <div class="fixed bottom-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-slideUp">
          <span>✨</span>
          <span>{toastMessage()}</span>
        </div>
      </Show>

      {/* Top Navbar with Active User & Signature Status */}
      <Show when={currentUser()}>
        <Navbar
          currentTab={currentTab()}
          deviceView={deviceView()}
          currentUser={currentUser()!}
          searchQuery={globalSearch()}
          onSearchChange={(q) => setGlobalSearch(q)}
          onSelectDevice={(view) => setDeviceView(view)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
          onOpenLoginModal={() => setLoginModalOpen(true)}
          onOpenSignatureModal={() => setSignatureOnboardingOpen(true)}
          onLogout={handleLogout}
        />

        {/* Main Shell with Device Preview Wrapper */}
        <div class="flex-1 flex w-full">
          {/* Sidebar only in Responsive mode */}
          <Show when={deviceView() === 'responsive'}>
            <Sidebar
              activeTab={currentTab()}
              onSelectTab={(tab) => setCurrentTab(tab)}
              isOpenMobile={isMobileMenuOpen()}
              onCloseMobile={() => setIsMobileMenuOpen(false)}
              badgeCounts={badgeCounts()}
            />
          </Show>

          {/* Dynamic Device Frame Wrapper */}
          <DevicePreviewFrame
            deviceView={deviceView()}
            onSelectDevice={(view) => setDeviceView(view)}
          >
            <main class="flex-1 w-full max-w-7xl mx-auto pb-16 lg:pb-8">
            <Show when={currentTab() === 'dashboard'}>
              <DashboardView
                prs={prs()}
                leaves={leaves()}
                handovers={handovers()}
                meetings={meetings()}
                searchQuery={globalSearch()}
                onNavigate={(tab) => setCurrentTab(tab)}
                onOpenPrPdf={openPrPdf}
                onOpenLeavePdf={openLeavePdf}
                onOpenHandoverPdf={openHandoverPdf}
                onOpenMeetingPdf={openMeetingPdf}
              />
            </Show>

            <Show when={currentTab() === 'purchase-requisition'}>
              <PurchaseRequisitionView
                prs={prs()}
                currentUser={currentUser()}
                onOpenPdf={openPrPdf}
                onOpenSignatureModal={triggerSignaturePad}
              />
            </Show>

            <Show when={currentTab() === 'leave-request'}>
              <LeaveRequestView
                leaves={leaves()}
                currentUser={currentUser()}
                onOpenPdf={openLeavePdf}
                onOpenSignatureModal={triggerSignaturePad}
              />
            </Show>

            <Show when={currentTab() === 'handover-form'}>
              <HandoverFormView
                handovers={handovers()}
                currentUser={currentUser()}
                onOpenPdf={openHandoverPdf}
                onOpenSignatureModal={triggerSignaturePad}
              />
            </Show>

            <Show when={currentTab() === 'meeting-attendance'}>
              <MeetingAttendanceView
                meetings={meetings()}
                currentUser={currentUser()}
                onOpenPdf={openMeetingPdf}
                onOpenSignatureModal={triggerSignaturePad}
              />
            </Show>

            <Show when={currentTab() === 'asset-management'}>
              <AssetManagementView />
            </Show>
          </main>
        </DevicePreviewFrame>
      </div>

      {/* Mobile Bottom Bar */}
      <MobileNav
        activeTab={currentTab()}
        onSelectTab={(tab) => setCurrentTab(tab)}
      />

      {/* Live ISO PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={pdfModalOpen()}
        title={pdfTitle()}
        docCode={pdfDocCode()}
        htmlContent={pdfHtml()}
        onClose={() => setPdfModalOpen(false)}
      />

      {/* Dynamic Signature Canvas Pad Modal */}
      <SignaturePadModal
        isOpen={sigModalOpen()}
        title={sigModalTitle()}
        onSave={(sig) => {
          const cb = sigCallback();
          if (cb) cb(sig);
        }}
        onClose={() => setSigModalOpen(false)}
      />

      {/* First-Time Digital Signature Onboarding Modal */}
      <FirstTimeSignatureModal
        isOpen={signatureOnboardingOpen()}
        user={currentUser()!}
        canDismiss={true}
        onSaveSignature={handleSaveSignature}
        onClose={() => setSignatureOnboardingOpen(false)}
      />
      </Show>

      {/* Microsoft 365 Login Modal */}
      <LoginModal
        isOpen={loginModalOpen()}
        onClose={() => setLoginModalOpen(false)}
      />
    </div>
  );
}
