export { useDropValidation, quickValidate } from './useDropValidation';
export type { DropValidationParams, DropValidationResult } from './useDropValidation';

export { useVirtualScroll, isAssignmentVisible, getVisibleDates } from './useVirtualScroll';
export type { VirtualScrollConfig, VirtualScrollResult } from './useVirtualScroll';

export { useLazyLoadSuggestions } from './useLazyLoadSuggestions';
export type { UseLazyLoadSuggestionsResult } from './useLazyLoadSuggestions';

export { useSessionLearning } from './useSessionLearning';
export type { SessionLearningState, SessionLearningActions } from './useSessionLearning';

// NOTE: useToast is intentionally NOT re-exported here.
// It depends on AutoRecomputeContext, which itself imports from
// '../hooks' — re-exporting here closes a circular module cycle
// that crashes the bundle with a TDZ error at load time. Import
// the hook directly from './useToast' instead.

export { useDebouncedValue } from './useDebouncedValue';

export { useTooltipDelay } from './useTooltipDelay';

export { useHasPermission } from './useHasPermission';

export { useMassUnschedule } from './useMassUnschedule';
export type { MassUnscheduleState } from './useMassUnschedule';

export { useAutoRecompute } from './useAutoRecompute';

export { useComputeToaster } from './useComputeToaster';
export type { ComputeToast, ComputeToastType, ComputeToastAction, ComputeToastMetric } from './useComputeToaster';

export { useHoverCrosslink, pulseTaskTiles } from './useHoverCrosslink';
export type { HoverCrosslinkProps } from './useHoverCrosslink';

// NOTE: do NOT re-export useLiftAndRecompute from this barrel.
// It depends on AutoRecomputeContext, which itself imports from
// '../hooks' — re-exporting here closes a circular module cycle
// that crashes the bundle with a TDZ error at load time. Import
// the hook directly from './useLiftAndRecompute' instead.
