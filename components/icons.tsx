/** Iconos de línea (SVG inline, 24px). */
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };

export const HomeIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h5v-6h4v6h5V10" /></svg>
);
export const CalendarIcon = ({ className }: P) => (
  <svg {...base} className={className}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const CartIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></svg>
);
export const SearchIcon = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
);
export const StarIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" /></svg>
);
export const HeartIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
);
export const StoreIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 10 5 4h14l1 6" /><path d="M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" /><path d="M5 12v8h14v-8M10 20v-5h4v5" /></svg>
);
export const SettingsIcon = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const HelpIcon = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14" /><circle cx="12" cy="17" r=".7" fill="currentColor" /></svg>
);
export const ChevronRight = ({ className }: P) => (
  <svg {...base} className={className}><path d="m9 6 6 6-6 6" /></svg>
);
export const ChevronLeft = ({ className }: P) => (
  <svg {...base} className={className}><path d="m15 6-6 6 6 6" /></svg>
);
export const ChevronDown = ({ className }: P) => (
  <svg {...base} className={className}><path d="m6 9 6 6 6-6" /></svg>
);
export const ArrowRight = ({ className }: P) => (
  <svg {...base} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const PiggyIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 12a6 6 0 0 1 6-6h5a5 5 0 0 1 5 5v1l2 1v3l-2 .5a5 5 0 0 1-3 3v2h-3v-2h-4v2H7v-3a6 6 0 0 1-3-5z" /><circle cx="16" cy="11" r=".8" fill="currentColor" /></svg>
);
export const ChartIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="m5 12 4.5 4.5L19 7" /></svg>
);
export const PlusIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const LeafIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-4 6-7 10-9" /></svg>
);
