import { useRef, useCallback } from 'react';

export function useChartTooltip() {
  const ref = useRef<HTMLDivElement | null>(null);

  const show = useCallback((event: MouseEvent, html: string) => {
    const tt = ref.current;
    if (!tt) return;
    tt.innerHTML = html;
    tt.style.opacity = '1';

    const r = tt.getBoundingClientRect();
    let x = event.clientX + 12;
    let y = event.clientY - 10;
    if (x + r.width > window.innerWidth - 8) x = event.clientX - r.width - 12;
    if (y + r.height > window.innerHeight - 8) y = event.clientY - r.height + 10;
    if (y < 8) y = 8;
    tt.style.left = `${x}px`;
    tt.style.top = `${y}px`;
  }, []);

  const hide = useCallback(() => {
    if (ref.current) ref.current.style.opacity = '0';
  }, []);

  return { ref, show, hide };
}
