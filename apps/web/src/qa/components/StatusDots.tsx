/**
 * Status Dots Component
 *
 * Shows filled/empty dots representing test status.
 * - Filled green: OK
 * - Filled amber: Partial
 * - Filled red: KO
 * - Empty: Untested
 */

import type { PriorityProgress } from '../types';

interface StatusDotsProps {
  progress: PriorityProgress;
}

export function StatusDots({ progress }: StatusDotsProps) {
  const { ok, partial, ko, untested } = progress;
  const dots: JSX.Element[] = [];

  // Add OK dots
  for (let i = 0; i < ok; i++) {
    dots.push(
      <span key={`ok-${i}`} className="w-2 h-2 rounded-full bg-emerald-500" />
    );
  }

  // Add partial dots
  for (let i = 0; i < partial; i++) {
    dots.push(
      <span key={`partial-${i}`} className="w-2 h-2 rounded-full bg-amber-500" />
    );
  }

  // Add KO dots
  for (let i = 0; i < ko; i++) {
    dots.push(
      <span key={`ko-${i}`} className="w-2 h-2 rounded-full bg-red-500" />
    );
  }

  // Add untested dots
  for (let i = 0; i < untested; i++) {
    dots.push(
      <span
        key={`untested-${i}`}
        className="w-2 h-2 rounded-full border border-zinc-600"
      />
    );
  }

  return <div className="flex items-center gap-0.5">{dots}</div>;
}
