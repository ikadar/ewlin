import { useState, useRef, useCallback, useEffect } from 'react';
import { useReportSaisieMutation } from '../../store/api/saisieApi';
import { applyMinToDate } from '../Tile/saisieMath';
import type { SaveState } from './DebounceStatusBar';

const SAVE_DEBOUNCE_MS = 2000;
const REPLAN_COUNTDOWN_S = 60;

export function useDebouncedSave(taskId: string, scheduledStart: string) {
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [reportSaisie] = useReportSaisieMutation();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const replanTimer = useRef<ReturnType<typeof setInterval>>();
  const pendingMin = useRef<number>(0);

  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      clearInterval(replanTimer.current);
    };
  }, []);

  const trigger = useCallback((estimatedEndMin: number) => {
    pendingMin.current = estimatedEndMin;
    clearTimeout(saveTimer.current);
    clearInterval(replanTimer.current);
    setSaveState({ kind: 'pending-save' });

    saveTimer.current = setTimeout(async () => {
      const iso = applyMinToDate(scheduledStart, pendingMin.current);

      try {
        await reportSaisie({ taskId, estimatedEndTime: iso }).unwrap();
        setSaveState({ kind: 'saved' });

        setTimeout(() => {
          let countdown = REPLAN_COUNTDOWN_S;
          setSaveState({ kind: 'pending-replan', countdown });
          replanTimer.current = setInterval(() => {
            countdown -= 1;
            if (countdown <= 0) {
              clearInterval(replanTimer.current);
              setSaveState({ kind: 'replanned' });
              setTimeout(() => setSaveState({ kind: 'idle' }), 2000);
            } else {
              setSaveState({ kind: 'pending-replan', countdown });
            }
          }, 1000);
        }, 1200);
      } catch {
        setSaveState({ kind: 'idle' });
      }
    }, SAVE_DEBOUNCE_MS);
  }, [taskId, scheduledStart, reportSaisie]);

  return { saveState, trigger };
}
