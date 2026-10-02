import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

type Tip = { content: ReactNode; x: number; y: number } | null;
let tip: Tip = null;
const subs = new Set<() => void>();
const set = (t: Tip) => {
  tip = t;
  subs.forEach((f) => f());
};

let pending: number | null = null;
let lastPos = { x: 0, y: 0 };

/** Spread onto any element to give it a hover tooltip (shown after a short delay). */
export function tipProps(content: ReactNode) {
  return {
    onMouseEnter: (e: React.MouseEvent) => {
      lastPos = { x: e.clientX, y: e.clientY };
      if (pending) clearTimeout(pending);
      pending = window.setTimeout(() => set({ content, ...lastPos }), 380);
    },
    onMouseMove: (e: React.MouseEvent) => {
      lastPos = { x: e.clientX, y: e.clientY };
      if (tip) set({ content, ...lastPos });
    },
    onMouseLeave: () => {
      if (pending) clearTimeout(pending);
      pending = null;
      set(null);
    },
    onMouseDown: () => {
      if (pending) clearTimeout(pending);
      pending = null;
      set(null);
    },
  };
}

export function hideTip() {
  set(null);
}

export function TooltipLayer() {
  const t = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => tip,
  );
  const [size, setSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (!t) return null;
  const left = Math.min(t.x + 16, size.w - 340);
  const top = t.y > size.h / 2 ? undefined : t.y + 16;
  const bottom = t.y > size.h / 2 ? size.h - t.y + 12 : undefined;
  return (
    <div className="tooltip" style={{ left, top, bottom }}>
      {t.content}
    </div>
  );
}
