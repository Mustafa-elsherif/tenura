// Minimal inline icon set (stroke icons, currentColor). No icon-font dependency.
type P = { size?: number; strokeWidth?: number };
const base = (size = 20, sw = 1.8) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconGrid = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);
export const IconUsers = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.2" /><path d="M20 19v-1.2a3.3 3.3 0 0 0-2.6-3.2" /><path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" /></svg>
);
export const IconChart = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 19V5" /><path d="M4 19h16" /><rect x="7" y="11" width="3" height="5" rx="1" /><rect x="12.5" y="8" width="3" height="8" rx="1" /><rect x="18" y="13" width="3" height="3" rx="1" /></svg>
);
export const IconTarget = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></svg>
);
export const IconUpload = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
);
export const IconAlert = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
);
export const IconPulse = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>
);
export const IconGauge = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 14 15 9" /><circle cx="12" cy="14" r="1.2" /><path d="M4 17a8 8 0 1 1 16 0" /></svg>
);
export const IconSun = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconMoon = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
);
export const IconMenu = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const IconClose = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconDownload = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 4v11" /><path d="m8 11 4 4 4-4" /><path d="M4 19h16" /></svg>
);
export const IconArrow = ({ size, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
