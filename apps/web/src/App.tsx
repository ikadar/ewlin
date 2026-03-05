import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, timeToYPosition, TopNavBar, DEFAULT_PIXELS_PER_HOUR, TileContextMenu, JcfModal, JcfJobHeader, generateJobId, JcfElementsTable } from './components';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorState } from './components/ErrorState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalToast } from './components/GlobalToast';
import { MaintenanceState } from './components/MaintenanceState';
import type { JcfElement, ElementStatusUpdate } from './components';
import { DEFAULT_ELEMENT } from './components';
import { JcfTemplateEditorModal } from './components/JcfTemplateEditorModal';
import type { TemplateEditorData } from './components/JcfTemplateEditorModal';
import type { JcfTemplate } from '@flux/types';
import type { SchedulingGridHandle, TaskMarker } from './components';
import { snapToGrid, yPositionToTime, SNAP_INTERVAL_MINUTES } from './components/DragPreview';
import { updateSnapshot } from './mock';
import { shouldUseFixture } from './mock/testFixtures';
import { useGetSnapshotQuery, scheduleApi, useAssignTaskMutation, useRescheduleTaskMutation, useUnassignTaskMutation, useToggleCompletionMutation, useCompactStationMutation, useCreateJobMutation, useUpdateJobMutation, useDeleteJobMutation, useUpdateElementStatusMutation, useCreateTemplateMutation, useUpdateTemplateMutation, useAppSelector, selectIsServiceUnavailable } from './store';
import { shouldUseMockMode } from './store/api/baseApi';
import { Toast } from './components/Toast';
import { useToast } from './hooks';
import { getErrorMessage } from './store/api/errorNormalization';
import { useAppDispatch } from './store';
import { fluxApi } from './store/api/fluxApi';
import { applySwap, getAvailableTaskForStation, getLastUnscheduledTask, getPredecessorConstraint, getSuccessorConstraint, getDryingTimeInfo, getOutsourcingTimeInfo, getPrimaryValidationMessage, getTasksForJob, getJobIdForTask } from './utils';
import { useDropValidation } from './hooks/useDropValidation';
import type { DryingTimeInfo, OutsourcingTimeInfo } from './utils';
import type { CompactHorizon } from './utils';
import {
  PickStateProvider,
  PickPreview,
  usePickState,
  PICK_CURSOR_OFFSET_Y,
} from './pick';
import type { Task, Job, InternalTask, TaskAssignment, Station, StationCategory, ProposedAssignment } from '@flux/types';
import { validateAssignment } from '@flux/schedule-validator';
import { calculateReturnDate } from './utils/outsourcingCalculation';
import { isLastTaskOfJob } from './utils/taskHelpers';
import { transformJcfToRequest, transformJcfElementToRequest } from './api';
import { getDefaultCategoryWidth } from './utils/tileLabelResolver';

// Multi-day grid starts at 00:00 (midnight) for each day
const START_HOUR = 0;

/**
 * Test workflow for E2E testing (v0.4.22).
 * Used when a test fixture is active to verify workflow-guided suggestions.
 * @see docs/releases/v0.4.22-jcf-sequence-workflow-suggestions.md
 */
const TEST_SEQUENCE_WORKFLOWS = [
  [
    'Presses Offset', // Step 0: Print (matches fixture category name)
    'Massicots', // Step 1: Cutting
    'Plieuses', // Step 2: Folding
    'Conditionnement', // Step 3: Packaging
  ],
];
// v0.3.46: Restored to 365 days with virtual scrolling for performance
const DAY_COUNT = 365;

// ============================================================================
// v0.4.29: Layout dimensions helper
// Calculates actual pixel values based on root font-size (rem → px conversion)
// ============================================================================

/**
 * Get layout dimensions in pixels based on current root font-size.
 * Tailwind uses rem units, so dimensions scale with root font-size.
 * Default root font-size is 13px (v0.4.29: UI Scale Harmonization).
 *
 * @returns Object with computed pixel values for layout dimensions
 */
function getLayoutDimensions(): {
  stationWidth: number;  // w-60 = 15rem
  gap: number;           // gap-3 = 0.75rem
  paddingLeft: number;   // px-3 = 0.75rem
  timelineWidth: number; // w-12 = 3rem
} {
  // Get root font-size (defaults to 16px in browsers, 13px in our app)
  const rootFontSize = typeof window !== 'undefined'
    ? parseFloat(getComputedStyle(document.documentElement).fontSize)
    : 13; // SSR fallback

  return {
    stationWidth: 15 * rootFontSize,    // w-60 = 15rem
    gap: 0.75 * rootFontSize,           // gap-3 = 0.75rem
    paddingLeft: 0.75 * rootFontSize,   // px-3 = 0.75rem
    timelineWidth: 3 * rootFontSize,    // w-12 = 3rem
  };
}

// ============================================================================
// v1: Tirage display mode — variable column width support
// ============================================================================

/**
 * Calculate a station's X offset and width, accounting for variable column widths.
 * Uses getLayoutDimensions().stationWidth as the default (w-60 = 15rem, font-size-aware).
 * Column width is mode-independent: applies in both Produit and Tirage modes.
 */
function getStationXOffset(
  stationIndex: number,
  stations: import('@flux/types').Station[],
  catMap: Map<string, import('@flux/types').StationCategory>,
): { x: number; stationWidth: number } {
  const { gap, paddingLeft, stationWidth: defaultWidth } = getLayoutDimensions();
  let x = paddingLeft;
  for (let i = 0; i < stationIndex; i++) {
    const cat = catMap.get(stations[i].categoryId);
    const w = cat?.columnWidth ?? (cat ? getDefaultCategoryWidth(cat.name) : null) ?? defaultWidth;
    x += w + gap;
  }
  const targetCat = catMap.get(stations[stationIndex].categoryId);
  const stationWidth = targetCat?.columnWidth ?? (targetCat ? getDefaultCategoryWidth(targetCat.name) : null) ?? defaultWidth;
  return { x, stationWidth };
}

// ============================================================================
// Keyboard shortcut handlers (extracted to reduce cognitive complexity S3776)
// ============================================================================

interface KeyboardContext {
  selectedJobId: string | null;
  isQuickPlacementMode: boolean;
  isJcfOpen: boolean;
  orderedJobIds: string[];
  selectedJob: Job | null;
  gridRef: React.RefObject<SchedulingGridHandle | null>;
  pixelsPerHour: number;
  gridStartDate: Date;
  setIsAltPressed: (v: boolean) => void;
  setSelectedJobId: (id: string | null) => void;
  setIsQuickPlacementMode: (fn: (prev: boolean) => boolean) => void;
  setQuickPlacementHover: (v: { stationId: string | null; y: number; snappedY: number }) => void;
}

function handleAltKey(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key === 'Alt') {
    e.preventDefault();
    ctx.setIsAltPressed(true);
    return true;
  }
  return false;
}

function handleQuickPlacementKeyboard(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.altKey && e.code === 'KeyQ') {
    e.preventDefault();
    if (ctx.selectedJobId) {
      const wasActive = ctx.isQuickPlacementMode;
      ctx.setIsQuickPlacementMode((prev) => !prev);
      ctx.setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
      if (wasActive) {
        ctx.setSelectedJobId(null);
      }
    }
    return true;
  }
  return false;
}

function handleEscapeQuickPlacement(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key === 'Escape' && ctx.isQuickPlacementMode) {
    ctx.setIsQuickPlacementMode(() => false);
    ctx.setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
    ctx.setSelectedJobId(null);
    return true;
  }
  return false;
}

// v0.3.54: Handle ESC to cancel pick
function handleEscapePick(e: KeyboardEvent, cancelPick: () => void, isPicking: boolean): boolean {
  if (e.key === 'Escape' && isPicking) {
    cancelPick();
    return true;
  }
  return false;
}

function handleEscapeCloseJob(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key === 'Escape' && ctx.selectedJobId && !ctx.isJcfOpen) {
    ctx.setSelectedJobId(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    return true;
  }
  return false;
}

function handleJobNavigation(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) {
    return false;
  }
  e.preventDefault();
  if (ctx.orderedJobIds.length === 0) return true;

  const direction = e.key === 'ArrowUp' ? -1 : 1;
  if (!ctx.selectedJobId) {
    ctx.setSelectedJobId(ctx.orderedJobIds[0]);
    return true;
  }

  const currentIndex = ctx.orderedJobIds.indexOf(ctx.selectedJobId);
  const newIndex = (currentIndex + direction + ctx.orderedJobIds.length) % ctx.orderedJobIds.length;
  ctx.setSelectedJobId(ctx.orderedJobIds[newIndex]);
  return true;
}

function handleJumpToDeparture(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.altKey && e.code === 'KeyD') {
    e.preventDefault();
    if (ctx.selectedJob?.workshopExitDate && ctx.gridRef.current) {
      const departureDate = new Date(ctx.selectedJob.workshopExitDate);
      const y = timeToYPosition(departureDate, START_HOUR, ctx.pixelsPerHour, ctx.gridStartDate);
      const viewportHeight = ctx.gridRef.current.getViewportHeight();
      const scrollTarget = Math.max(0, y - viewportHeight + 100);
      ctx.gridRef.current.scrollToY(scrollTarget);
    }
    return true;
  }
  return false;
}

function handleJumpToToday(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if (e.key === 'Home' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (ctx.gridRef.current) {
      const now = new Date();
      const y = timeToYPosition(now, START_HOUR, ctx.pixelsPerHour, ctx.gridStartDate);
      const viewportHeight = ctx.gridRef.current.getViewportHeight();
      const scrollTarget = Math.max(0, y - viewportHeight / 2);
      ctx.gridRef.current.scrollToY(scrollTarget);
    }
    return true;
  }
  return false;
}

function handlePageScroll(e: KeyboardEvent, ctx: KeyboardContext): boolean {
  if ((e.key === 'PageUp' || e.key === 'PageDown') && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (ctx.gridRef.current) {
      const oneDayPixels = 24 * ctx.pixelsPerHour;
      const direction = e.key === 'PageUp' ? -1 : 1;
      ctx.gridRef.current.scrollByY(direction * oneDayPixels);
    }
    return true;
  }
  return false;
}

function handleDisplayModeToggle(
  e: KeyboardEvent,
  setDisplayMode: (updater: (prev: 'produit' | 'tirage') => 'produit' | 'tirage') => void,
): boolean {
  if (e.key !== 'a' && e.key !== 'A') return false;
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return false;
  setDisplayMode((prev) => (prev === 'produit' ? 'tirage' : 'produit'));
  return true;
}

/**
 * Derive poste presets from snapshot stations and categories.
 * Station names have spaces removed (e.g., "Komori G40" → "KomoriG40").
 */
function stationsToPostes(
  stations: Station[],
  categories: StationCategory[]
): Array<{ name: string; category: string }> {
  const catNameMap = new Map(categories.map(c => [c.id, c.name]));
  return stations.map(s => ({
    name: s.name.replace(/\s+/g, ''),
    category: catNameMap.get(s.categoryId) ?? '',
  }));
}

// Inner App component that uses drag state context
function AppContent() {
  // v0.4.37: RTK Query for snapshot data
  // v0.5.1: Added loading and error state handling
  const dispatch = useAppDispatch();
  const {
    data: snapshotData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSnapshotQuery();

  // v0.5.7: Global error handling - service unavailable state
  const isServiceUnavailable = useAppSelector(selectIsServiceUnavailable);

  // Helper to trigger refetch after local updateSnapshot calls
  // This bridges the gap between the mock layer and RTK Query cache
  const invalidateSnapshot = useCallback(() => {
    dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
  }, [dispatch]);

  // Memoized snapshot with loading guard
  // snapshotData may be undefined during loading or error states
  const snapshot = useMemo(
    () =>
      snapshotData ?? {
        version: 0,
        generatedAt: new Date().toISOString(),
        stations: [],
        categories: [],
        groups: [],
        providers: [],
        jobs: [],
        elements: [],
        tasks: [],
        assignments: [],
        conflicts: [],
        lateJobs: [],
      },
    [snapshotData],
  );

  // Derive poste presets from snapshot stations (single source of truth)
  const snapshotPostes = useMemo(
    () => stationsToPostes(snapshot.stations, snapshot.categories),
    [snapshot.stations, snapshot.categories],
  );

  // v0.5.2: RTK Query mutations for assignment operations
  const [assignTask] = useAssignTaskMutation();
  const [rescheduleTask] = useRescheduleTaskMutation();
  const [unassignTask] = useUnassignTaskMutation();
  const [toggleCompletion] = useToggleCompletionMutation();
  const [compactStation] = useCompactStationMutation();
  const [createJob] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();
  const [deleteJob] = useDeleteJobMutation();
  const [updateElementStatus] = useUpdateElementStatusMutation();
  const [createTemplate] = useCreateTemplateMutation();
  const [updateTemplate] = useUpdateTemplateMutation();

  // v0.5.2: Toast notifications for errors
  const { toast, showToast, hideToast } = useToast();

  // v0.4.38: URL-based job selection with React Router
  // Use local state for fast UI updates, sync URL silently
  const { jobId: urlJobId } = useParams<{ jobId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Local state for immediate UI response
  const [selectedJobId, setSelectedJobIdLocal] = useState<string | null>(() => {
    // Initialize from URL on mount
    if (location.pathname === '/job/new') return null;
    return urlJobId ?? null;
  });

  // Sync URL → state when URL changes (browser back/forward, direct navigation)
  useEffect(() => {
    const urlSelectedJobId = location.pathname === '/job/new' ? null : (urlJobId ?? null);
    if (urlSelectedJobId !== selectedJobId) {
      setSelectedJobIdLocal(urlSelectedJobId);
    }
  }, [urlJobId, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrapper that updates local state (fast) and URL silently (no React Router re-render)
  const setSelectedJobId = useCallback((jobId: string | null) => {
    setSelectedJobIdLocal(jobId); // Immediate UI update
    // Update URL silently using History API - no React Router re-render
    const newUrl = jobId ? `/job/${jobId}` : '/';
    window.history.replaceState(null, '', newUrl);
  }, []);

  // v0.3.46: Use deferred value for grid to keep sidebar responsive during selection
  const deferredSelectedJobId = useDeferredValue(selectedJobId);

  // v0.3.54: Pick & Place state
  // v0.3.57: Added assignmentId for grid picks (reschedule)
  const { state: pickState, actions: pickActions } = usePickState();
  const { pickedTask, pickedJob, isPicking, targetStationId: pickTargetStationId, pickSource, assignmentId: pickedAssignmentId } = pickState;

  // Alt key state for precedence bypass
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Quick Placement Mode state
  const [isQuickPlacementMode, setIsQuickPlacementMode] = useState(false);
  const [quickPlacementHover, setQuickPlacementHover] = useState<{
    stationId: string | null;
    y: number;
    snappedY: number;
  }>({ stationId: null, y: 0, snappedY: 0 });

  // Display mode state (Produit / Tirage)
  const [displayMode, setDisplayMode] = useState<'produit' | 'tirage'>('produit');

  // v0.3.54: Pick & Place validation state
  const [pickValidation, setPickValidation] = useState<{
    scheduledStart: string | null;
    ringState: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass';
    message: string | null;
    debugConflicts: Array<{ type: string; message?: string }>;
  }>({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });

  // Compact station loading state
  const [compactingStationId, setCompactingStationId] = useState<string | null>(null);

  // Global timeline compact loading state (v0.3.35)
  const [isCompactingTimeline, setIsCompactingTimeline] = useState(false);

  // Zoom state (v0.3.34)
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PIXELS_PER_HOUR);

  // v0.3.58: Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    assignmentId: string;
    isCompleted: boolean;
  } | null>(null);

  // v0.4.38: JCF modal state derived from URL
  // Modal opens when URL is /job/new
  const isJcfModalOpen = location.pathname === '/job/new';
  // Remember which job was selected before JCF opened, so we can restore on close
  const preJcfSelectedJobIdRef = useRef<string | null>(null);
  // v0.4.7: JCF form state (lifted from JcfJobHeader)
  const [jcfJobId, setJcfJobId] = useState('');
  const [jcfIntitule, setJcfIntitule] = useState('');
  const [jcfQuantity, setJcfQuantity] = useState('');
  const [jcfShipperId, setJcfShipperId] = useState('');
  const [jcfDeadline, setJcfDeadline] = useState('');
  // v0.4.8: Client and Template autocomplete state
  const [jcfClient, setJcfClient] = useState('');
  const [jcfTemplate, setJcfTemplate] = useState('');
  // v0.4.9: Elements table state
  const [jcfElements, setJcfElements] = useState<JcfElement[]>([{ ...DEFAULT_ELEMENT }]);

  // v0.5.13b: Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  // v0.4.31: Sequence workflow from selected template (per-element, template-free mode when empty)
  const [sequenceWorkflows, setSequenceWorkflows] = useState<string[][]>([]);

  // v0.4.34: Template editor modal state
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isTemplateSaving, setIsTemplateSaving] = useState(false);

  // v0.4.30: Save validation ref
  const jcfSaveAttemptRef = useRef<(() => boolean) | null>(null);
  const [isJcfSaving, setIsJcfSaving] = useState(false);
  // v0.4.33: API error state
  const [jcfSaveError, setJcfSaveError] = useState<string | null>(null);

  // v0.4.33: Save job via API (v0.5.4: migrated to RTK Query mutation)
  // v0.5.13b: Supports both create and update modes
  const handleJcfSave = useCallback(async () => {
    // In edit mode, skip JCF validation (elements table not editable)
    if (!isEditMode) {
      if (!jcfSaveAttemptRef.current) return;
      const isValid = jcfSaveAttemptRef.current();
      if (!isValid) return;
    }

    setIsJcfSaving(true);
    setJcfSaveError(null);

    try {
      if (isEditMode && editingJobId) {
        // v0.5.13b: Update existing job (metadata + elements)
        await updateJob({
          jobId: editingJobId,
          body: {
            reference: jcfJobId,
            client: jcfClient,
            description: jcfIntitule,
            workshopExitDate: jcfDeadline,
            elements: jcfElements.map(transformJcfElementToRequest),
            ...(jcfQuantity ? { quantity: parseInt(jcfQuantity, 10) } : {}),
            shipperId: jcfShipperId || null,
          },
        }).unwrap();
      } else {
        // Create new job
        const request = transformJcfToRequest(
          jcfJobId,
          jcfClient,
          jcfIntitule,
          jcfDeadline,
          jcfElements,
          jcfQuantity,
          jcfShipperId || undefined,
        );
        await createJob(request).unwrap();
      }

      // Success: close modal and reset form
      // Cache invalidation: Snapshot is automatic via invalidatesTags, Flux needs explicit invalidation
      setIsJcfSaving(false);
      dispatch(fluxApi.util.invalidateTags(['FluxJobs']));
      // Navigate back: Flux route if opened from Flux, otherwise scheduler root
      const fromRoute = (location.state as { from?: string } | null)?.from;
      navigate(fromRoute?.startsWith('/flux') ? fromRoute : '/', { replace: true });
      setJcfClient('');
      setJcfTemplate('');
      setJcfIntitule('');
      setJcfQuantity('');
      setJcfShipperId('');
      setJcfDeadline('');
      setJcfElements([{ ...DEFAULT_ELEMENT }]);
      setSequenceWorkflows([]); // v0.4.31: Reset workflow on save
      setIsEditMode(false); // v0.5.13b: Reset edit mode
      setEditingJobId(null);
    } catch (error) {
      setIsJcfSaving(false);
      // v0.5.4: Use getErrorMessage for normalized error handling
      const errorMessage = getErrorMessage(error);
      setJcfSaveError(errorMessage);
      showToast(errorMessage);
    }
  }, [jcfJobId, jcfClient, jcfIntitule, jcfDeadline, jcfElements, jcfQuantity, jcfShipperId, navigate, createJob, updateJob, showToast, isEditMode, editingJobId, location.state, dispatch]);

  // v0.4.38: Navigate to /job/new to open modal
  const handleOpenJcf = useCallback(() => {
    preJcfSelectedJobIdRef.current = selectedJobId;
    setJcfJobId(generateJobId());
    navigate('/job/new');
  }, [navigate, selectedJobId]);

  // v0.4.38: Navigate away from /job/new to close modal
  // Restore URL to previously selected job (if any) instead of always to /
  const handleCloseJcf = useCallback(() => {
    const fromRoute = (location.state as { from?: string } | null)?.from;
    const savedJobId = preJcfSelectedJobIdRef.current;

    let restoreUrl: string;
    if (fromRoute?.startsWith('/flux')) {
      restoreUrl = fromRoute;
    } else if (savedJobId) {
      restoreUrl = `/job/${savedJobId}`;
    } else {
      restoreUrl = '/';
    }

    navigate(restoreUrl, { replace: true });
    preJcfSelectedJobIdRef.current = null;
    setJcfClient('');
    setJcfTemplate('');
    setJcfIntitule('');
    setJcfQuantity('');
    setJcfDeadline('');
    setJcfElements([{ ...DEFAULT_ELEMENT }]);
    setSequenceWorkflows([]); // v0.4.31: Reset workflow on close
    setJcfSaveError(null); // v0.4.33: Reset API error on close
    setIsEditMode(false); // v0.5.13b: Reset edit mode on close
    setEditingJobId(null);
  }, [navigate, location.state]);

  // v0.4.34: Handler for "Save as Template" button in JcfModal
  const handleSaveAsTemplate = useCallback(() => {
    setIsTemplateEditorOpen(true);
  }, []);

  // v0.4.34: Handler for saving template from editor
  const handleTemplateSave = useCallback(async (data: TemplateEditorData & { id?: string }) => {
    setIsTemplateSaving(true);
    try {
      // Derive sequenceWorkflow from each element's sequence (abstract category names)
      const elementsWithWorkflow = data.elements.map(el => ({
        ...el,
        sequenceWorkflow: el.sequence.split('\n').map(s => s.trim()).filter(Boolean),
      }));
      const templateData = {
        name: data.name,
        description: data.description,
        category: data.category,
        clientName: data.clientName,
        elements: elementsWithWorkflow,
      };
      if (data.id) {
        await updateTemplate({ id: data.id, body: templateData }).unwrap();
      } else {
        await createTemplate(templateData).unwrap();
      }
      setIsTemplateEditorOpen(false);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setIsTemplateSaving(false);
    }
  }, [createTemplate, updateTemplate, showToast]);

  // v0.4.34: Handler for canceling template editor
  const handleTemplateEditorCancel = useCallback(() => {
    setIsTemplateEditorOpen(false);
  }, []);

  // v0.4.34: Handler for template selection in JcfJobHeader
  // Applies the selected template's elements to the form and extracts workflow
  const handleTemplateSelect = useCallback((template: JcfTemplate | null) => {
    if (!template) {
      // Clear template - reset to default state
      setJcfElements([{ ...DEFAULT_ELEMENT }]);
      setSequenceWorkflows([]);
      return;
    }

    // Convert JcfTemplateElement to JcfElement — sequence starts empty (workflow guides the user)
    const newElements: JcfElement[] = template.elements.map(el => ({
      name: el.name,
      precedences: el.precedences,
      quantite: el.quantite,
      format: el.format,
      pagination: el.pagination,
      papier: el.papier,
      imposition: el.imposition,
      impression: el.impression,
      surfacage: el.surfacage,
      autres: el.autres,
      qteFeuilles: el.qteFeuilles,
      commentaires: el.commentaires,
      sequence: '',  // Empty — not the template's abstract workflow categories
      sequenceWorkflow: el.sequenceWorkflow,
      links: el.links,
    }));
    setJcfElements(newElements.length > 0 ? newElements : [{ ...DEFAULT_ELEMENT }]);
    setJcfTemplate(template.name);

    // Derive per-element workflows from each element's sequenceWorkflow (abstract category names)
    setSequenceWorkflows(
      template.elements.map(el => el.sequenceWorkflow ?? []),
    );

    // Also set client if the template has one
    if (template.clientName && !jcfClient) {
      setJcfClient(template.clientName);
    }
  }, [jcfClient]);

  // v0.3.54: Sync pixelsPerHour to PickStateContext for zoom-aware ghost snapping
  useEffect(() => {
    pickActions.setPixelsPerHour(pixelsPerHour);
  }, [pixelsPerHour, pickActions]);

  // v0.3.56: Toggle body class for global grabbing cursor during pick mode
  useEffect(() => {
    if (isPicking) {
      document.body.classList.add('pick-mode-active');
    } else {
      document.body.classList.remove('pick-mode-active');
    }
    return () => document.body.classList.remove('pick-mode-active');
  }, [isPicking]);

  // Grid ref for programmatic scrolling
  const gridRef = useRef<SchedulingGridHandle>(null);

  // v0.3.55: Saved scroll position for sidebar pick cancel restoration
  const savedScrollRef = useRef<{ x: number; y: number } | null>(null);

  // v0.3.56: Track last validated slot for early-exit optimization
  const lastPickSlotRef = useRef<string | null>(null);

  // v0.5.14: Store original assignment info for grid picks (to restore outsourced on cancel)
  const gridPickInfoRef = useRef<{ taskId: string; targetId: string; scheduledStart: string } | null>(null);

  // v0.3.47: Zoom handler that maintains grid center position
  const handleZoomChange = useCallback((newPixelsPerHour: number) => {
    const grid = gridRef.current;
    if (!grid) {
      setPixelsPerHour(newPixelsPerHour);
      return;
    }

    // Calculate the current center hour before zoom
    const currentScrollTop = grid.getScrollY();
    const viewportHeight = grid.getViewportHeight();
    const centerY = currentScrollTop + viewportHeight / 2;
    const centerHour = centerY / pixelsPerHour;

    // Update zoom level
    setPixelsPerHour(newPixelsPerHour);

    // After React updates, scroll to keep the same center hour visible
    requestAnimationFrame(() => {
      const newCenterY = centerHour * newPixelsPerHour;
      const newScrollTop = newCenterY - viewportHeight / 2;
      grid.scrollToY(Math.max(0, newScrollTop), 'instant');
    });
  }, [pixelsPerHour]);

  // Create lookup maps
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    snapshot.jobs.forEach((job) => map.set(job.id, job));
    return map;
  }, [snapshot.jobs]);

  // Find selected job
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) || null : null;

  // Populate JCF form fields from a Job object (shared by scheduler edit + Flux edit)
  const populateJcfFromJob = useCallback((job: Job) => {
    setJcfJobId(job.reference);
    setJcfClient(job.client);
    setJcfIntitule(job.description);
    setJcfDeadline(job.workshopExitDate);
    setJcfQuantity(job.quantity?.toString() ?? '');
    setJcfShipperId(job.shipperId ?? '');
    setJcfTemplate('');

    // Build stationId → station name lookup for sequence DSL reconstruction
    const stationNameMap = new Map(snapshot.stations.map((s) => [s.id, s.name]));
    // Build provider lookup for outsourced tasks
    const providerNameMap = new Map((snapshot.providers ?? []).map((p) => [p.id, p.name]));

    // Map elements back to JcfElement[] format
    const jobElements = snapshot.elements
      .filter((e) => job.elementIds.includes(e.id))
      .sort((a, b) => job.elementIds.indexOf(a.id) - job.elementIds.indexOf(b.id));
    // Build elementId → name lookup for precedences
    const elementNameMap = new Map(jobElements.map((el) => [el.id, el.name]));

    if (jobElements.length > 0) {
      const mappedElements: JcfElement[] = jobElements.map((el) => {
        // Parse label back to format/pagination/papier (label = "format | pagination | papier")
        const labelParts = el.label ? el.label.split(' | ') : [];

        // Map prerequisiteElementIds back to comma-separated names
        const precedences = el.prerequisiteElementIds
          .map((id) => elementNameMap.get(id) ?? '')
          .filter(Boolean)
          .join(', ');

        // Reconstruct sequence DSL from tasks (JCF format)
        const elementTasks = snapshot.tasks
          .filter((t) => t.elementId === el.id)
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        const sequenceParts = elementTasks.map((t) => {
          if (t.type === 'Internal') {
            const posteName = (stationNameMap.get(t.stationId) ?? t.stationId).replace(/\s+/g, '');
            return `${posteName}(${t.duration.setupMinutes}+${t.duration.runMinutes})`;
          }
          // Outsourced tasks (type === 'Outsourced')
          const providerName = providerNameMap.get(t.providerId) ?? 'Externe';
          return `ST:${providerName}(${t.duration.openDays}j):${t.actionType ?? ''}`;
        });
        const sequence = sequenceParts.join('\n');

        return {
          name: el.name,
          precedences,
          quantite: el.spec?.quantite?.toString() ?? '',
          format: el.spec?.format ?? labelParts[0] ?? '',
          pagination: el.spec?.pagination?.toString() ?? labelParts[1] ?? '',
          papier: el.spec?.papier ?? labelParts[2] ?? '',
          imposition: el.spec?.imposition ?? '',
          impression: el.spec?.impression ?? '',
          surfacage: el.spec?.surfacage ?? '',
          autres: el.spec?.autres ?? '',
          qteFeuilles: el.spec?.qteFeuilles?.toString() ?? '',
          commentaires: el.spec?.commentaires ?? '',
          sequence,
        };
      });
      setJcfElements(mappedElements);
    }

    setIsEditMode(true);
    setEditingJobId(job.id);
    setSequenceWorkflows([]);
    setJcfSaveError(null);
  }, [snapshot.elements, snapshot.tasks, snapshot.stations, snapshot.providers]);

  // v0.5.13b: Handler for "Modifier" button in Job Details Panel (scheduler view)
  const handleEditJob = useCallback(() => {
    if (!selectedJob) return;
    populateJcfFromJob(selectedJob);
    preJcfSelectedJobIdRef.current = selectedJobId;
    navigate('/job/new');
  }, [selectedJob, selectedJobId, populateJcfFromJob, navigate]);

  // Auto-populate JCF when arriving at /job/new with editJobId in state (from Flux)
  useEffect(() => {
    const state = location.state as { editJobId?: string } | null;
    if (state?.editJobId && isJcfModalOpen) {
      const job = jobMap.get(state.editJobId);
      if (job) {
        populateJcfFromJob(job);
      }
    }
  }, [location.state, isJcfModalOpen, jobMap, populateJcfFromJob]);

  const handleDeleteJob = useCallback(async () => {
    if (!selectedJobId) return;
    try {
      await deleteJob(selectedJobId).unwrap();
      setSelectedJobId(null);
    } catch (err) {
      showToast(`Échec de la suppression: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [selectedJobId, deleteJob, setSelectedJobId, showToast]);

  // REQ-14: Calculate grid/DateStrip start date (lookbackDays before today)
  const lookbackDays = snapshotData?.lookbackDays ?? 6;
  const gridStartDate = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() - lookbackDays);
    today.setHours(START_HOUR, 0, 0, 0);
    return today;
  }, [lookbackDays]);

  // Category lookup map (for getStationXOffset)
  const categoryMap = useMemo(() => {
    const map = new Map<string, import('@flux/types').StationCategory>();
    snapshot.categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [snapshot.categories]);

  // v0.3.54: Calculate precedence constraints for pick
  const pickPrecedenceConstraints = useMemo(() => {
    if (!pickedTask) {
      return { earliestY: null, latestY: null };
    }
    const earliestY = getPredecessorConstraint(pickedTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const latestY = getSuccessorConstraint(pickedTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    return { earliestY, latestY };
  }, [pickedTask, snapshot, pixelsPerHour, gridStartDate]);

  // v0.3.54: Calculate drying time info during pick
  const pickDryingTimeInfo = useMemo((): DryingTimeInfo | null => {
    if (!pickedTask) {
      return null;
    }
    return getDryingTimeInfo(pickedTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
  }, [pickedTask, snapshot, pixelsPerHour, gridStartDate]);

  // v0.5.13: Calculate outsourcing time info during pick
  const pickOutsourcingTimeInfo = useMemo((): OutsourcingTimeInfo | null => {
    if (!pickedTask) {
      return null;
    }
    return getOutsourcingTimeInfo(pickedTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
  }, [pickedTask, snapshot, pixelsPerHour, gridStartDate]);

  // REQ-14: Auto-scroll to today on initial load
  const hasScrolledToToday = useRef(false);
  useEffect(() => {
    if (hasScrolledToToday.current || !gridRef.current) return;

    // Calculate Y position for today at current time
    const now = new Date();
    const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate);

    // Scroll to center today in the viewport
    const viewportHeight = gridRef.current.getViewportHeight();
    const scrollTarget = Math.max(0, y - viewportHeight / 2);
    gridRef.current.scrollToY(scrollTarget, 'instant');

    hasScrolledToToday.current = true;
  }, [pixelsPerHour, gridStartDate]);

  // REQ-15: Get departure date for selected job
  const departureDate = useMemo(() => {
    if (!selectedJob?.workshopExitDate) return null;
    return new Date(selectedJob.workshopExitDate);
  }, [selectedJob?.workshopExitDate]);

  // REQ-16: Calculate scheduled days for selected job
  const scheduledDays = useMemo(() => {
    if (!selectedJobId) return new Set<string>();

    const days = new Set<string>();
    const jobTaskIds = new Set(
      getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements)
        .map((t) => t.id)
    );

    snapshot.assignments
      .filter((a) => jobTaskIds.has(a.taskId))
      .forEach((a) => {
        const date = new Date(a.scheduledStart);
        const dateKey = date.toISOString().split('T')[0];
        days.add(dateKey);
      });

    return days;
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // Conflict task IDs for sidebar highlighting + DateStrip markers
  // Only PrecedenceConflict and GroupCapacityConflict trigger amber glow —
  // other types (ApprovalGateConflict, DeadlineConflict, etc.) have their own indicators.
  const conflictTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of snapshot.conflicts) {
      if (c.type === 'PrecedenceConflict' || c.type === 'GroupCapacityConflict') {
        ids.add(c.taskId);
        if (c.relatedTaskId) ids.add(c.relatedTaskId);
      }
    }
    return ids;
  }, [snapshot.conflicts]);

  // v0.3.47: Task markers per day for DateStrip
  // Groups tasks by date and determines their status (completed, late, conflict, scheduled)
  const taskMarkersPerDay = useMemo((): Map<string, TaskMarker[]> => {
    const markers = new Map<string, TaskMarker[]>();
    if (!selectedJobId) return markers;

    const now = new Date();

    // Get all tasks for the selected job
    const jobTasks = getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements);
    const taskIds = new Set(jobTasks.map((t) => t.id));

    // Process assignments for selected job
    snapshot.assignments
      .filter((a) => taskIds.has(a.taskId))
      .forEach((assignment) => {
        const scheduledStart = new Date(assignment.scheduledStart);
        const scheduledEnd = new Date(assignment.scheduledEnd);
        // Use local date for dateKey (to match DateStrip's local calendar display)
        const year = scheduledStart.getFullYear();
        const month = String(scheduledStart.getMonth() + 1).padStart(2, '0');
        const day = String(scheduledStart.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        // Extract start hour within the day (0-24, fractional)
        const startHour = scheduledStart.getHours() + scheduledStart.getMinutes() / 60;

        // Determine task marker status
        let status: TaskMarker['status'] = 'scheduled';
        if (assignment.isCompleted) {
          status = 'completed';
        } else if (conflictTaskIds.has(assignment.taskId)) {
          status = 'conflict';
        } else if (scheduledEnd < now) {
          status = 'late';
        }

        const marker: TaskMarker = {
          taskId: assignment.taskId,
          status,
          startHour,
        };

        const existing = markers.get(dateKey) ?? [];
        existing.push(marker);
        markers.set(dateKey, existing);
      });

    return markers;
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments, conflictTaskIds]);

  // v0.3.47: Earliest task date for timeline (first scheduled task)
  const earliestTaskDate = useMemo((): Date | null => {
    if (!selectedJobId) return null;

    const jobTaskIds = new Set(
      getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements).map((t) => t.id)
    );

    let earliest: Date | null = null;
    snapshot.assignments
      .filter((a) => jobTaskIds.has(a.taskId))
      .forEach((a) => {
        const startDate = new Date(a.scheduledStart);
        if (!earliest || startDate < earliest) {
          earliest = startDate;
        }
      });

    return earliest;
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // REQ-09.2: Focused date for DateStrip sync
  const [focusedDate, setFocusedDate] = useState<Date | null>(new Date());
  const scrollTimeoutRef = useRef<number | null>(null);

  // v0.3.47: Viewport hours for DateStrip indicator
  const [viewportStartHour, setViewportStartHour] = useState<number>(0);
  const [viewportEndHour, setViewportEndHour] = useState<number>(8);
  const lastScrollTopRef = useRef<number>(0);

  // Ref to avoid stale closure in scroll handler when zoom changes
  const pixelsPerHourRef = useRef(pixelsPerHour);
  pixelsPerHourRef.current = pixelsPerHour;

  // REQ-09.2: Handle grid scroll to calculate focused date
  // v0.3.47: Also calculate viewport hours for DateStrip indicator
  const handleGridScroll = useCallback((scrollTop: number) => {
    // Store scrollTop for recalculation on zoom change
    lastScrollTopRef.current = scrollTop;

    // Debounce: cancel previous timeout and set new one
    if (scrollTimeoutRef.current !== null) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = requestAnimationFrame(() => {
      // Use ref to get current pixelsPerHour (avoids stale closure on zoom change)
      const currentPixelsPerHour = pixelsPerHourRef.current;

      // Calculate focused date from scroll position
      // The focused date is the one visible at the center of the viewport
      const viewportHeight = gridRef.current?.getViewportHeight() ?? 600;
      const centerY = scrollTop + viewportHeight / 2;
      const hoursFromStart = centerY / currentPixelsPerHour;
      const focusedTime = new Date(gridStartDate);
      focusedTime.setTime(gridStartDate.getTime() + hoursFromStart * 60 * 60 * 1000);
      setFocusedDate(focusedTime);

      // v0.3.47: Calculate viewport hours from grid start (not clamped to single day)
      // This allows viewport indicator to span multiple days
      const startHourFromGridStart = scrollTop / currentPixelsPerHour;
      const endHourFromGridStart = (scrollTop + viewportHeight) / currentPixelsPerHour;

      setViewportStartHour(startHourFromGridStart);
      setViewportEndHour(endHourFromGridStart);
    });
  }, [gridStartDate]);

  // v0.3.47: Recalculate viewport when zoom (pixelsPerHour) changes
  // This ensures the viewport indicator stays on the correct day after zoom
  useEffect(() => {
    if (lastScrollTopRef.current > 0) {
      // Trigger recalculation with the stored scrollTop
      handleGridScroll(lastScrollTopRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelsPerHour]); // handleGridScroll is stable, pixelsPerHour triggers recalc

  // Get ordered job IDs for navigation (matching JobsList display order)
  // Problems first (late, then conflicts), then normal jobs
  const orderedJobIds = useMemo(() => {
    const lateJobIds = new Set(snapshot.lateJobs.map((lj) => lj.jobId));
    const conflictJobIds = new Set<string>();
    snapshot.conflicts.forEach((c) => {
      const task = snapshot.tasks.find((t) => t.id === c.taskId);
      if (task) {
        const jobId = getJobIdForTask(task, snapshot.elements);
        if (jobId) conflictJobIds.add(jobId);
      }
    });

    const problems: Job[] = [];
    const normal: Job[] = [];

    snapshot.jobs.forEach((job) => {
      if (lateJobIds.has(job.id) || conflictJobIds.has(job.id)) {
        problems.push(job);
      } else {
        normal.push(job);
      }
    });

    // Sort problems: late first, then conflicts
    problems.sort((a, b) => {
      const aIsLate = lateJobIds.has(a.id);
      const bIsLate = lateJobIds.has(b.id);
      if (aIsLate && !bIsLate) return -1;
      if (!aIsLate && bIsLate) return 1;
      return 0;
    });

    return [...problems.map((j) => j.id), ...normal.map((j) => j.id)];
  }, [snapshot.jobs, snapshot.lateJobs, snapshot.conflicts, snapshot.tasks, snapshot.elements]);

  // Track Alt key and keyboard shortcuts
  useEffect(() => {
    const ctx: KeyboardContext = {
      selectedJobId,
      isQuickPlacementMode,
      isJcfOpen: isJcfModalOpen,
      orderedJobIds,
      selectedJob,
      gridRef,
      pixelsPerHour,
      gridStartDate,
      setIsAltPressed,
      setSelectedJobId,
      setIsQuickPlacementMode,
      setQuickPlacementHover,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Each handler returns true if it handled the event
      if (handleAltKey(e, ctx)) return;
      // v0.3.54: Handle ESC to cancel pick (priority over quick placement)
      // v0.3.55: Also restore scroll position for sidebar picks
      if (handleEscapePick(e, () => {
        // Restore scroll position for sidebar picks
        if (pickSource === 'sidebar' && savedScrollRef.current && gridRef.current) {
          gridRef.current.scrollTo(savedScrollRef.current.x, savedScrollRef.current.y, 'smooth');
          savedScrollRef.current = null;
        }
        lastPickSlotRef.current = null; // v0.3.56: Clear slot tracking

        // v0.5.14: Restore outsourced successor assignments for grid picks
        // Reschedule at original position to trigger autoAssignOutsourcedSuccessors
        const savedGridPickInfo = gridPickInfoRef.current;
        gridPickInfoRef.current = null;

        pickActions.cancelPick();
        setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });

        if (savedGridPickInfo) {
          rescheduleTask({
            taskId: savedGridPickInfo.taskId,
            body: {
              targetId: savedGridPickInfo.targetId,
              scheduledStart: savedGridPickInfo.scheduledStart,
              isOutsourced: false,
            },
          }).catch((error: unknown) => {
            console.error('Failed to restore outsourced assignments on cancel:', error);
          });
        }
      }, isPicking)) return;
      if (handleQuickPlacementKeyboard(e, ctx)) return;
      if (handleDisplayModeToggle(e, setDisplayMode)) return;
      if (handleEscapeQuickPlacement(e, ctx)) return;
      if (handleEscapeCloseJob(e, ctx)) return;
      if (handleJobNavigation(e, ctx)) return;
      if (handleJumpToDeparture(e, ctx)) return;
      if (handleJumpToToday(e, ctx)) return;
      handlePageScroll(e, ctx);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedJobId, isQuickPlacementMode, isJcfModalOpen, orderedJobIds, selectedJob, pixelsPerHour, gridStartDate, isPicking, pickActions, pickSource, setSelectedJobId, setDisplayMode, rescheduleTask]);

  // Handle swap in a given direction using two rescheduleTask mutations
  const handleSwap = useCallback(async (assignmentId: string, direction: 'up' | 'down') => {
    // Guard: don't swap completed tiles
    const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
    if (assignment?.isCompleted) return;

    const result = applySwap(snapshot.assignments, assignmentId, direction);
    if (!result.swapped || result.reschedules.length < 2) return;

    try {
      await Promise.all(
        result.reschedules.map(({ taskId, targetId, scheduledStart }) =>
          rescheduleTask({ taskId, body: { targetId, scheduledStart } }).unwrap()
        )
      );
    } catch (err) {
      console.error(`Swap ${direction} failed:`, err);
    }
  }, [snapshot.assignments, rescheduleTask]);

  // Handle swap up - exchange position with tile above
  const handleSwapUp = useCallback((assignmentId: string) => {
    handleSwap(assignmentId, 'up');
  }, [handleSwap]);

  // Handle swap down - exchange position with tile below
  const handleSwapDown = useCallback((assignmentId: string) => {
    handleSwap(assignmentId, 'down');
  }, [handleSwap]);

  // v0.3.58: Handle context menu open
  const handleContextMenuOpen = useCallback((x: number, y: number, assignmentId: string, isCompleted: boolean) => {
    setContextMenu({ x, y, assignmentId, isCompleted });
  }, []);

  // v0.3.58: Handle context menu close
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // v0.3.58: Handle context menu "View details" action
  const handleContextMenuViewDetails = useCallback(() => {
    if (!contextMenu) return;
    const assignment = snapshot.assignments.find((a) => a.id === contextMenu.assignmentId);
    if (assignment) {
      const task = snapshot.tasks.find((t) => t.id === assignment.taskId);
      if (task) {
        const jobId = getJobIdForTask(task, snapshot.elements);
        if (jobId) setSelectedJobId(jobId);
      }
    }
  }, [contextMenu, snapshot.assignments, snapshot.tasks, snapshot.elements, setSelectedJobId]);

  // Handle jump to task - scroll grid to assignment position (single-click in Job Details Panel)
  const handleJumpToTask = useCallback((assignment: TaskAssignment) => {
    if (!gridRef.current) return;

    // Calculate Y position from assignment's scheduledStart (multi-day aware)
    const startTime = new Date(assignment.scheduledStart);
    const y = timeToYPosition(startTime, START_HOUR, pixelsPerHour, gridStartDate);

    // Position the tile ~20vh from top of viewport
    const viewportHeight = gridRef.current.getViewportHeight();
    const scrollTargetY = Math.max(0, y - viewportHeight * 0.2);

    // Calculate X position from station index (accounts for variable column widths)
    const stationId = assignment.targetId;
    const stationIndex = snapshot.stations.findIndex((s) => s.id === stationId);

    let scrollTargetX = gridRef.current.getScrollX(); // Default: keep current X

    if (stationIndex >= 0) {
      const { x: stationX } = getStationXOffset(stationIndex, snapshot.stations, categoryMap);
      scrollTargetX = Math.max(0, stationX);
    }

    // Scroll both X and Y at once
    gridRef.current.scrollTo(scrollTargetX, scrollTargetY);

    console.log('Jump to task:', {
      assignmentId: assignment.id,
      taskId: assignment.taskId,
      stationId,
      scheduledStart: assignment.scheduledStart,
      scrollTargetX,
      scrollTargetY,
    });
  }, [snapshot.stations, categoryMap, pixelsPerHour, gridStartDate]);

  // F9: Deep-link from Flux dashboard — ?task= URL param → scroll to task
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('task');
    if (!taskId || !gridRef.current || snapshot.assignments.length === 0) return;

    const assignment = snapshot.assignments.find(a => a.taskId === taskId);
    if (assignment) {
      handleJumpToTask(assignment);
      // Clean up URL param
      window.history.replaceState(null, '', location.pathname);
    }
  }, [location.search, snapshot.assignments, handleJumpToTask, location.pathname]);

  // Handle recall - remove assignment (double-click on tile)
  // v0.5.2: Now uses RTK Query mutation
  const handleRecallAssignment = useCallback(async (assignmentId: string) => {
    const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
    if (!assignment) {
      console.warn('Assignment not found for recall:', assignmentId);
      return;
    }

    console.log('Recalling assignment:', {
      assignmentId,
      taskId: assignment.taskId,
    });

    try {
      await unassignTask(assignment.taskId).unwrap();
      // Cache invalidation is automatic via invalidatesTags
    } catch (error) {
      console.error('Failed to recall assignment:', error);
      showToast(getErrorMessage(error));
    }
  }, [snapshot.assignments, unassignTask, showToast]);

  // v0.4.32a: Handle element prerequisite status change
  const handleElementStatusChange = useCallback(async (update: ElementStatusUpdate) => {
    try {
      await updateElementStatus(update).unwrap();
    } catch (err) {
      console.error('Failed to update element status:', err);
      showToast(getErrorMessage(err));
    }
  }, [updateElementStatus, showToast]);

  // v0.5.11: Handle outsourcing work days change (local state only)
  const handleOutsourcingWorkDaysChange = useCallback((taskId: string, workDays: number) => {
    updateSnapshot((currentSnapshot) => {
      const taskIndex = currentSnapshot.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return currentSnapshot;

      const task = currentSnapshot.tasks[taskIndex];
      if (task.type !== 'Outsourced') return currentSnapshot;

      const newTasks = [...currentSnapshot.tasks];
      newTasks[taskIndex] = {
        ...task,
        duration: {
          ...task.duration,
          openDays: workDays,
        },
        updatedAt: new Date().toISOString(),
      };

      // If no manual return, recalculate return date and sync assignment scheduledEnd
      if (!task.manualReturn) {
        const assignmentIndex = currentSnapshot.assignments.findIndex(
          (a) => a.taskId === taskId
        );
        if (assignmentIndex !== -1) {
          const assignment = currentSnapshot.assignments[assignmentIndex];
          const provider = currentSnapshot.providers?.find((p) => p.id === task.providerId);
          if (provider && assignment.scheduledStart) {
            const oneWay = isLastTaskOfJob(taskId, currentSnapshot.elements, currentSnapshot.tasks);
            const newReturn = calculateReturnDate(new Date(assignment.scheduledStart), {
              workDays,
              transitDays: provider.transitDays,
              receptionTime: provider.receptionTime,
              oneWay,
            });
            const newAssignments = [...currentSnapshot.assignments];
            newAssignments[assignmentIndex] = {
              ...assignment,
              scheduledEnd: newReturn.toISOString(),
            };
            return { ...currentSnapshot, tasks: newTasks, assignments: newAssignments };
          }
        }
      }

      return { ...currentSnapshot, tasks: newTasks };
    });
    invalidateSnapshot();
  }, [invalidateSnapshot]);

  // v0.5.11: Handle outsourcing departure change (local state only)
  const handleOutsourcingDepartureChange = useCallback((taskId: string, departure: Date | undefined) => {
    updateSnapshot((currentSnapshot) => {
      const taskIndex = currentSnapshot.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return currentSnapshot;

      const task = currentSnapshot.tasks[taskIndex];
      if (task.type !== 'Outsourced') return currentSnapshot;

      const newTasks = [...currentSnapshot.tasks];
      newTasks[taskIndex] = {
        ...task,
        manualDeparture: departure?.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Sync assignment scheduledStart for conflict pipeline
      const assignmentIndex = currentSnapshot.assignments.findIndex(
        (a) => a.taskId === taskId
      );
      if (assignmentIndex !== -1) {
        const newAssignments = [...currentSnapshot.assignments];
        newAssignments[assignmentIndex] = {
          ...newAssignments[assignmentIndex],
          scheduledStart: departure?.toISOString() ?? newAssignments[assignmentIndex].scheduledStart,
        };
        return { ...currentSnapshot, tasks: newTasks, assignments: newAssignments };
      }

      return { ...currentSnapshot, tasks: newTasks };
    });
    invalidateSnapshot();
  }, [invalidateSnapshot]);

  // v0.5.11: Handle outsourcing return change (local state only)
  const handleOutsourcingReturnChange = useCallback((taskId: string, returnDate: Date | undefined) => {
    updateSnapshot((currentSnapshot) => {
      const taskIndex = currentSnapshot.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return currentSnapshot;

      const task = currentSnapshot.tasks[taskIndex];
      if (task.type !== 'Outsourced') return currentSnapshot;

      const newTasks = [...currentSnapshot.tasks];
      newTasks[taskIndex] = {
        ...task,
        manualReturn: returnDate?.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Sync assignment scheduledEnd for conflict pipeline
      const assignmentIndex = currentSnapshot.assignments.findIndex(
        (a) => a.taskId === taskId
      );
      if (assignmentIndex !== -1) {
        const newAssignments = [...currentSnapshot.assignments];
        newAssignments[assignmentIndex] = {
          ...newAssignments[assignmentIndex],
          scheduledEnd: returnDate?.toISOString() ?? newAssignments[assignmentIndex].scheduledEnd,
        };
        return { ...currentSnapshot, tasks: newTasks, assignments: newAssignments };
      }

      return { ...currentSnapshot, tasks: newTasks };
    });
    invalidateSnapshot();
  }, [invalidateSnapshot]);

  // REQ-14: Handle date click - scroll grid to the clicked date
  const handleDateClick = useCallback((date: Date) => {
    if (!gridRef.current) return;

    // Calculate Y position for the start of the clicked day (at START_HOUR)
    // Use multi-day calculation with gridStartDate
    const targetDate = new Date(date);
    targetDate.setHours(START_HOUR, 0, 0, 0);
    const y = timeToYPosition(targetDate, START_HOUR, pixelsPerHour, gridStartDate);

    // Scroll to position with a small offset from top
    const scrollTarget = Math.max(0, y);
    gridRef.current.scrollToY(scrollTarget);

    console.log('DateStrip click-to-scroll:', {
      date: date.toISOString().split('T')[0],
      scrollTarget,
    });
  }, [pixelsPerHour, gridStartDate]);

  // Scroll grid to today on initial load
  useEffect(() => {
    // Small delay to ensure grid is mounted and rendered
    const timer = setTimeout(() => {
      handleDateClick(new Date());
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle toggle completion (v0.3.33, v0.5.3: migrated to RTK Query mutation)
  const handleToggleComplete = useCallback(async (assignmentId: string) => {
    const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
    if (!assignment) {
      console.warn('Assignment not found for toggle:', assignmentId);
      return;
    }

    console.log('Toggling completion:', {
      assignmentId,
      taskId: assignment.taskId,
      from: assignment.isCompleted,
      to: !assignment.isCompleted,
    });

    try {
      // Optimistic update is handled in the mutation's onQueryStarted
      await toggleCompletion(assignment.taskId).unwrap();
    } catch (error) {
      // Rollback is handled in the mutation's onQueryStarted
      showToast(getErrorMessage(error));
    }
  }, [snapshot.assignments, toggleCompletion, showToast]);

  // v0.3.58: Handle context menu "Toggle completion" action
  const handleContextMenuToggleComplete = useCallback(() => {
    if (!contextMenu) return;
    handleToggleComplete(contextMenu.assignmentId);
  }, [contextMenu, handleToggleComplete]);

  // v0.3.58: Handle context menu "Move up" action
  const handleContextMenuMoveUp = useCallback(() => {
    if (!contextMenu) return;
    handleSwapUp(contextMenu.assignmentId);
  }, [contextMenu, handleSwapUp]);

  // v0.3.58: Handle context menu "Move down" action
  const handleContextMenuMoveDown = useCallback(() => {
    if (!contextMenu) return;
    handleSwapDown(contextMenu.assignmentId);
  }, [contextMenu, handleSwapDown]);

  // v0.3.58: Calculate if swap is available for context menu
  const getContextMenuSwapAvailability = useCallback(() => {
    if (!contextMenu) return { canSwapUp: false, canSwapDown: false };

    const assignment = snapshot.assignments.find((a) => a.id === contextMenu.assignmentId);
    if (!assignment) return { canSwapUp: false, canSwapDown: false };

    // Completed tiles cannot be swapped
    if (assignment.isCompleted) return { canSwapUp: false, canSwapDown: false };

    // Find adjacent tiles on the same station
    const stationAssignments = snapshot.assignments
      .filter((a) => a.targetId === assignment.targetId)
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

    const currentIndex = stationAssignments.findIndex((a) => a.id === contextMenu.assignmentId);

    // Also check if adjacent tiles are completed
    const adjacentUp = currentIndex > 0 ? stationAssignments[currentIndex - 1] : null;
    const adjacentDown = currentIndex < stationAssignments.length - 1 ? stationAssignments[currentIndex + 1] : null;

    return {
      canSwapUp: currentIndex > 0 && !adjacentUp?.isCompleted,
      canSwapDown: currentIndex < stationAssignments.length - 1 && !adjacentDown?.isCompleted,
    };
  }, [contextMenu, snapshot.assignments]);

  // Quick Placement: get the LAST unscheduled task (for sidebar highlight)
  // In backward scheduling, we always show the last task as the one to place
  const lastUnscheduledTask = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob) {
      return null;
    }
    return getLastUnscheduledTask(selectedJob, snapshot.tasks, snapshot.elements, snapshot.assignments);
  }, [isQuickPlacementMode, selectedJob, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // Quick Placement: get the task for the hovered station (for validation)
  const quickPlacementTask = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob || !quickPlacementHover.stationId) {
      return null;
    }
    return getAvailableTaskForStation(
      selectedJob,
      snapshot.tasks,
      snapshot.elements,
      snapshot.assignments,
      quickPlacementHover.stationId
    );
  }, [isQuickPlacementMode, selectedJob, quickPlacementHover.stationId, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // Quick Placement: calculate scheduled start from Y position
  const quickPlacementScheduledStart = useMemo(() => {
    if (!quickPlacementHover.stationId || quickPlacementHover.snappedY === 0) {
      return null;
    }
    const dropTime = yPositionToTime(quickPlacementHover.snappedY, START_HOUR, gridStartDate, pixelsPerHour);
    return dropTime.toISOString();
  }, [quickPlacementHover.stationId, quickPlacementHover.snappedY, gridStartDate, pixelsPerHour]);

  // Quick Placement: validation using the same logic as drag
  const quickPlacementValidation = useDropValidation({
    snapshot,
    task: quickPlacementTask,
    targetStationId: quickPlacementHover.stationId,
    scheduledStart: quickPlacementScheduledStart,
    bypassPrecedence: isAltPressed,
  });

  // Quick Placement: precedence constraint Y positions
  const quickPlacementPrecedenceConstraints = useMemo(() => {
    if (!quickPlacementTask) {
      return { earliestY: null, latestY: null };
    }
    const earliestY = getPredecessorConstraint(quickPlacementTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const latestY = getSuccessorConstraint(quickPlacementTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    return { earliestY, latestY };
  }, [quickPlacementTask, snapshot, pixelsPerHour, gridStartDate]);

  // Quick Placement: auto-scroll grid to the target station and predecessor constraint line
  useEffect(() => {
    if (!isQuickPlacementMode || !lastUnscheduledTask || !gridRef.current) return;
    if (lastUnscheduledTask.type !== 'Internal') return;

    const stationIndex = snapshot.stations.findIndex((s) => s.id === lastUnscheduledTask.stationId);
    if (stationIndex < 0) return;

    // Horizontal: scroll to left edge of target station column
    const { x: stationX } = getStationXOffset(stationIndex, snapshot.stations, categoryMap);
    const scrollX = Math.max(0, stationX);

    // Vertical: scroll to predecessor constraint (purple line) if available, else successor (orange)
    const earliestY = getPredecessorConstraint(lastUnscheduledTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const latestY = getSuccessorConstraint(lastUnscheduledTask, snapshot, START_HOUR, pixelsPerHour, gridStartDate);
    const targetY = earliestY ?? latestY;

    // Fallback: workshopExitDate (blue deadline line) when no precedence constraints
    const deadlineY = selectedJob?.workshopExitDate
      ? timeToYPosition(new Date(selectedJob.workshopExitDate), START_HOUR, pixelsPerHour, gridStartDate)
      : null;

    const scrollTargetY = targetY ?? deadlineY;

    if (scrollTargetY !== null) {
      const viewportHeight = gridRef.current.getViewportHeight();
      // Constraint: viewport 30% | Deadline fallback: viewport 70% (bottom, since we place bottom-up)
      const offset = targetY !== null ? 0.3 : 0.7;
      const scrollY = Math.max(0, scrollTargetY - viewportHeight * offset);
      gridRef.current.scrollTo(scrollX, scrollY, 'smooth');
    } else {
      gridRef.current.scrollToX(scrollX, 'smooth');
    }
  }, [isQuickPlacementMode, lastUnscheduledTask, snapshot, categoryMap, displayMode, pixelsPerHour, gridStartDate, selectedJob]);

  // Quick Placement: handle mouse move in station column
  // v0.3.48: Use pixelsPerHour for zoom-aware snapping
  const handleQuickPlacementMouseMove = useCallback((stationId: string, y: number) => {
    const snappedY = snapToGrid(Math.max(0, y), pixelsPerHour);
    setQuickPlacementHover({ stationId, y, snappedY });
  }, [pixelsPerHour]);

  // Quick Placement: handle mouse leave from station column
  const handleQuickPlacementMouseLeave = useCallback(() => {
    setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
  }, []);

  // Quick Placement: handle click to place task
  // v0.5.2: Now uses RTK Query mutation
  const handleQuickPlacementClick = useCallback(async (stationId: string, y: number) => {
    if (!selectedJob || !isQuickPlacementMode) return;

    // Get the available task for this station
    const taskToPlace = getAvailableTaskForStation(
      selectedJob,
      snapshot.tasks,
      snapshot.elements,
      snapshot.assignments,
      stationId
    );

    if (!taskToPlace) {
      console.log('No task available to place on this station');
      return;
    }

    // Calculate the time from Y position (multi-day aware)
    // v0.3.48: Use pixelsPerHour for zoom-aware snapping
    const snappedY = snapToGrid(Math.max(0, y), pixelsPerHour);
    const dropTime = yPositionToTime(snappedY, START_HOUR, gridStartDate, pixelsPerHour);
    const scheduledStart = dropTime.toISOString();

    // Client-side validation before API call
    const proposedAssignment: ProposedAssignment = {
      taskId: taskToPlace.id,
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence: isAltPressed,
    };
    const validationResult = validateAssignment(proposedAssignment, snapshot);

    // Check for blocking conflicts (same logic as drag & drop)
    // StationConflict is non-blocking (push-down) UNLESS the existing tile is completed
    const blockingConflicts = validationResult.conflicts.filter(
      (c) => !(c.type === 'StationConflict' && !c.details?.existingTaskIsCompleted) &&
             !(c.type === 'PrecedenceConflict' &&
               c.details?.constraintType === 'predecessor' &&
               validationResult.suggestedStart) &&
             !(c.type === 'PrecedenceConflict' && isAltPressed) &&
             !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
    );

    if (blockingConflicts.length > 0) {
      console.log('Quick placement blocked: validation failed', blockingConflicts);
      return;
    }

    console.log('Quick placement creating assignment:', {
      taskId: taskToPlace.id,
      stationId,
      scheduledStart,
    });

    const hasPrecedenceConflict = validationResult.conflicts.some(
      (c) => c.type === 'PrecedenceConflict'
    );

    try {
      const result = await assignTask({
        taskId: taskToPlace.id,
        body: {
          targetId: stationId,
          scheduledStart,
          isOutsourced: false,
          ...(isAltPressed && hasPrecedenceConflict ? { bypassPrecedence: true } : {}),
        },
      }).unwrap();

      console.log('Quick placement assignment created:', result);
      // Cache invalidation is automatic via invalidatesTags
    } catch (error) {
      console.error('Failed to create assignment:', error);
      showToast(getErrorMessage(error));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only react to specific snapshot properties, not entire object
  }, [selectedJob, isQuickPlacementMode, snapshot.tasks, snapshot.assignments, snapshot.stations, snapshot.elements, gridStartDate, pixelsPerHour, assignTask, showToast, isAltPressed]);

  // Calculate which stations have available tasks (for quick placement cursor)
  const stationsWithAvailableTasks = useMemo(() => {
    if (!isQuickPlacementMode || !selectedJob) {
      return new Set<string>();
    }
    const stationIds = new Set<string>();
    snapshot.stations.forEach((station) => {
      const task = getAvailableTaskForStation(
        selectedJob,
        snapshot.tasks,
        snapshot.elements,
        snapshot.assignments,
        station.id
      );
      if (task) {
        stationIds.add(station.id);
      }
    });
    return stationIds;
  }, [isQuickPlacementMode, selectedJob, snapshot.stations, snapshot.tasks, snapshot.elements, snapshot.assignments]);

  // Handle station compact - remove gaps between tiles
  // Respects precedence: tasks cannot start before their predecessor ends
  // Works in both mock and API modes via RTK Query mutation
  const handleCompact = useCallback(async (stationId: string) => {
    setCompactingStationId(stationId);
    try {
      await compactStation(stationId).unwrap();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setCompactingStationId(null);
    }
  }, [compactStation, showToast]);

  // Toggle Quick Placement (for TopNavBar button)
  const handleToggleQuickPlacement = useCallback(() => {
    if (selectedJobId) {
      setIsQuickPlacementMode((prev) => {
        if (prev) {
          // Turning off: clear job selection to remove tile muting
          setSelectedJobId(null);
        }
        return !prev;
      });
      setQuickPlacementHover({ stationId: null, y: 0, snappedY: 0 });
    }
  }, [selectedJobId, setSelectedJobId, setIsQuickPlacementMode, setQuickPlacementHover]);

  // v0.3.54: Handle pick from sidebar (unscheduled task)
  // v0.3.55: Added scroll to target column and save scroll position
  // v0.4.29: Accept click coordinates for initial ghost position
  const handlePickTask = useCallback((task: Task, job: Job, clientX: number, clientY: number) => {
    pickActions.pickFromSidebar(task, job);
    // Initialize ghost position at click location
    pickActions.updateGhostPosition(clientX, clientY);

    // v0.3.55: Save current scroll position for cancel restoration
    if (gridRef.current) {
      savedScrollRef.current = {
        x: gridRef.current.getScrollX(),
        y: gridRef.current.getScrollY(),
      };

      // Scroll to target station column (for internal tasks)
      if (task.type === 'Internal') {
        const targetStationId = task.stationId;
        const stationIndex = snapshot.stations.findIndex((s) => s.id === targetStationId);
        if (stationIndex >= 0) {
          const { x: targetX } = getStationXOffset(stationIndex, snapshot.stations, categoryMap);
          gridRef.current.scrollToX(targetX, 'smooth');
        }
      }
    }
  }, [pickActions, snapshot.stations, categoryMap]);

  // v0.3.57: Handle pick from grid (reschedule existing task)
  // No scroll needed as user is already at tile location
  const handlePickFromGrid = useCallback(async (task: InternalTask, job: Job, assignmentId: string) => {
    pickActions.pickFromGrid(task, job, assignmentId);
    // Initialize ghost position at cursor (will be updated on mouse move)
    pickActions.updateGhostPosition(0, 0);
    // No scroll position saving for grid picks - no scroll restoration needed

    // v0.5.14: Store original position for cancel restoration
    const originalAssignment = snapshot.assignments.find((a) => a.id === assignmentId);
    gridPickInfoRef.current = originalAssignment
      ? { taskId: task.id, targetId: originalAssignment.targetId, scheduledStart: originalAssignment.scheduledStart }
      : null;

    // v0.5.14: Remove outsourced successor assignments when picking the last task of a prerequisite element
    const element = snapshot.elements.find((e) => e.id === task.elementId);
    if (!element) return;

    const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));
    const elementTasks = element.taskIds
      .map((id) => taskById.get(id))
      .filter((t): t is Task => t !== undefined)
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const lastTask = elementTasks[elementTasks.length - 1];
    if (!lastTask || lastTask.id !== task.id) return;

    // Find dependent elements that have outsourced tasks with assignments
    const dependentElements = snapshot.elements.filter((e) =>
      e.prerequisiteElementIds.includes(element.id)
    );

    for (const depElem of dependentElements) {
      for (const depTaskId of depElem.taskIds) {
        const depTask = taskById.get(depTaskId);
        if (depTask?.type === 'Outsourced' && snapshot.assignments.some((a) => a.taskId === depTask.id)) {
          try {
            await unassignTask(depTask.id).unwrap();
          } catch (error) {
            console.error('Failed to unassign outsourced successor on pick:', error);
          }
        }
      }
    }
  }, [pickActions, snapshot, unassignTask]);

  // v0.3.54: Handle mouse move during pick (update ghost position and validate)
  // v0.3.56: Added early-exit optimization when cursor stays in same slot
  const handlePickMouseMove = useCallback((stationId: string, clientX: number, clientY: number, relativeY: number) => {
    // Update ghost position for RAF rendering (PickPreview handles offset internally)
    pickActions.updateGhostPosition(clientX, clientY);

    // Calculate tile top from cursor position (cursor is PICK_CURSOR_OFFSET_Y pixels inside the tile)
    const tileTopY = relativeY - PICK_CURSOR_OFFSET_Y;
    const snappedTileTop = snapToGrid(Math.max(0, tileTopY), pixelsPerHour);

    // v0.3.56: Early-exit if cursor is in the same slot (skip redundant validation)
    const slotKey = `${stationId}-${snappedTileTop}`;
    if (slotKey === lastPickSlotRef.current) {
      return; // Ghost position already updated, skip validation
    }
    lastPickSlotRef.current = slotKey;

    const dropTime = yPositionToTime(snappedTileTop, START_HOUR, gridStartDate, pixelsPerHour);
    const scheduledStart = dropTime.toISOString();

    // Validate placement
    const proposedAssignment: ProposedAssignment = {
      taskId: pickedTask?.id || '',
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence: isAltPressed,
    };
    const validationResult = pickedTask ? validateAssignment(proposedAssignment, snapshot) : { valid: false, conflicts: [] };

    // Check for blocking conflicts
    // Note: Unlike drag-and-drop, pick mode does NOT auto-snap to suggestedStart,
    // so PrecedenceConflict is always blocking (unless Alt-bypassed).
    // StationConflict IS blocking in pick mode (means overlap with another task).
    const blockingConflicts = validationResult.conflicts.filter(
      (c) => !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
    );

    // Check if only warning (non-blocking) conflicts exist
    const hasWarningOnly = blockingConflicts.length === 0 &&
      validationResult.conflicts.some((c) => c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates');

    // Determine ring state
    let ringState: 'none' | 'valid' | 'invalid' | 'warning' | 'bypass';

    if (validationResult.valid) {
      ringState = 'valid';
    } else if (blockingConflicts.length === 0) {
      ringState = validationResult.conflicts.some((c) => c.type === 'ApprovalGateConflict') ? 'warning' : 'valid';
    } else if (isAltPressed && validationResult.conflicts.some((c) => c.type === 'PrecedenceConflict')) {
      ringState = 'bypass';
    } else {
      ringState = 'invalid';
    }

    // Get validation message for display
    const message = getPrimaryValidationMessage(validationResult.conflicts, validationResult.valid, hasWarningOnly);

    // Debug: store conflicts for overlay
    const debugConflicts = validationResult.conflicts.map(c => ({ type: c.type, message: c.message }));

    setPickValidation({ scheduledStart, ringState, message, debugConflicts });
  }, [pickActions, pickedTask, snapshot, isAltPressed, pixelsPerHour, gridStartDate]);

  // v0.3.54: Handle mouse leave during pick
  const handlePickMouseLeave = useCallback(() => {
    setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
  }, []);

  // v0.3.54: Handle click to place during pick
  // v0.3.57: Added reschedule support (when pickedAssignmentId exists)
  // v0.5.2: Now uses RTK Query mutations
  const handlePickClick = useCallback(async (stationId: string, clientX: number, clientY: number, relativeY: number) => {
    if (!pickedTask || !pickedJob) return;

    // Calculate tile top from cursor position (cursor is PICK_CURSOR_OFFSET_Y pixels inside the tile)
    const tileTopY = relativeY - PICK_CURSOR_OFFSET_Y;
    const snappedTileTop = snapToGrid(Math.max(0, tileTopY), pixelsPerHour);
    const dropTime = yPositionToTime(snappedTileTop, START_HOUR, gridStartDate, pixelsPerHour);
    const rawScheduledStart = dropTime.toISOString();

    // Snap to grid interval (SNAP_INTERVAL_MINUTES)
    const startDate = new Date(rawScheduledStart);
    const minutes = startDate.getMinutes();
    const snappedMinutes = Math.round(minutes / SNAP_INTERVAL_MINUTES) * SNAP_INTERVAL_MINUTES;
    startDate.setMinutes(snappedMinutes, 0, 0);
    const scheduledStart = startDate.toISOString();

    // Validate
    const proposedAssignment: ProposedAssignment = {
      taskId: pickedTask.id,
      targetId: stationId,
      isOutsourced: false,
      scheduledStart,
      bypassPrecedence: isAltPressed,
    };
    const validationResult = validateAssignment(proposedAssignment, snapshot);

    // Check for blocking conflicts
    // StationConflict is NOT blocking (push-down) UNLESS the existing tile is completed
    // PrecedenceConflict with suggestedStart is NOT blocking (can be placed at suggested time)
    // ApprovalGateConflict for Plates is NOT blocking
    const blockingConflicts = validationResult.conflicts.filter(
      (c) => !(c.type === 'StationConflict' && !c.details?.existingTaskIsCompleted) &&
             !(c.type === 'PrecedenceConflict' &&
               c.details?.constraintType === 'predecessor' &&
               validationResult.suggestedStart) &&
             !(c.type === 'ApprovalGateConflict' && c.details?.gate === 'Plates')
    );

    if (blockingConflicts.length > 0 && !isAltPressed) {
      console.log('Pick placement blocked: validation failed', blockingConflicts);
      // Cancel pick so the tile returns to its original state
      // v0.5.14: Restore outsourced successor assignments (same as ESC cancel)
      const savedGridPickInfo = gridPickInfoRef.current;
      gridPickInfoRef.current = null;
      pickActions.cancelPick();
      setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
      if (savedGridPickInfo) {
        rescheduleTask({
          taskId: savedGridPickInfo.taskId,
          body: {
            targetId: savedGridPickInfo.targetId,
            scheduledStart: savedGridPickInfo.scheduledStart,
            isOutsourced: false,
          },
        }).catch((error: unknown) => {
          console.error('Failed to restore outsourced assignments on blocked placement:', error);
        });
      }
      return;
    }

    // Check for precedence conflict WITHOUT bypass (to detect actual conflicts)
    // This is needed because when ALT is pressed, the validation passes and conflicts are empty
    const proposalWithoutBypass: ProposedAssignment = {
      ...proposedAssignment,
      bypassPrecedence: false,
    };
    const validationWithoutBypass = validateAssignment(proposalWithoutBypass, snapshot);
    const hasPrecedenceConflict = validationWithoutBypass.conflicts.some(
      (c) => c.type === 'PrecedenceConflict' && c.details?.constraintType === 'predecessor'
    );

    // Auto-snap to suggestedStart if there's a precedence conflict (without Alt bypass)
    // This ensures the tile is placed at the earliest valid position
    const effectiveStart = (!isAltPressed && hasPrecedenceConflict && validationWithoutBypass.suggestedStart)
      ? validationWithoutBypass.suggestedStart
      : scheduledStart;

    if (effectiveStart !== scheduledStart) {
      console.log('Auto-snap: precedence conflict detected, using suggestedStart:', {
        original: scheduledStart,
        snapped: effectiveStart,
      });
    }

    // Cast to InternalTask for API call
    const task = pickedTask as InternalTask;

    // v0.3.57: Determine if this is a reschedule (grid pick with assignmentId)
    const isRescheduleOp = pickedAssignmentId !== null;

    // Determine if we're creating a precedence conflict via ALT bypass
    const creatingPrecedenceConflict = isAltPressed && hasPrecedenceConflict;

    // v0.5.2: Use RTK Query mutations for assignment operations
    try {
      if (isRescheduleOp) {
        // Reschedule existing assignment
        await rescheduleTask({
          taskId: task.id,
          body: {
            targetId: stationId,
            scheduledStart: effectiveStart,
            isOutsourced: false,
            bypassPrecedence: creatingPrecedenceConflict,
          },
        }).unwrap();
        console.log('Pick reschedule completed:', { taskId: task.id, scheduledStart: effectiveStart, bypassPrecedence: creatingPrecedenceConflict });
      } else {
        // Create new assignment
        await assignTask({
          taskId: task.id,
          body: {
            targetId: stationId,
            scheduledStart: effectiveStart,
            isOutsourced: false,
            bypassPrecedence: creatingPrecedenceConflict,
          },
        }).unwrap();
        console.log('Pick placement created:', { taskId: task.id, scheduledStart: effectiveStart, bypassPrecedence: creatingPrecedenceConflict });
      }
      // Cache invalidation is automatic via invalidatesTags
    } catch (error) {
      console.error('Failed to place/reschedule task:', error);
      showToast(getErrorMessage(error));
    }

    gridPickInfoRef.current = null; // v0.5.14: Clear grid pick info on successful placement
    pickActions.completePlacement();
    lastPickSlotRef.current = null; // v0.3.56: Clear slot tracking on successful placement
    setPickValidation({ scheduledStart: null, ringState: 'none', message: null, debugConflicts: [] });
  }, [pickedTask, pickedJob, snapshot, isAltPressed, pixelsPerHour, gridStartDate, pickActions, pickedAssignmentId, assignTask, rescheduleTask, showToast]);

  // Handle global timeline compaction (v0.3.35)
  // Compacts each station that has assignments via the compact endpoint.
  // Runs multiple passes to resolve cross-station dependencies: if a successor's
  // station is compacted before its predecessor's station, the successor can only
  // fully compact once the predecessor has been compacted in a previous pass.
  const handleCompactTimeline = useCallback(async (_horizonHours: CompactHorizon) => {
    setIsCompactingTimeline(true);
    try {
      const stationsWithAssignments = snapshot.stations.filter((s) =>
        snapshot.assignments.some((a) => a.targetId === s.id && !a.isOutsourced)
      );
      // Multiple passes: each pass resolves one level of cross-station dependencies.
      // $now advances between passes but only by seconds — negligible vs. hour-scale
      // scheduling. Already-compacted tasks won't re-compact (earliestStart >= scheduledStart).
      const MAX_PASSES = 5;
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        let passCompacted = 0;
        for (const station of stationsWithAssignments) {
          const result = await compactStation(station.id).unwrap();
          passCompacted += result.compactedCount;
        }
        if (passCompacted === 0) break;
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsCompactingTimeline(false);
    }
  }, [snapshot.stations, snapshot.assignments, compactStation, showToast]);

  // v0.5.1: Show loading spinner during initial fetch (real API mode only)
  // In mock mode, data is always instantly available, so we skip the loading state
  // This check is placed after all hooks to comply with Rules of Hooks
  const isMockMode = shouldUseMockMode();
  if (isLoading && !isMockMode) {
    return <LoadingSpinner message="Chargement des données..." />;
  }

  // v0.5.7: Show maintenance page for 503 Service Unavailable
  if (isServiceUnavailable) {
    return <MaintenanceState onRetry={refetch} />;
  }

  // v0.5.1: Show error state with retry button if fetch failed
  if (isError) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navigation Bar - now only spans width after sidebar (REQ-07.2/07.3) */}
          <TopNavBar
            isQuickPlacementMode={isQuickPlacementMode}
            onToggleQuickPlacement={handleToggleQuickPlacement}
            canEnableQuickPlacement={selectedJobId !== null}
            pixelsPerHour={pixelsPerHour}
            onZoomChange={handleZoomChange}
            onCompactTimeline={handleCompactTimeline}
            isCompacting={isCompactingTimeline}
            displayMode={displayMode}
          />

          {/* Content area */}
          <div className="flex-1 flex overflow-hidden">
          <JobsList
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          lateJobs={snapshot.lateJobs}
          conflicts={snapshot.conflicts}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          onAddJob={handleOpenJcf}
        />
        <JobDetailsPanel
          job={selectedJob}
          tasks={snapshot.tasks}
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          stations={snapshot.stations}
          categories={snapshot.categories}
          providers={snapshot.providers}
          activeTaskId={lastUnscheduledTask?.id}
          pickedTaskId={pickedTask?.id}
          conflictTaskIds={conflictTaskIds}
          onJumpToTask={handleJumpToTask}
          onRecallTask={handleRecallAssignment}
          onPick={handlePickTask}
          onClose={() => setSelectedJobId(null)}
          onDateClick={handleDateClick}
          onElementStatusChange={handleElementStatusChange}
          onToggleComplete={handleToggleComplete}
          onWorkDaysChange={handleOutsourcingWorkDaysChange}
          onDepartureChange={handleOutsourcingDepartureChange}
          onReturnChange={handleOutsourcingReturnChange}
          onEditJob={handleEditJob}
          onDeleteJob={handleDeleteJob}
        />
        <DateStrip
          startDate={gridStartDate}
          onDateClick={handleDateClick}
          departureDate={departureDate}
          scheduledDays={scheduledDays}
          focusedDate={focusedDate}
          viewportStartHour={viewportStartHour}
          viewportEndHour={viewportEndHour}
          taskMarkersPerDay={taskMarkersPerDay}
          earliestTaskDate={earliestTaskDate}
        />
        <SchedulingGrid
          ref={gridRef}
          stations={snapshot.stations}
          categories={snapshot.categories}
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          selectedJobId={deferredSelectedJobId}
          startHour={START_HOUR}
          hoursToDisplay={DAY_COUNT * 24}
          onScroll={handleGridScroll}
          startDate={gridStartDate}
          totalDays={DAY_COUNT}
          onSelectJob={setSelectedJobId}
          onSwapUp={handleSwapUp}
          onSwapDown={handleSwapDown}
          onRecallAssignment={handleRecallAssignment}
          onToggleComplete={handleToggleComplete}
          isQuickPlacementMode={isQuickPlacementMode}
          stationsWithAvailableTasks={stationsWithAvailableTasks}
          quickPlacementIndicatorY={quickPlacementHover.snappedY}
          quickPlacementHoverStationId={quickPlacementHover.stationId}
          onQuickPlacementMouseMove={handleQuickPlacementMouseMove}
          onQuickPlacementMouseLeave={handleQuickPlacementMouseLeave}
          onQuickPlacementClick={handleQuickPlacementClick}
          quickPlacementValidation={quickPlacementValidation}
          isAltPressed={isAltPressed}
          quickPlacementPrecedenceConstraints={quickPlacementPrecedenceConstraints}
          compactingStationId={compactingStationId}
          onCompact={handleCompact}
          conflicts={snapshot.conflicts}
          pixelsPerHour={pixelsPerHour}
          groups={snapshot.groups}
          isPicking={isPicking}
          pickTargetStationId={pickTargetStationId}
          pickRingState={pickValidation.ringState}
          pickSource={pickSource}
          onPickMouseMove={handlePickMouseMove}
          onPickMouseLeave={handlePickMouseLeave}
          onPickClick={handlePickClick}
          pickPrecedenceConstraints={pickPrecedenceConstraints}
          pickDryingTimeInfo={pickDryingTimeInfo}
          pickOutsourcingTimeInfo={pickOutsourcingTimeInfo}
          pickedAssignmentId={pickedAssignmentId}
          onPickFromGrid={handlePickFromGrid}
          onContextMenu={handleContextMenuOpen}
          displayMode={displayMode}
        />
          </div>
        </div>

      {/* v0.3.54: Pick preview - ghost tile during pick */}
      <PickPreview
        validationMessage={pickValidation.message}
        debugInfo={{
          ringState: pickValidation.ringState,
          scheduledStart: pickValidation.scheduledStart,
          conflicts: pickValidation.debugConflicts,
        }}
      />

      {/* v0.3.58: Context menu for tiles */}
      {contextMenu && (
        <TileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isCompleted={contextMenu.isCompleted}
          canSwapUp={getContextMenuSwapAvailability().canSwapUp}
          canSwapDown={getContextMenuSwapAvailability().canSwapDown}
          onViewDetails={handleContextMenuViewDetails}
          onToggleComplete={handleContextMenuToggleComplete}
          onSwapUp={handleContextMenuMoveUp}
          onSwapDown={handleContextMenuMoveDown}
          onClose={handleContextMenuClose}
        />
      )}

      {/* v0.4.6: JCF Modal */}
      <JcfModal
        isOpen={isJcfModalOpen}
        onClose={handleCloseJcf}
        title={isEditMode ? `Modifier ${jcfJobId}` : undefined}
        saveLabel={isEditMode ? 'Mettre à jour' : undefined}
        onSave={handleJcfSave}
        isSaving={isJcfSaving}
        error={jcfSaveError}
        onSaveAsTemplate={isEditMode ? undefined : handleSaveAsTemplate}
        canSaveAsTemplate={jcfElements.length > 0 && jcfElements.some(el => el.name.trim() !== '')}
      >
        <JcfJobHeader
          jobId={jcfJobId}
          onJobIdChange={isEditMode ? undefined : setJcfJobId}
          client={jcfClient}
          onClientChange={setJcfClient}
          template={jcfTemplate}
          onTemplateChange={setJcfTemplate}
          onTemplateSelect={isEditMode ? undefined : handleTemplateSelect}
          intitule={jcfIntitule}
          onIntituleChange={setJcfIntitule}
          quantity={jcfQuantity}
          onQuantityChange={setJcfQuantity}
          shipperId={jcfShipperId}
          onShipperIdChange={setJcfShipperId}
          deadline={jcfDeadline}
          onDeadlineChange={setJcfDeadline}
        />
        {/* v0.4.9: Elements Table */}
        <div className="mt-[13px]">
          <JcfElementsTable
            elements={jcfElements}
            onElementsChange={setJcfElements}
            postePresets={snapshotPostes}
            sequenceWorkflows={shouldUseFixture() ? TEST_SEQUENCE_WORKFLOWS : sequenceWorkflows}
            jobQuantity={jcfQuantity}
            onSaveAttemptRef={jcfSaveAttemptRef}
          />
        </div>
      </JcfModal>

      {/* v0.4.34: Template editor modal (for "Save as Template") */}
      <JcfTemplateEditorModal
        isOpen={isTemplateEditorOpen}
        onSave={handleTemplateSave}
        onCancel={handleTemplateEditorCancel}
        isSaving={isTemplateSaving}
        postePresets={snapshotPostes}
        initialElements={jcfElements.filter(el => el.name.trim() !== '').map((el, i) => ({
          name: el.name,
          precedences: el.precedences,
          quantite: el.quantite,
          format: el.format,
          pagination: el.pagination,
          papier: el.papier,
          imposition: el.imposition,
          impression: el.impression,
          surfacage: el.surfacage,
          autres: el.autres,
          qteFeuilles: el.qteFeuilles,
          commentaires: el.commentaires,
          sequence: sequenceWorkflows[i]?.length > 0 ? sequenceWorkflows[i].join('\n') : '',
        }))}
        initialClientName={jcfClient}
      />

      {/* v0.5.2: Toast notifications for JCF errors */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onDismiss={hideToast}
      />

      {/* v0.5.7: Global toast for API errors */}
      <GlobalToast />
    </>
  );
}

// Main App component wrapping with PickStateProvider and ErrorBoundary
function App() {
  return (
    <ErrorBoundary>
      <PickStateProvider>
        <AppContent />
      </PickStateProvider>
    </ErrorBoundary>
  );
}

export default App;
