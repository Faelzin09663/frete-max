import type { ReactNode } from "react";

export type IconName =
  | "cargas" | "painel" | "pin" | "truck" | "user" | "arrow" | "image" | "paste" | "clock" | "fuel"
  | "trash" | "map" | "check" | "alert" | "bolt" | "plus" | "search" | "x" | "chevron" | "calc" | "cloud" | "road"
  | "edit" | "download" | "upload" | "wifi-off" | "trophy" | "compare";

const PATHS: Record<IconName, ReactNode> = {
  cargas: (<><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>),
  painel: (<><path d="M4 20h16" /><path d="M7 20v-7" /><path d="M12 20V5" /><path d="M17 20v-10" /></>),
  pin: (<><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  truck: (<><rect x="2" y="6" width="11" height="10" rx="1.5" /><path d="M13 9h4l4 4v3h-8" /><circle cx="6.5" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  arrow: (<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-9 9" /></>),
  paste: (<><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  fuel: (<><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M3 21h12" /><path d="M14 10h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V8l-3-3" /><path d="M6 8h6" /></>),
  trash: (<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6" /><path d="M14 11v6" /></>),
  map: (<><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14" /><path d="M15 6v14" /></>),
  check: (<path d="M5 12l5 5L20 7" />),
  alert: (<><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5" /><path d="M12 18v.01" /></>),
  bolt: (<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
  x: (<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>),
  chevron: (<path d="M6 9l6 6 6-6" />),
  calc: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8" /><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>),
  cloud: (<path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7z" />),
  road: (<><path d="M8 3L4 21" /><path d="M16 3l4 18" /><path d="M12 4v3M12 11v3M12 18v3" /></>),
  edit: (<><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="M15 5l4 4" /></>),
  download: (<><path d="M12 5v10" /><path d="M7 12l5 5 5-5" /><path d="M5 20h14" /></>),
  upload: (<><path d="M12 15V5" /><path d="M7 10l5-5 5 5" /><path d="M5 20h14" /></>),
  "wifi-off": (<><path d="M2 8.82a15 15 0 0 1 4.17-2.65" /><path d="M10.66 5c4.01-.36 8.14.93 11.34 3.82" /><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" /><path d="M5 12.86a10 10 0 0 1 5.17-2.86" /><path d="M10.71 16.3a5 5 0 0 1 5.09.37" /><circle cx="12" cy="20" r="1" /><path d="M2 2l20 20" /></>),
  trophy: (<><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" /><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" /><path d="M6 3h12v7a6 6 0 0 1-12 0V3z" /><path d="M9 21h6" /><path d="M12 16v5" /></>),
  compare: (<><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M12 3v18" /></>),
};

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="10" fill="#ffb800" />
      <path d="M8 22c6 0 3-9 9-9 3 0 3 3 7 3" fill="none" stroke="#231800" strokeWidth="3" strokeLinecap="round" />
      <circle cx="8" cy="22" r="2.6" fill="#231800" />
      <circle cx="24" cy="16" r="2.6" fill="#231800" />
    </svg>
  );
}
