/**
 * CustomTimeStepper — escape hatch from the QuickActions row. Lets the
 * operator type or step a custom finish time when none of the presets fit.
 *
 * Granularity: 15 min (snaps on commit). Lower bound: the task start
 * (you cannot finish before starting). Past times are legitimate when
 * reporting a completion after the fact.
 *
 * UX:
 *   - Local controlled `text` state so the user can type freely
 *   - Re-syncs to the canonical `currentTimeMin` whenever the parent updates
 *     it (e.g., quick button click)
 *   - Commits on blur or Enter — parses, snaps, clamps, calls onChange
 *   - Reverts to the canonical value on invalid input
 */
import { useEffect, useState, type ReactElement, type KeyboardEvent } from 'react';
import { fmtTimeMin, parseTimeStr, snapTo15, clampMin } from './timeUtils';

export interface CustomTimeStepperProps {
  currentTimeMin: number;
  lowerBoundMin: number;
  upperBoundMin?: number;
  onChange: (timeMin: number) => void;
}

const DEFAULT_UPPER = 23 * 60 + 45;

export function CustomTimeStepper({
  currentTimeMin,
  lowerBoundMin,
  upperBoundMin = DEFAULT_UPPER,
  onChange,
}: CustomTimeStepperProps): ReactElement {
  const [text, setText] = useState(fmtTimeMin(currentTimeMin));

  // Re-sync text when the canonical value changes (e.g., a quick button is pressed).
  useEffect(() => {
    setText(fmtTimeMin(currentTimeMin));
  }, [currentTimeMin]);

  const step = (delta: number) => {
    const next = clampMin(currentTimeMin + delta, lowerBoundMin, upperBoundMin);
    onChange(next);
  };

  const commit = () => {
    const parsed = parseTimeStr(text);
    if (parsed == null) {
      setText(fmtTimeMin(currentTimeMin));
      return;
    }
    const next = clampMin(snapTo15(parsed), lowerBoundMin, upperBoundMin);
    onChange(next);
    // useEffect above will re-sync the text on the next render.
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setText(fmtTimeMin(currentTimeMin));
      e.currentTarget.blur();
    }
  };

  return (
    <div className="pm-custom">
      <span className="pm-custom-label">Ou heure personnalisée&nbsp;:</span>
      <div className="pm-custom-controls">
        <button
          type="button"
          className="pm-custom-step"
          onClick={() => step(-15)}
          aria-label="−15 min"
          data-testid="pm-custom-minus"
        >−</button>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          data-testid="pm-custom-input"
        />
        <button
          type="button"
          className="pm-custom-step"
          onClick={() => step(+15)}
          aria-label="+15 min"
          data-testid="pm-custom-plus"
        >+</button>
      </div>
    </div>
  );
}
