import { useState, useRef, useEffect, useCallback } from 'react';

interface UseTooltipDelayOptions {
  showDelay?: number;
  hideDelay?: number;
}

interface UseTooltipDelayResult {
  isVisible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function useTooltipDelay(options: UseTooltipDelayOptions = {}): UseTooltipDelayResult {
  const { showDelay = 500, hideDelay = 0 } = options;
  const [isVisible, setIsVisible] = useState(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const onMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (showDelay <= 0) {
      setIsVisible(true);
    } else {
      showTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, showDelay);
    }
  }, [showDelay]);

  const onMouseLeave = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, hideDelay);
    } else {
      setIsVisible(false);
    }
  }, [hideDelay]);

  return { isVisible, onMouseEnter, onMouseLeave };
}
