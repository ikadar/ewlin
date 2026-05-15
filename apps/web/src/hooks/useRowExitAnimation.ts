import { useState, useCallback } from 'react';

export interface UseRowExitAnimationResult {
  exitingIds: Set<string>;
  collapsingIds: Set<string>;
  triggerExit: (id: string) => void;
}

export function useRowExitAnimation(
  onCommit: (id: string) => void,
  fadeDuration = 1000,
  collapseDuration = 300,
): UseRowExitAnimationResult {
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [collapsingIds, setCollapsingIds] = useState<Set<string>>(new Set());

  const triggerExit = useCallback((id: string) => {
    setExitingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setExitingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      setCollapsingIds(prev => new Set(prev).add(id));
      setTimeout(() => {
        setCollapsingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        onCommit(id);
      }, collapseDuration);
    }, fadeDuration);
  }, [onCommit, fadeDuration, collapseDuration]);

  return { exitingIds, collapsingIds, triggerExit };
}
