/** Iconos ilustrados de cada paso: terracota con una hoja oliva. */
type P = { className?: string };
const Leaf = () => (
  <path d="M40 46c0-7 5-12 13-13-1 8-6 13-13 13z" fill="#5f7f3e" stroke="#5f7f3e" strokeWidth="1" strokeLinejoin="round" />
);
const wrap = (children: React.ReactNode, className?: string) => (
  <svg viewBox="0 0 56 56" className={className} fill="none" stroke="#e0562f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
export const HouseIcon = ({ className }: P) =>
  wrap(<><path d="M10 27 28 12l18 15" /><path d="M15 24v20h26V24" fill="#fbe9e1" /><path d="M24 44V32h8v12" /><Leaf /></>, className);
export const PinIcon = ({ className }: P) =>
  wrap(<><path d="M28 48s-14-13-14-24a14 14 0 0 1 28 0c0 11-14 24-14 24z" fill="#fbe9e1" /><circle cx="28" cy="24" r="5" fill="#fff" /><Leaf /></>, className);
export const CartBigIcon = ({ className }: P) =>
  wrap(<><path d="M8 12h6l5 22h20l4-15H17" fill="#fbe9e1" /><circle cx="22" cy="42" r="3" fill="#e0562f" /><circle cx="36" cy="42" r="3" fill="#e0562f" /><Leaf /></>, className);
export const StoreBigIcon = ({ className }: P) =>
  wrap(<><path d="M10 22 13 12h30l3 10" fill="#fbe9e1" /><path d="M10 22a4.5 4.5 0 0 0 9 0 4.5 4.5 0 0 0 9 0 4.5 4.5 0 0 0 9 0 4.5 4.5 0 0 0 9 0" /><path d="M13 26v18h30V26M24 44V34h8v10" /><Leaf /></>, className);
export const LeafBigIcon = ({ className }: P) =>
  wrap(<><path d="M14 44C14 24 26 12 46 10c-2 20-14 32-32 34z" fill="#e9f0df" stroke="#5f7f3e" /><path d="M14 44c8-10 16-18 26-24" stroke="#5f7f3e" /></>, className);
export const TargetIcon = ({ className }: P) =>
  wrap(<><circle cx="28" cy="28" r="18" fill="#fbe9e1" /><circle cx="28" cy="28" r="10" fill="#fff" /><circle cx="28" cy="28" r="3" fill="#e0562f" /><path d="M28 10V4M46 28h6" /><Leaf /></>, className);
