import { useState, useEffect } from 'react';

const GRACE_DURATION_S = 300;

export function useGraceCountdown(scheduledEnd: string): number {
  const endMs = new Date(scheduledEnd).getTime();
  const graceEndMs = endMs + GRACE_DURATION_S * 1000;

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((graceEndMs - Date.now()) / 1000))
  );

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.floor((graceEndMs - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [graceEndMs]);

  return remaining;
}

export function fmtGraceTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
