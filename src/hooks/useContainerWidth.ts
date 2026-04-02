import { useLayoutEffect, useRef, useState } from "react";

export function useContainerWidth(
  minWidth = 0,
): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (w: number) => setWidth(Math.max(minWidth, w));
    update(el.offsetWidth);
    let rafId: number;
    const ro = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() =>
        update(entries[entries.length - 1].contentRect.width),
      );
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [minWidth]);

  return [ref, width];
}
