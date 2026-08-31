import type { JSX } from 'solid-js';

// Reusable SVG props
interface IconProps {
  class?: string;
  size?: number;
}

export const RequestsTasksIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <filter id="shadow-req" x="4" y="4" width="56" height="56" filterUnits="userSpaceOnUse">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.12" />
        </filter>
        <linearGradient id="paperGrad1" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FFFFFF" />
          <stop offset="1" stop-color="#EEF2F6" />
        </linearGradient>
      </defs>
      {/* Background shadow layer */}
      <rect x="18" y="10" width="34" height="46" rx="6" fill="#D1D5DB" opacity="0.5" />
      <rect x="15" y="8" width="34" height="46" rx="6" fill="#E5E7EB" />
      {/* Front Paper */}
      <rect x="12" y="6" width="34" height="46" rx="6" fill="url(#paperGrad1)" stroke="#E2E8F0" stroke-width="1.5" />
      {/* Check item 1 */}
      <circle cx="20" cy="18" r="4.5" fill="#10B981" />
      <path d="M18 18L19.5 19.5L22.5 16.5" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="27" y="16.5" width="14" height="3" rx="1.5" fill="#94A3B8" />
      {/* Check item 2 */}
      <circle cx="20" cy="28" r="4.5" fill="#10B981" />
      <path d="M18 28L19.5 29.5L22.5 26.5" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="27" y="26.5" width="14" height="3" rx="1.5" fill="#94A3B8" />
      {/* Cross item 3 */}
      <circle cx="20" cy="38" r="4.5" fill="#EF4444" />
      <path d="M18 36L22 40M22 36L18 40" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
      <rect x="27" y="36.5" width="11" height="3" rx="1.5" fill="#94A3B8" />
      {/* Red Notification Pill */}
      <circle cx="48" cy="10" r="5" fill="#EF4444" stroke="#FFFFFF" stroke-width="1.5" />
    </svg>
  );
};

export const EmployeesIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="empGradMain" x1="20" y1="12" x2="44" y2="52" gradientUnits="userSpaceOnUse">
          <stop stop-color="#0091FF" />
          <stop offset="1" stop-color="#0064E0" />
        </linearGradient>
        <linearGradient id="empGradSide1" x1="8" y1="18" x2="28" y2="48" gradientUnits="userSpaceOnUse">
          <stop stop-color="#5856D6" />
          <stop offset="1" stop-color="#3634A3" />
        </linearGradient>
        <linearGradient id="empGradSide2" x1="36" y1="18" x2="56" y2="48" gradientUnits="userSpaceOnUse">
          <stop stop-color="#5856D6" />
          <stop offset="1" stop-color="#3634A3" />
        </linearGradient>
      </defs>
      {/* Left Avatar */}
      <circle cx="19" cy="24" r="7" fill="url(#empGradSide1)" />
      <path d="M9 48C9 40 14 36 19 36C24 36 29 40 29 48" fill="url(#empGradSide1)" />
      {/* Right Avatar */}
      <circle cx="45" cy="24" r="7" fill="url(#empGradSide2)" />
      <path d="M35 48C35 40 40 36 45 36C50 36 55 40 55 48" fill="url(#empGradSide2)" />
      {/* Center Front Avatar */}
      <circle cx="32" cy="20" r="9" fill="url(#empGradMain)" stroke="#FFFFFF" stroke-width="2" />
      <path d="M18 50C18 41 24 36 32 36C40 36 46 41 46 50" fill="url(#empGradMain)" stroke="#FFFFFF" stroke-width="2" />
    </svg>
  );
};

export const VibeIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="chatCyan" x1="16" y1="10" x2="48" y2="38" gradientUnits="userSpaceOnUse">
          <stop stop-color="#00D2FF" />
          <stop offset="1" stop-color="#007AFF" />
        </linearGradient>
        <linearGradient id="chatPurple" x1="10" y1="26" x2="42" y2="54" gradientUnits="userSpaceOnUse">
          <stop stop-color="#AF52DE" />
          <stop offset="1" stop-color="#7822B0" />
        </linearGradient>
      </defs>
      {/* Back cyan bubble */}
      <path d="M22 12C33 12 48 12 48 24C48 34 38 36 30 36L22 41V35C15 35 12 30 12 24C12 16 16 12 22 12Z" fill="url(#chatCyan)" />
      <rect x="20" y="20" width="18" height="3" rx="1.5" fill="#FFFFFF" opacity="0.9" />
      <rect x="20" y="26" width="12" height="3" rx="1.5" fill="#FFFFFF" opacity="0.9" />

      {/* Front purple bubble */}
      <path d="M22 28C14 28 8 33 8 40C8 46 12 49 16 50V56L24 51C32 51 40 48 40 40C40 33 32 28 22 28Z" fill="url(#chatPurple)" stroke="#FFFFFF" stroke-width="2" />
      <circle cx="18" cy="40" r="2" fill="#FFFFFF" />
      <circle cx="24" cy="40" r="2" fill="#FFFFFF" />
      <circle cx="30" cy="40" r="2" fill="#FFFFFF" />
    </svg>
  );
};

export const ReimbursementIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="cashGrad" x1="6" y1="18" x2="58" y2="46" gradientUnits="userSpaceOnUse">
          <stop stop-color="#34D399" />
          <stop offset="1" stop-color="#059669" />
        </linearGradient>
      </defs>
      {/* Cash Bill */}
      <rect x="8" y="20" width="48" height="26" rx="4" fill="url(#cashGrad)" stroke="#047857" stroke-width="1.5" />
      <circle cx="32" cy="33" r="7" fill="#10B981" stroke="#A7F3D0" stroke-width="1" />
      <circle cx="14" cy="25" r="2" fill="#A7F3D0" />
      <circle cx="50" cy="25" r="2" fill="#A7F3D0" />
      <circle cx="14" cy="41" r="2" fill="#A7F3D0" />
      <circle cx="50" cy="41" r="2" fill="#A7F3D0" />

      {/* Yellow Exchange Arrows */}
      <path d="M22 17C22 17 28 14 36 15C42 16 46 20 46 20" stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
      <path d="M22 13V18H27" stroke="#FBBF24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <path d="M42 49C42 49 36 52 28 51C22 50 18 46 18 46" stroke="#FBBF24" stroke-width="3" stroke-linecap="round" />
      <path d="M42 53V48H37" stroke="#FBBF24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
};

export const CompensationIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="compGrad1" x1="10" y1="14" x2="54" y2="36" gradientUnits="userSpaceOnUse">
          <stop stop-color="#34D399" />
          <stop offset="1" stop-color="#059669" />
        </linearGradient>
        <linearGradient id="compGrad2" x1="8" y1="22" x2="56" y2="44" gradientUnits="userSpaceOnUse">
          <stop stop-color="#10B981" />
          <stop offset="1" stop-color="#047857" />
        </linearGradient>
      </defs>
      {/* Stack 1 (Back) */}
      <rect x="14" y="16" width="36" height="20" rx="3" fill="#6EE7B7" stroke="#047857" stroke-width="1.2" />
      {/* Stack 2 (Middle) */}
      <rect x="11" y="22" width="42" height="22" rx="3" fill="url(#compGrad1)" stroke="#047857" stroke-width="1.2" />
      {/* Stack 3 (Front) */}
      <rect x="8" y="28" width="48" height="24" rx="4" fill="url(#compGrad2)" stroke="#065F46" stroke-width="1.5" />
      <circle cx="32" cy="40" r="6" fill="#34D399" stroke="#A7F3D0" stroke-width="1" />
      <text x="32" y="44" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#064E3B" text-anchor="middle">$</text>
      <circle cx="14" cy="33" r="1.5" fill="#A7F3D0" />
      <circle cx="50" cy="33" r="1.5" fill="#A7F3D0" />
      <circle cx="14" cy="47" r="1.5" fill="#A7F3D0" />
      <circle cx="50" cy="47" r="1.5" fill="#A7F3D0" />
    </svg>
  );
};

export const AttendanceIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Calendar body */}
      <rect x="12" y="12" width="40" height="38" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
      <path d="M12 18C12 14.6863 14.6863 12 18 12H46C49.3137 12 52 14.6863 52 18V22H12V18Z" fill="#EF4444" />
      {/* Binder rings */}
      <rect x="20" y="8" width="4" height="7" rx="2" fill="#94A3B8" />
      <rect x="40" y="8" width="4" height="7" rx="2" fill="#94A3B8" />
      {/* Green dots for presence */}
      <circle cx="20" cy="30" r="2.5" fill="#10B981" />
      <circle cx="28" cy="30" r="2.5" fill="#10B981" />
      <circle cx="36" cy="30" r="2.5" fill="#10B981" />
      <circle cx="44" cy="30" r="2.5" fill="#10B981" />
      <circle cx="20" cy="38" r="2.5" fill="#10B981" />
      <circle cx="28" cy="38" r="2.5" fill="#10B981" />
      {/* Clock Widget in Bottom Right */}
      <circle cx="44" cy="42" r="10" fill="#FFFFFF" stroke="#F97316" stroke-width="2.5" />
      <circle cx="44" cy="42" r="1.5" fill="#1E293B" />
      <path d="M44 36V42L48 44" stroke="#1E293B" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
};

export const LeaveIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="sunGrad" x1="42" y1="6" x2="58" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FDE047" />
          <stop offset="1" stop-color="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Sunny warm glow */}
      <circle cx="48" cy="14" r="6" fill="url(#sunGrad)" opacity="0.8" />
      {/* Beach Umbrella Top */}
      <path d="M12 28C12 18 20 12 30 12C40 12 48 18 48 28H12Z" fill="#EF4444" />
      <path d="M19 28C19 21 24 12 30 12C36 12 41 21 41 28H19Z" fill="#FFFFFF" />
      <path d="M26 28C26 22 28 12 30 12C32 12 34 22 34 28H26Z" fill="#EF4444" />
      {/* Umbrella Pole */}
      <path d="M30 12V46" stroke="#92400E" stroke-width="2.5" stroke-linecap="round" />
      {/* Lounge Chair */}
      <path d="M16 46L26 36L44 42L52 38" stroke="#3B82F6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M22 46L26 36" stroke="#F59E0B" stroke-width="3" stroke-linecap="round" />
      <path d="M44 42L46 48" stroke="#F59E0B" stroke-width="3" stroke-linecap="round" />
      <path d="M34 40L36 47" stroke="#F59E0B" stroke-width="3" stroke-linecap="round" />
    </svg>
  );
};

export const HrDocumentsIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Document page */}
      <rect x="14" y="8" width="36" height="48" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
      {/* Top blue seal */}
      <circle cx="22" cy="18" r="4.5" fill="#007AFF" />
      <rect x="29" y="16" width="15" height="4" rx="2" fill="#007AFF" />
      {/* Text lines */}
      <rect x="20" y="27" width="24" height="2.5" rx="1.25" fill="#94A3B8" />
      <rect x="20" y="33" width="24" height="2.5" rx="1.25" fill="#94A3B8" />
      <rect x="20" y="39" width="20" height="2.5" rx="1.25" fill="#94A3B8" />
      <rect x="20" y="45" width="14" height="2.5" rx="1.25" fill="#94A3B8" />
    </svg>
  );
};

export const RecruitmentIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Left Cyan Avatar */}
      <circle cx="17" cy="28" r="5" fill="#06B6D4" />
      <path d="M10 44C10 38 13 36 17 36C21 36 24 38 24 44" fill="#06B6D4" />
      {/* Right Purple Avatar */}
      <circle cx="47" cy="28" r="5" fill="#A855F7" />
      <path d="M40 44C40 38 43 36 47 36C51 36 54 38 54 44" fill="#A855F7" />
      {/* Center Candidate (Red/Pink) */}
      <circle cx="32" cy="24" r="7" fill="#F43F5E" />
      <path d="M22 46C22 39 27 35 32 35C37 35 42 39 42 46" fill="#F43F5E" />
      {/* Magnifying Glass */}
      <circle cx="38" cy="30" r="10" stroke="#1E293B" stroke-width="3" fill="#FFFFFF" fill-opacity="0.25" />
      <path d="M45 37L54 46" stroke="#1E293B" stroke-width="4" stroke-linecap="round" />
    </svg>
  );
};

export const CalendarIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <rect x="12" y="12" width="40" height="40" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
      {/* Red Header */}
      <path d="M12 18C12 14.6863 14.6863 12 18 12H46C49.3137 12 52 14.6863 52 18V24H12V18Z" fill="#EF4444" />
      {/* Binder spirals */}
      <circle cx="20" cy="12" r="2.5" fill="#CBD5E1" stroke="#64748B" stroke-width="1.5" />
      <circle cx="32" cy="12" r="2.5" fill="#CBD5E1" stroke="#64748B" stroke-width="1.5" />
      <circle cx="44" cy="12" r="2.5" fill="#CBD5E1" stroke="#64748B" stroke-width="1.5" />
      {/* Calendar Grid Dots */}
      <circle cx="20" cy="31" r="2.5" fill="#CBD5E1" />
      <circle cx="28" cy="31" r="2.5" fill="#CBD5E1" />
      <circle cx="36" cy="31" r="2.5" fill="#CBD5E1" />
      <circle cx="44" cy="31" r="2.5" fill="#CBD5E1" />
      <circle cx="20" cy="39" r="2.5" fill="#CBD5E1" />
      <circle cx="28" cy="39" r="2.5" fill="#CBD5E1" />
      <circle cx="36" cy="39" r="2.5" fill="#EF4444" />
      <circle cx="44" cy="39" r="2.5" fill="#CBD5E1" />
      <circle cx="20" cy="46" r="2.5" fill="#CBD5E1" />
      <circle cx="28" cy="46" r="2.5" fill="#CBD5E1" />
    </svg>
  );
};

export const PerformanceIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Purple user avatar on left */}
      <circle cx="18" cy="24" r="6" fill="#8B5CF6" />
      <path d="M10 46C10 38 14 34 18 34C22 34 26 38 26 46" fill="#8B5CF6" />
      {/* Rising Bar Chart on right */}
      <rect x="30" y="36" width="6" height="12" rx="2" fill="#3B82F6" />
      <rect x="39" y="28" width="6" height="20" rx="2" fill="#3B82F6" />
      <rect x="48" y="20" width="6" height="28" rx="2" fill="#3B82F6" />
      {/* Red rising trend arrow */}
      <path d="M28 32L38 22L44 26L52 14" stroke="#EF4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M46 14H52V20" stroke="#EF4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
};

export const ProjectIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="folderGrad" x1="8" y1="20" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop stop-color="#10B981" />
          <stop offset="1" stop-color="#059669" />
        </linearGradient>
      </defs>
      {/* Flying Papers */}
      <rect x="22" y="8" width="20" height="24" rx="3" transform="rotate(15 22 8)" fill="#FDE047" opacity="0.9" />
      <rect x="28" y="10" width="22" height="26" rx="3" transform="rotate(-10 28 10)" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
      {/* Green Folder Tab */}
      <path d="M10 24C10 21.7909 11.7909 20 14 20H24L28 24H50C52.2091 24 54 25.7909 54 28V48C54 50.2091 52.2091 52 50 52H14C11.7909 52 10 50.2091 10 48V24Z" fill="url(#folderGrad)" stroke="#047857" stroke-width="1.5" />
      {/* Front Folder flap */}
      <path d="M8 32H56L51 52H13L8 32Z" fill="#34D399" opacity="0.85" />
    </svg>
  );
};

export const HelpdeskIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="helpGrad" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop stop-color="#0091FF" />
          <stop offset="1" stop-color="#0064E0" />
        </linearGradient>
      </defs>
      {/* Headset Arc */}
      <path d="M18 28C18 20 24 14 32 14C40 14 46 20 46 28V34" stroke="#0091FF" stroke-width="3.5" stroke-linecap="round" />
      {/* Ear Cups */}
      <rect x="15" y="27" width="6" height="12" rx="3" fill="#1E293B" />
      <rect x="43" y="27" width="6" height="12" rx="3" fill="#1E293B" />
      {/* Mic Arm */}
      <path d="M44 36C44 42 38 46 34 46" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="32" cy="46" r="2.5" fill="#10B981" />
      {/* Support Person Avatar */}
      <circle cx="32" cy="26" r="8" fill="url(#helpGrad)" />
      <path d="M18 50C18 43 24 39 32 39C40 39 46 43 46 50" fill="url(#helpGrad)" />
    </svg>
  );
};

export const TravelIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Suitcase 1 (Orange) */}
      <rect x="14" y="32" width="16" height="18" rx="3" fill="#F97316" stroke="#C2410C" stroke-width="1.2" />
      <rect x="19" y="28" width="6" height="4" rx="1" fill="#475569" />
      {/* Suitcase 2 (Blue) */}
      <rect x="28" y="26" width="18" height="24" rx="3" fill="#0284C7" stroke="#0369A1" stroke-width="1.2" />
      <rect x="34" y="22" width="6" height="4" rx="1" fill="#475569" />
      {/* Airplane Flying */}
      <g transform="translate(18, 8) rotate(-15)">
        <path d="M22 6L26 2L30 6L30 18L44 26V30L30 25V36L34 40V42L26 39L18 42V40L22 36V25L8 30V26L22 18V6Z" fill="#FFFFFF" stroke="#0284C7" stroke-width="1.5" stroke-linejoin="round" />
      </g>
    </svg>
  );
};

export const RecognitionIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      <defs>
        <linearGradient id="goldGrad" x1="16" y1="12" x2="48" y2="44" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FDE047" />
          <stop offset="0.5" stop-color="#F59E0B" />
          <stop offset="1" stop-color="#D97706" />
        </linearGradient>
      </defs>
      {/* Ribbons */}
      <path d="M24 36L18 52L26 48L32 52L28 36" fill="#8B5CF6" stroke="#6D28D9" stroke-width="1.2" />
      <path d="M40 36L46 52L38 48L32 52L36 36" fill="#EF4444" stroke="#B91C1C" stroke-width="1.2" />
      {/* Rosette Medal Ribbon Scallops */}
      <circle cx="32" cy="26" r="16" fill="#F97316" />
      {/* Gold Center Medal */}
      <circle cx="32" cy="26" r="13" fill="url(#goldGrad)" stroke="#FFFFFF" stroke-width="1.5" />
      {/* Star in Center */}
      <path d="M32 18L34.5 23.5L40.5 24L36 28L37.5 34L32 30.5L26.5 34L28 28L23.5 24L29.5 23.5L32 18Z" fill="#FFFFFF" />
    </svg>
  );
};

export const TimeSheetsIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Timesheet Document */}
      <rect x="12" y="10" width="40" height="44" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
      {/* Top Blue Header with Clock */}
      <path d="M12 16C12 12.6863 14.6863 10 18 10H46C49.3137 10 52 12.6863 52 16V24H12V16Z" fill="#0284C7" />
      {/* Clock in Header */}
      <circle cx="32" cy="18" r="5.5" fill="#FFFFFF" stroke="#0369A1" stroke-width="1.2" />
      <path d="M32 15V18L34.5 19.5" stroke="#0284C7" stroke-width="1.5" stroke-linecap="round" />
      {/* Rows */}
      <rect x="18" y="28" width="28" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="18" y="34" width="28" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="18" y="40" width="28" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="18" y="46" width="20" height="3" rx="1.5" fill="#CBD5E1" />
    </svg>
  );
};

export const ReportsIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Report Document Sheet */}
      <rect x="14" y="8" width="36" height="48" rx="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
      {/* Pie Chart Top */}
      <circle cx="26" cy="24" r="8" fill="#3B82F6" />
      <path d="M26 24L32 18.5A8 8 0 0 1 34 24H26Z" fill="#F59E0B" />
      <path d="M26 24V16A8 8 0 0 1 32 18.5L26 24Z" fill="#10B981" />
      {/* Bar Chart Bottom */}
      <rect x="36" y="20" width="4" height="12" rx="1.5" fill="#EF4444" />
      <rect x="42" y="16" width="4" height="16" rx="1.5" fill="#3B82F6" />
      {/* Summary lines */}
      <rect x="20" y="38" width="24" height="2.5" rx="1.25" fill="#94A3B8" />
      <rect x="20" y="44" width="18" height="2.5" rx="1.25" fill="#CBD5E1" />
    </svg>
  );
};

export const ReportsBuilderIcon = (props: IconProps) => {
  const s = props.size || 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class={props.class}>
      {/* Blue Canvas */}
      <rect x="12" y="8" width="40" height="48" rx="6" fill="#00A3FF" stroke="#0080FF" stroke-width="1.5" />
      {/* Pie Chart on Canvas */}
      <circle cx="30" cy="26" r="11" fill="#FFFFFF" />
      <path d="M30 26L30 15A11 11 0 0 1 41 26H30Z" fill="#F43F5E" />
      <path d="M30 26L38 18A11 11 0 0 1 41 26H30Z" fill="#F97316" />
      {/* Bar Lines on Canvas */}
      <rect x="18" y="42" width="28" height="3" rx="1.5" fill="#FFFFFF" opacity="0.9" />
      <rect x="18" y="48" width="20" height="3" rx="1.5" fill="#FFFFFF" opacity="0.9" />
      {/* Yellow Drafting Pencil in Front */}
      <g transform="translate(34, 30) rotate(-45)">
        <polygon points="0,0 6,0 6,24 0,24" fill="#FBBF24" stroke="#D97706" stroke-width="1" />
        <polygon points="0,24 6,24 3,30" fill="#FDE68A" stroke="#D97706" stroke-width="1" />
        <polygon points="2,28 4,28 3,30" fill="#1E293B" />
        <rect x="0" y="-4" width="6" height="4" fill="#F43F5E" />
      </g>
    </svg>
  );
};
