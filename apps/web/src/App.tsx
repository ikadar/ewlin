import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { JobsList, JobDetailsPanel, DateStrip, SchedulingGrid, timeToYPosition, DEFAULT_PIXELS_PER_HOUR, TileContextMenu, JcfModal, JcfJobHeader, generateJobId, JcfElementsTable, ShortcutFooter, useCommands, useCommandCenter } from './components';
import { useTheme } from './contexts/ThemeContext';
import { ZOOM_LEVELS } from './utils/zoom';
import { Save, ClipboardCopy, Cpu } from 'lucide-react';
import { buildDebugPayload } from './utils/debugExport';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorState } from './components/ErrorState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalToast } from './components/GlobalToast';
import { MaintenanceState } from './components/MaintenanceState';
import type { JcfElement } from './components';
import { DEFAULT_ELEMENT } from './components';
import { ScheduleSaveLoadModal } from './components/ScheduleSaveLoad';
import { ComputeModal } from './components/ComputeModal/ComputeModal';
import { SmartCompactModal } from './components/SmartCompactModal';
import { ScheduleEvaluationModal } from './components/ScheduleEvaluationModal';
import { JcfTemplateEditorModal } from './components/JcfTemplateEditorModal';
import type { TemplateEditorData } from './components/JcfTemplateEditorModal';
import type { JcfTemplate } from '@flux/types';
import type { SchedulingGridHandle, TaskMarker } from './components';
import { updateSnapshot } from './mock';
import { buildSequenceIndexLookup } from './utils/safetyZone';
import { StalenessBadge } from './components/StalenessBadge';
import { shouldUseFixture } from './mock/testFixtures';
import { useGetSnapshotQuery, scheduleApi, useUnassignTaskMutation, useToggleCompletionMutation, useTogglePinMutation, useBatchSetPinMutation, useUpdateOutsourcingDatesMutation, useSplitTaskMutation, useFuseTaskMutation, useCreateJobMutation, useUpdateJobMutation, useDeleteJobMutation, useClearJobAssignmentsMutation, useAutoPlaceJobMutation, useAutoPlaceJobAlapMutation, useCreateTemplateMutation, useUpdateTemplateMutation, useSaveScheduleMutation, useSetSafetyOverrideMutation, useAppSelector, selectIsServiceUnavailable } from './store';
import { shouldUseMockMode } from './store/api/baseApi';
import { useUpdateSTStatusMutation } from './store';
import { taskStatusToFluxST, nextSTStatus } from './components/FluxTable/STCell';
import { Toast } from './components/Toast';
import { useToast, useMassUnschedule } from './hooks';
import { useAutoRecomputeCtx } from './contexts/AutoRecomputeContext';
import { runBackgroundLns } from './hooks/autoRecomputeRuntime';
import { computeCollapses } from './utils/computeCollapses';
import type { Collapse } from './components/SchedulingGrid/collapseConfig';
import { yPositionToTime } from './components/DragPreview/snapUtils';
import { MassUnscheduleDialog } from './components/MassUnscheduleDialog';
import { getErrorMessage } from './store/api/errorNormalization';
import { useAppDispatch } from './store';
import { fluxApi } from './store/api/fluxApi';
import { formatAutoSaveName, getTasksForJob, getJobIdForTask, compareTaskOrder, createTaskToJobMap } from './utils';
import type { Task, Job, InternalTask, TaskAssignment, Station, StationCategory } from '@flux/types';
import { getDeadlineDate } from '@flux/types';
import { calculateReturnDate } from './utils/outsourcingCalculation';
import { isLastTaskOfJob } from './utils/taskHelpers';
import { transformJcfToRequest, transformJcfElementToRequest } from './api';
import { getDefaultCategoryWidth } from './utils/tileLabelResolver';
import { getLayoutDimensions, getStationXOffset } from './utils/gridLayout';
import { detectKeyboardLayout, isAltLetter, isCtrlAltLetter } from './utils/keyboardLayout';
import { FluxPage } from './pages/FluxPage';
import { SplitTaskPopover } from './components/SplitTaskPopover';
import { Minimap } from './components/Minimap';

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
// getLayoutDimensions and getStationXOffset imported from ./utils/gridLayout

// ============================================================================
// Keyboard shortcut handlers (extracted to reduce cognitive complexity S3776)
// ============================================================================

interface KeyboardContext {
  selectedJobId: string | null;
  isJcfOpen: boolean;
  orderedJobIds: string[];
  selectedJob: Job | null;
  gridRef: React.RefObject<SchedulingGridHandle | null>;
  pixelsPerHour: number;
  gridStartDate: Date;
  /** Collapse bands currently active on the grid — required by `timeToYPosition`
   *  calls inside the jump-to handlers so scroll targets match the rendered Y. */
  collapses: readonly Collapse[];
  setSelectedJobId: (id: string | null) => void;
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
      const y = timeToYPosition(departureDate, START_HOUR, ctx.pixelsPerHour, ctx.gridStartDate, ctx.collapses);
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
      const y = timeToYPosition(now, START_HOUR, ctx.pixelsPerHour, ctx.gridStartDate, ctx.collapses);
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
  if (!isAltLetter(e, 'a')) return false;
  e.preventDefault();
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

/**
 * Convert a station-level DSL sequence to category-level sequence for templates.
 * Input: "Ryobi524(15+60)\nPolar137(15+15)\nMBOS(60+105)"
 * Output: "Offset\nCoupe\nPliage" (categories in order, consecutive dupes removed)
 */
function sequenceDslToCategories(
  dsl: string,
  postes: Array<{ name: string; category: string }>,
): string {
  if (!dsl.trim()) return '';
  const posteMap = new Map(postes.map(p => [p.name.toLowerCase(), p.category]));
  const categories: string[] = [];
  for (const line of dsl.split('\n')) {
    // Extract station name: everything before '(' or whitespace
    const stationName = line.trim().split(/[(\s]/)[0];
    if (!stationName) continue;
    const category = posteMap.get(stationName.toLowerCase());
    if (category && category !== categories[categories.length - 1]) {
      categories.push(category);
    }
  }
  return categories.join('\n');
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
        operators: [],
      },
    [snapshotData],
  );

  // Filter stations to only show Available ones in the Gantt grid
  const activeStations = useMemo(
    () => snapshot.stations.filter(s => s.status === 'Available'),
    [snapshot.stations],
  );

  // Derive poste presets from snapshot stations (single source of truth)
  const snapshotPostes = useMemo(
    () => stationsToPostes(snapshot.stations, snapshot.categories),
    [snapshot.stations, snapshot.categories],
  );

  // v0.5.2: RTK Query mutations for assignment operations
  const [unassignTask] = useUnassignTaskMutation();
  const [toggleCompletion] = useToggleCompletionMutation();
  const [togglePin] = useTogglePinMutation();
  const [batchSetPin] = useBatchSetPinMutation();
  const [setSafetyOverride] = useSetSafetyOverrideMutation();
  const [updateOutsourcingDates] = useUpdateOutsourcingDatesMutation();
  const [updateSTStatus] = useUpdateSTStatusMutation();

  const [splitTask] = useSplitTaskMutation();
  const [fuseTask] = useFuseTaskMutation();
  const [createJob] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();
  const [deleteJob] = useDeleteJobMutation();
  const [clearJobAssignments] = useClearJobAssignmentsMutation();

  const [autoPlaceJob] = useAutoPlaceJobMutation();
  const [autoPlaceJobAlap] = useAutoPlaceJobAlapMutation();
  const [saveSchedule] = useSaveScheduleMutation();
  const [createTemplate] = useCreateTemplateMutation();
  const [updateTemplate] = useUpdateTemplateMutation();
  const [computeModalMode, setComputeModalMode] = useState<'full' | 'selective' | 'incremental' | null>(null);
  const [computeModalJobId, setComputeModalJobId] = useState<string | undefined>(undefined);

  // v0.5.2: Toast notifications for errors
  const { toast, showToast, hideToast } = useToast();
  const { theme } = useTheme();

  // v0.6.x: Auto-recompute orchestration lives at RootLayout level (see
  // AutoRecomputeContext) so it survives route changes — otherwise the
  // debounce / LNS stream in flight would be killed when JCF save
  // navigates away (e.g. from /flux). App.tsx just consumes the ready
  // `trigger` + status bits.
  const autoRecompute = useAutoRecomputeCtx();

  // v0.4.38: URL-based job selection with React Router
  // Use local state for fast UI updates, sync URL silently
  const { jobId: urlJobId } = useParams<{ jobId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Local state for immediate UI response
  const [selectedJobId, setSelectedJobIdLocal] = useState<string | null>(() => {
    // Initialize from URL on mount
    if (location.pathname === '/stations/job/new') return null;
    return urlJobId ?? null;
  });

  // Sync URL → state when URL changes (browser back/forward, direct navigation)
  useEffect(() => {
    const urlSelectedJobId = location.pathname === '/stations/job/new' ? null : (urlJobId ?? null);
    if (urlSelectedJobId !== selectedJobId) {
      setSelectedJobIdLocal(urlSelectedJobId);
    }
  }, [urlJobId, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrapper that updates local state (fast) and URL silently (no React Router re-render)
  const setSelectedJobId = useCallback((jobId: string | null) => {
    setSelectedJobIdLocal(jobId); // Immediate UI update
    // Update URL silently using History API - no React Router re-render
    const newUrl = jobId ? `/stations/job/${jobId}` : '/stations';
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Deferred value for grid: tile isSelected logic can lag, visual highlight is handled by CSS selector
  const deferredSelectedJobId = useDeferredValue(selectedJobId);

  // Display mode state (Produit / Tirage)
  const [displayMode, setDisplayMode] = useState<'produit' | 'tirage'>('produit');

  // Smart compaction modal state
  const [isSmartCompactOpen, setIsSmartCompactOpen] = useState(false);

  // Schedule evaluation modal state
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);

  // Zoom state (v0.3.34)
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PIXELS_PER_HOUR);

  // v0.3.58: Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    assignmentId: string;
    isCompleted: boolean;
    isPinned: boolean;
  } | null>(null);

  // Split task popover state
  const [splitPopover, setSplitPopover] = useState<{
    x: number;
    y: number;
    taskId: string;
    task: InternalTask;
    stationName: string;
  } | null>(null);

  // v0.4.38: JCF modal state derived from URL
  // Modal opens when URL is /job/new
  const isJcfModalOpen = location.pathname === '/stations/job/new';
  const isJcfFromFlux = isJcfModalOpen && (location.state as { from?: string } | null)?.from?.startsWith('/flux');
  // Remember which job was selected before JCF opened, so we can restore on close
  const preJcfSelectedJobIdRef = useRef<string | null>(null);
  // v0.4.7: JCF form state (lifted from JcfJobHeader)
  const [jcfJobId, setJcfJobId] = useState('');
  const [jcfIntitule, setJcfIntitule] = useState('');
  const [jcfQuantity, setJcfQuantity] = useState('');
  const [jcfShipperId, setJcfShipperId] = useState('');
  const [jcfRequiredJobs, setJcfRequiredJobs] = useState('');
  const [jcfDeadline, setJcfDeadline] = useState('');
  const [jcfBatDeadline, setJcfBatDeadline] = useState('');
  const [jcfDeadlinePriority, setJcfDeadlinePriority] = useState(2);
  // v0.4.8: Client and Template autocomplete state
  const [jcfClient, setJcfClient] = useState('');
  const [jcfReferent, setJcfReferent] = useState('');
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
  // Schedule save/load modal
  const [isSaveLoadOpen, setIsSaveLoadOpen] = useState(false);
  // Mass unschedule (shared hook)
  const massUnschedule = useMassUnschedule(snapshotData);
  // Command Center (global — provided by RootLayout)
  const { isOpen: isCommandPaletteOpen, setIsOpen: setIsCommandPaletteOpen, registerPageCommands, unregisterPageCommands, registerJobs, unregisterJobs } = useCommandCenter();

  // Sidebar visibility toggle (Alt+B)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Minimap visibility toggle (Alt+M), persisted
  const [isMinimapVisible, setIsMinimapVisible] = useState(() =>
    localStorage.getItem('flux-minimap-visible') !== 'false'
  );
  useEffect(() => {
    localStorage.setItem('flux-minimap-visible', String(isMinimapVisible));
  }, [isMinimapVisible]);

  // Minimap needs scroll positions as state for re-render
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [gridScrollLeft, setGridScrollLeft] = useState(0);

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
            referent: jcfReferent || null,
            description: jcfIntitule,
            workshopExitDate: jcfDeadline,
            batDeadline: jcfBatDeadline || null,
            deadlinePriority: jcfDeadlinePriority,
            elements: jcfElements.map(transformJcfElementToRequest),
            ...(jcfQuantity ? { quantity: parseInt(jcfQuantity, 10) } : {}),
            shipperId: jcfShipperId || null,
            requiredJobReferences: jcfRequiredJobs
              ? jcfRequiredJobs.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
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
          jcfRequiredJobs || undefined,
          jcfBatDeadline || undefined,
          jcfReferent || undefined,
          jcfDeadlinePriority,
        );
        await createJob(request).unwrap();
      }

      // Success: close modal and reset form
      // Cache invalidation: Snapshot is automatic via invalidatesTags, Flux needs explicit invalidation
      setIsJcfSaving(false);
      dispatch(fluxApi.util.invalidateTags(['FluxJobs']));
      // Auto-recompute: keep the planning fresh after the save.
      autoRecompute.trigger(isEditMode ? `edit job ${editingJobId}` : 'create job');
      // Navigate back: preserve current surface so App.tsx (and its
      // useAutoRecompute debounced trigger above) stays mounted long
      // enough to fire the background compute. Falling back to '/' here
      // unmounts App and cancels the pending timer, losing the recompute.
      const fromRoute = (location.state as { from?: string } | null)?.from;
      const defaultDest = location.pathname.startsWith('/stations') ? '/stations' : '/';
      navigate(fromRoute?.startsWith('/flux') ? fromRoute : defaultDest, { replace: true });
      setJcfClient('');
      setJcfReferent('');
      setJcfTemplate('');
      setJcfIntitule('');
      setJcfQuantity('');
      setJcfShipperId('');
      setJcfRequiredJobs('');
      setJcfDeadline('');
      setJcfBatDeadline('');
      setJcfDeadlinePriority(2);
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
  }, [jcfJobId, jcfClient, jcfReferent, jcfIntitule, jcfDeadline, jcfBatDeadline, jcfDeadlinePriority, jcfElements, jcfQuantity, jcfShipperId, jcfRequiredJobs, navigate, createJob, updateJob, showToast, isEditMode, editingJobId, location.state, dispatch, autoRecompute]);

  // v0.4.38: Navigate to /job/new to open modal
  const handleOpenJcf = useCallback(() => {
    preJcfSelectedJobIdRef.current = selectedJobId;
    setJcfJobId(generateJobId());
    navigate('/stations/job/new');
  }, [navigate, selectedJobId]);

  // v0.4.38: Navigate away from /job/new to close modal
  // Restore URL to previously selected job (if any) instead of always to /
  const handleCloseJcf = useCallback(() => {
    const fromRoute = (location.state as { from?: string } | null)?.from;
    const savedJobId = preJcfSelectedJobIdRef.current;

    let restoreUrl: string;
    if (fromRoute?.startsWith('/flux')) {
      restoreUrl = fromRoute;
    } else if (fromRoute === '/') {
      restoreUrl = '/';
    } else if (savedJobId) {
      restoreUrl = `/stations/job/${savedJobId}`;
    } else {
      restoreUrl = '/stations';
    }

    navigate(restoreUrl, { replace: true });
    preJcfSelectedJobIdRef.current = null;
    setJcfClient('');
    setJcfReferent('');
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

  // Grid ref for programmatic scrolling
  const gridRef = useRef<SchedulingGridHandle>(null);

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
    setJcfReferent(job.referent ?? '');
    setJcfIntitule(job.description);
    setJcfDeadline(job.workshopExitDate);
    setJcfBatDeadline(job.batDeadline ?? '');
    setJcfDeadlinePriority(job.deadlinePriority ?? 2);
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
          .sort(compareTaskOrder);
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

    const requiredJobRefs = (job.requiredJobIds ?? [])
      .map((id) => snapshot.jobs.find((j) => j.id === id)?.reference)
      .filter((ref): ref is string => ref !== undefined)
      .join(', ');
    setJcfRequiredJobs(requiredJobRefs);

    setIsEditMode(true);
    setEditingJobId(job.id);
    setSequenceWorkflows([]);
    setJcfSaveError(null);
  }, [snapshot.elements, snapshot.tasks, snapshot.stations, snapshot.providers, snapshot.jobs]);

  // v0.5.13b: Handler for "Modifier" button in Job Details Panel (scheduler view)
  const handleEditJob = useCallback(() => {
    if (!selectedJob) return;
    populateJcfFromJob(selectedJob);
    preJcfSelectedJobIdRef.current = selectedJobId;
    navigate('/stations/job/new');
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
      dispatch(fluxApi.util.invalidateTags(['FluxJobs']));
      autoRecompute.trigger(`delete job ${selectedJobId}`);
    } catch (err) {
      showToast(`Échec de la suppression: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, 'error');
    }
  }, [selectedJobId, deleteJob, setSelectedJobId, showToast, dispatch, autoRecompute]);

  // REQ-14: Calculate grid/DateStrip start date (lookbackDays before today)
  const lookbackDays = snapshotData?.lookbackDays ?? 6;
  const gridStartDate = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() - lookbackDays);
    today.setHours(START_HOUR, 0, 0, 0);
    return today;
  }, [lookbackDays]);

  // ---- Collapse empty periods (mirror of OperatorSchedulePage wiring) ----
  const gridEndDate = useMemo(
    () => new Date(gridStartDate.getTime() + DAY_COUNT * 24 * 60 * 60 * 1000),
    [gridStartDate],
  );
  const effectiveCollapses = useMemo(
    () => computeCollapses(snapshot.operators ?? [], gridStartDate, gridEndDate),
    [snapshot.operators, gridStartDate, gridEndDate],
  );

  // Category lookup map (for getStationXOffset)
  const categoryMap = useMemo(() => {
    const map = new Map<string, import('@flux/types').StationCategory>();
    snapshot.categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [snapshot.categories]);

  // REQ-14: Auto-scroll to today on initial load
  const hasScrolledToToday = useRef(false);
  useEffect(() => {
    if (hasScrolledToToday.current || !gridRef.current) return;

    // Calculate Y position for today at current time
    const now = new Date();
    const y = timeToYPosition(now, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);

    // Scroll to center today in the viewport
    const viewportHeight = gridRef.current.getViewportHeight();
    const scrollTarget = Math.max(0, y - viewportHeight / 2);
    gridRef.current.scrollToY(scrollTarget, 'instant');

    hasScrolledToToday.current = true;
  }, [pixelsPerHour, gridStartDate, effectiveCollapses]);

  // REQ-15: Get departure date for selected job
  const departureDate = useMemo(() => {
    if (!selectedJob?.workshopExitDate) return null;
    return new Date(selectedJob.workshopExitDate);
  }, [selectedJob?.workshopExitDate]);

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

  // REQ-16 + v0.3.47: Consolidated schedule data for selected job (single-pass)
  // Computes scheduledDays, taskMarkersPerDay, and earliestTaskDate in one scan.
  const { scheduledDays, taskMarkersPerDay, earliestTaskDate } = useMemo(() => {
    const emptyResult = {
      scheduledDays: new Set<string>(),
      taskMarkersPerDay: new Map<string, TaskMarker[]>(),
      earliestTaskDate: null as Date | null,
    };
    if (!selectedJobId) return emptyResult;

    const now = new Date();
    const jobTaskIds = new Set(
      getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements).map((t) => t.id)
    );

    const days = new Set<string>();
    const markers = new Map<string, TaskMarker[]>();
    let earliest: Date | null = null;

    for (const a of snapshot.assignments) {
      if (!jobTaskIds.has(a.taskId)) continue;

      const scheduledStart = new Date(a.scheduledStart);
      const scheduledEnd = new Date(a.scheduledEnd);

      // taskMarkersPerDay (local date key to match DateStrip's local calendar)
      const year = scheduledStart.getFullYear();
      const month = String(scheduledStart.getMonth() + 1).padStart(2, '0');
      const day = String(scheduledStart.getDate()).padStart(2, '0');
      const markerDateKey = `${year}-${month}-${day}`;

      // scheduledDays (local date key to match DateStrip's formatDateKey)
      days.add(markerDateKey);
      const startHour = scheduledStart.getHours() + scheduledStart.getMinutes() / 60;

      let status: TaskMarker['status'] = 'scheduled';
      if (a.isCompleted) {
        status = 'completed';
      } else if (conflictTaskIds.has(a.taskId)) {
        status = 'conflict';
      } else if (scheduledEnd < now) {
        status = 'late';
      }

      const existing = markers.get(markerDateKey) ?? [];
      existing.push({ taskId: a.taskId, status, startHour });
      markers.set(markerDateKey, existing);

      // earliestTaskDate
      if (!earliest || scheduledStart < earliest) {
        earliest = scheduledStart;
      }
    }

    return { scheduledDays: days, taskMarkersPerDay: markers, earliestTaskDate: earliest };
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments, conflictTaskIds]);

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
  const handleGridScroll = useCallback((scrollTop: number, scrollLeft: number) => {
    // Store scrollTop for recalculation on zoom change
    lastScrollTopRef.current = scrollTop;
    setGridScrollTop(scrollTop);
    setGridScrollLeft(scrollLeft);

    // Calculate viewport synchronously for immediate indicator update
    const currentPixelsPerHour = pixelsPerHourRef.current;
    const viewportHeight = gridRef.current?.getViewportHeight() ?? 600;

    // Viewport hours — collapse-aware. Linear `scrollTop / pxPerHour` would
    // mis-report the visible time span when bands compress the Y range.
    const topTime = yPositionToTime(scrollTop, START_HOUR, gridStartDate, currentPixelsPerHour, effectiveCollapses);
    const bottomTime = yPositionToTime(scrollTop + viewportHeight, START_HOUR, gridStartDate, currentPixelsPerHour, effectiveCollapses);
    const startHourFromGridStart = (topTime.getTime() - gridStartDate.getTime()) / 3_600_000;
    const endHourFromGridStart = (bottomTime.getTime() - gridStartDate.getTime()) / 3_600_000;
    setViewportStartHour(startHourFromGridStart);
    setViewportEndHour(endHourFromGridStart);

    // Focused date — can use rAF since it's less time-critical
    if (scrollTimeoutRef.current !== null) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = requestAnimationFrame(() => {
      const centerY = scrollTop + viewportHeight / 2;
      // Collapse-aware reverse mapping: yPositionToTime walks the band offsets
      // so the focused date stays correct even when bands compress the Y range.
      const focusedTime = yPositionToTime(centerY, START_HOUR, gridStartDate, currentPixelsPerHour, effectiveCollapses);
      setFocusedDate(focusedTime);
    });
  }, [gridStartDate, effectiveCollapses]);

  // v0.3.47: Recalculate viewport when zoom (pixelsPerHour) changes
  // This ensures the viewport indicator stays on the correct day after zoom
  useEffect(() => {
    if (lastScrollTopRef.current > 0) {
      // Trigger recalculation with the stored scrollTop
      handleGridScroll(lastScrollTopRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelsPerHour]); // handleGridScroll is stable, pixelsPerHour triggers recalc

  // Real-time clock for NOW-surpassed overdue detection (updated every 60 s)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Late job IDs: deadline violations (snapshot) + real-time NOW-surpassed tasks
  const lateJobIds = useMemo(() => {
    const ids = new Set(snapshot.lateJobs.map((lj) => lj.jobId));
    const fromValidation = ids.size;
    const taskToJob = createTaskToJobMap(snapshot.tasks, snapshot.elements);
    for (const a of snapshot.assignments) {
      if (!a.isCompleted && new Date(a.scheduledEnd) < now) {
        const jobId = taskToJob.get(a.taskId);
        if (jobId) ids.add(jobId);
      }
    }
    return ids;
  }, [snapshot.lateJobs, snapshot.assignments, snapshot.tasks, snapshot.elements, now]);

  // Shipped job IDs for state-based tile coloring (highest priority)
  const shippedJobIds = useMemo(
    () => new Set(snapshot.jobs.filter((j) => j.shipped).map((j) => j.id)),
    [snapshot.jobs],
  );

  // Get ordered job IDs for navigation (matching JobsList display order)
  // Problems first (late, then conflicts), then normal jobs
  const orderedJobIds = useMemo(() => {
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

  // Handle clear all tiles for selected job (ALT+Z)
  const handleClearJobAssignments = useCallback(async () => {
    if (!selectedJobId) return;
    try {
      const result = await clearJobAssignments(selectedJobId).unwrap();
      showToast(`${result.unassignedCount} tuile(s) effacée(s)`, 'success');
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [selectedJobId, clearJobAssignments, showToast]);

  // Handle pin/unpin all placed tiles for selected job (Alt+F)
  const handlePinAllJobTiles = useCallback(async () => {
    if (!selectedJobId) return;
    const jobTaskIds = new Set(
      getTasksForJob(selectedJobId, snapshot.tasks, snapshot.elements).map((t) => t.id)
    );
    const jobAssignments = snapshot.assignments.filter((a) => jobTaskIds.has(a.taskId));
    if (jobAssignments.length === 0) return;

    // If all are pinned → unpin all, otherwise → pin all
    const allPinned = jobAssignments.every((a) => a.isPinned);
    const targetPinned = !allPinned;
    const taskIds = jobAssignments
      .filter((a) => a.isPinned !== targetPinned)
      .map((a) => a.taskId);

    if (taskIds.length === 0) return;

    try {
      await batchSetPin({ taskIds, isPinned: targetPinned }).unwrap();
      showToast(
        targetPinned
          ? `${taskIds.length} tuile(s) épinglée(s)`
          : `${taskIds.length} tuile(s) désépinglée(s)`,
        'success'
      );
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [selectedJobId, snapshot.tasks, snapshot.elements, snapshot.assignments, batchSetPin, showToast]);

  // Debug export: copy full snapshot to clipboard
  const handleDebugExport = useCallback(async () => {
    try {
      const text = JSON.stringify(buildDebugPayload(snapshot), null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-HTTPS contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Debug snapshot copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  }, [snapshot, showToast]);

  // Handle compute schedule (full recalculation via ComputeModal)
  const handleComputeSchedule = useCallback(() => {
    setComputeModalJobId(undefined);
    setComputeModalMode('full');
  }, []);

  // Handle incremental compute (all unplaced jobs)
  const handleComputeIncremental = useCallback(() => {
    setComputeModalJobId(undefined);
    setComputeModalMode('incremental');
  }, []);

  // Handle mass unschedule confirm with toast
  const handleMassUnscheduleConfirm = useCallback(async () => {
    try {
      const result = await massUnschedule.confirm();
      if (result) {
        showToast(`${result.unassignedCount} tuile(s) effacée(s)`, 'success');
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [massUnschedule, showToast]);

  // Auto-save schedule before any autoplace operation
  const autoSaveBeforeAutoplace = useCallback(async () => {
    try {
      await saveSchedule({ name: formatAutoSaveName() }).unwrap();
    } catch (error) {
      console.warn('Auto-save before autoplace failed:', error);
      showToast('Sauvegarde auto échouée — placement en cours', 'info');
    }
  }, [saveSchedule, showToast]);

  // Handle ASAP auto-placement for selected job (ALT+P S)
  const handleAsapPlacement = useCallback(async () => {
    if (!selectedJobId) return;
    await autoSaveBeforeAutoplace();
    try {
      const result = await autoPlaceJob(selectedJobId).unwrap();
      if (result.placedCount === 0) {
        showToast('Aucune tuile non planifiée à placer', 'info');
      } else {
        const timing = result.computeMs != null ? ` en ${result.computeMs}ms` : '';
        showToast(`${result.placedCount} tuile(s) placée(s) ASAP${timing}`, 'success');
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [selectedJobId, autoPlaceJob, showToast, autoSaveBeforeAutoplace]);

  // Handle ALAP auto-placement for selected job (ALT+P L)
  const handleAlapPlacement = useCallback(async () => {
    if (!selectedJobId) return;
    await autoSaveBeforeAutoplace();
    try {
      const result = await autoPlaceJobAlap(selectedJobId).unwrap();
      if (result.placedCount === 0) {
        showToast('Aucune tuile non planifiée à placer', 'info');
      } else {
        const timing = result.computeMs != null ? ` en ${result.computeMs}ms` : '';
        showToast(`${result.placedCount} tuile(s) placée(s) ALAP${timing}`, 'success');
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [selectedJobId, autoPlaceJobAlap, showToast, autoSaveBeforeAutoplace]);

  // Track Alt key and keyboard shortcuts
  useEffect(() => {
    const ctx: KeyboardContext = {
      selectedJobId,
      isJcfOpen: isJcfModalOpen,
      orderedJobIds,
      selectedJob,
      gridRef,
      pixelsPerHour,
      gridStartDate,
      collapses: effectiveCollapses,
      setSelectedJobId,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect AZERTY vs QWERTY from unmodified keypresses
      detectKeyboardLayout(e);

      // Command palette is open — let it handle its own keys
      if (isCommandPaletteOpen) return;

      // Alt+E: edit selected job
      if (isAltLetter(e, 'e') && selectedJobId) {
        e.preventDefault();
        handleEditJob();
        return;
      }

      // Ctrl+Alt+C: smart compaction
      if (isCtrlAltLetter(e, 'c')) {
        e.preventDefault();
        handleSmartCompact();
        return;
      }

      // Ctrl+Alt+P: incremental compute (all unplaced jobs) — delivered
      // through the ComputeReportToast. Phase-1 (FBI) only; LNS runs in
      // the background via the shared auto-recompute runtime. Matches
      // the OperatorSchedulePage handler. See playground-compute-info-toast.html.
      if (isCtrlAltLetter(e, 'p')) {
        e.preventDefault();
        autoRecompute.startComputeReport({
          mode: 'incremental',
          snapshot,
          skipLns: true,
          onDone: (result) => {
            invalidateSnapshot();
            runBackgroundLns(result, 'ctrl+alt+p incremental');
          },
        });
        return;
      }

      // Ctrl+Alt+E: schedule evaluation
      if (isCtrlAltLetter(e, 'e')) {
        e.preventDefault();
        setIsEvaluationOpen(true);
        return;
      }

      // Ctrl+Alt+Z: mass unschedule all clearable tiles
      if (isCtrlAltLetter(e, 'z')) {
        e.preventDefault();
        massUnschedule.trigger();
        return;
      }

      // Alt+F: toggle pin on all placed tiles for selected job (Figer)
      if (isAltLetter(e, 'f') && selectedJobId) {
        e.preventDefault();
        handlePinAllJobTiles();
        return;
      }

      // Alt+Z: clear all tiles for selected job
      if (isAltLetter(e, 'z') && selectedJobId) {
        e.preventDefault();
        handleClearJobAssignments();
        return;
      }

      // Alt+B: toggle sidebar visibility
      if (isAltLetter(e, 'b')) {
        e.preventDefault();
        setIsSidebarVisible(prev => !prev);
        return;
      }

      // Alt+M: toggle minimap visibility
      if (isAltLetter(e, 'm')) {
        e.preventDefault();
        setIsMinimapVisible(prev => !prev);
        return;
      }

      // Ctrl+Plus: zoom in
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const idx = ZOOM_LEVELS.findIndex(z => z.pixelsPerHour === pixelsPerHour);
        if (idx < ZOOM_LEVELS.length - 1) {
          handleZoomChange(ZOOM_LEVELS[idx + 1].pixelsPerHour);
        }
        return;
      }

      // Ctrl+Minus: zoom out
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        const idx = ZOOM_LEVELS.findIndex(z => z.pixelsPerHour === pixelsPerHour);
        if (idx > 0) {
          handleZoomChange(ZOOM_LEVELS[idx - 1].pixelsPerHour);
        }
        return;
      }

      // Each handler returns true if it handled the event
      if (handleDisplayModeToggle(e, setDisplayMode)) return;
      if (handleEscapeCloseJob(e, ctx)) return;
      if (handleJobNavigation(e, ctx)) return;
      if (handleJumpToDeparture(e, ctx)) return;
      if (handleJumpToToday(e, ctx)) return;
      handlePageScroll(e, ctx);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedJobId, isJcfModalOpen, orderedJobIds, selectedJob, pixelsPerHour, gridStartDate, effectiveCollapses, setSelectedJobId, setDisplayMode, isCommandPaletteOpen, handleEditJob, handleZoomChange, handleClearJobAssignments, massUnschedule.trigger, autoRecompute, snapshot, invalidateSnapshot]);

  // Handle grid background click (deselect job)
  const handleDeselect = useCallback(() => setSelectedJobId(null), [setSelectedJobId]);

  // v0.3.58: Handle context menu open
  const handleContextMenuOpen = useCallback((x: number, y: number, assignmentId: string, isCompleted: boolean, isPinned = false) => {
    setContextMenu({ x, y, assignmentId, isCompleted, isPinned });
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
    const y = timeToYPosition(startTime, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);

    // Position the tile ~20vh from top of viewport
    const viewportHeight = gridRef.current.getViewportHeight();
    const scrollTargetY = Math.max(0, y - viewportHeight * 0.2);

    // Calculate X position from station index (accounts for variable column widths)
    const stationId = assignment.targetId;
    const stationIndex = activeStations.findIndex((s) => s.id === stationId);

    let scrollTargetX = gridRef.current.getScrollX(); // Default: keep current X

    if (stationIndex >= 0) {
      const { x: stationX } = getStationXOffset(stationIndex, activeStations, categoryMap);
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
  }, [activeStations, categoryMap, pixelsPerHour, gridStartDate, effectiveCollapses]);

  // JobCard click: select + center grid on the earliest non-completed tile of the job
  // (mirrors OperatorSchedulePage.handleSelectJob for behavioral parity between views).
  const handleSelectJob = useCallback((jobId: string | null) => {
    if (jobId === null) {
      setSelectedJobId(null);
      return;
    }
    setSelectedJobId(jobId);

    const jobTaskIds = new Set<string>();
    for (const t of snapshot.tasks) {
      const el = snapshot.elements.find((e) => e.id === t.elementId);
      if (el?.jobId === jobId) jobTaskIds.add(t.id);
    }
    if (jobTaskIds.size === 0) return;

    let firstAssignment: TaskAssignment | null = null;
    for (const a of snapshot.assignments) {
      if (!jobTaskIds.has(a.taskId) || a.isCompleted) continue;
      if (!firstAssignment || new Date(a.scheduledStart) < new Date(firstAssignment.scheduledStart)) {
        firstAssignment = a;
      }
    }
    if (!firstAssignment) return;

    handleJumpToTask(firstAssignment);
  }, [snapshot.tasks, snapshot.elements, snapshot.assignments, setSelectedJobId, handleJumpToTask]);

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
  const handleOutsourcingDepartureChange = useCallback(async (taskId: string, departure: Date | undefined) => {
    const task = snapshot.tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'Outsourced') return;

    updateSnapshot((currentSnapshot) => {
      const taskIndex = currentSnapshot.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return currentSnapshot;

      const t = currentSnapshot.tasks[taskIndex];
      if (t.type !== 'Outsourced') return currentSnapshot;

      const newTasks = [...currentSnapshot.tasks];
      newTasks[taskIndex] = {
        ...t,
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

    // Persist to backend (only departure — don't overwrite return)
    try {
      await updateOutsourcingDates({
        taskId,
        manualDeparture: departure?.toISOString() ?? null,
      }).unwrap();
    } catch { /* ignore */ }

    // Auto-pin/unpin coupling — clearing departure always unpins (dates are cleared together)
    const assignment = snapshot.assignments.find((a) => a.taskId === taskId);
    if (assignment) {
      if (departure && !assignment.isPinned) {
        try { await togglePin(taskId).unwrap(); } catch { /* ignore */ }
      } else if (!departure && assignment.isPinned) {
        try { await togglePin(taskId).unwrap(); } catch { /* ignore */ }
      }
    }
  }, [snapshot.tasks, snapshot.assignments, togglePin, invalidateSnapshot, updateOutsourcingDates]);

  // v0.5.11: Handle outsourcing return change (local state only)
  const handleOutsourcingReturnChange = useCallback(async (taskId: string, returnDate: Date | undefined) => {
    const task = snapshot.tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'Outsourced') return;

    updateSnapshot((currentSnapshot) => {
      const taskIndex = currentSnapshot.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return currentSnapshot;

      const t = currentSnapshot.tasks[taskIndex];
      if (t.type !== 'Outsourced') return currentSnapshot;

      const newTasks = [...currentSnapshot.tasks];
      newTasks[taskIndex] = {
        ...t,
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

    // Persist to backend (only return — don't overwrite departure)
    try {
      await updateOutsourcingDates({
        taskId,
        manualReturn: returnDate?.toISOString() ?? null,
      }).unwrap();
    } catch { /* ignore */ }

    // Auto-pin/unpin coupling — clearing return always unpins (dates are cleared together)
    const assignment = snapshot.assignments.find((a) => a.taskId === taskId);
    if (assignment) {
      if (returnDate && !assignment.isPinned) {
        try { await togglePin(taskId).unwrap(); } catch { /* ignore */ }
      } else if (!returnDate && assignment.isPinned) {
        try { await togglePin(taskId).unwrap(); } catch { /* ignore */ }
      }
    }
  }, [snapshot.tasks, snapshot.assignments, togglePin, invalidateSnapshot, updateOutsourcingDates]);

  // REQ-14: Handle date click - scroll grid to the clicked date
  const handleDateClick = useCallback((date: Date) => {
    if (!gridRef.current) return;

    // Calculate Y position for the start of the clicked day (at START_HOUR).
    // Must feed `effectiveCollapses` to `timeToYPosition` so the target Y
    // matches the grid's collapse-aware layout — otherwise the click lands on
    // a Y computed as if the grid were purely linear, sending the viewport
    // far away from the requested date. `OperatorSchedulePage.handleDateClick`
    // already does this; parity with its call shape is what this branch owes.
    const targetDate = new Date(date);
    targetDate.setHours(START_HOUR, 0, 0, 0);
    const y = timeToYPosition(targetDate, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);

    // Scroll to position with a small offset from top
    const scrollTarget = Math.max(0, y);
    gridRef.current.scrollToY(scrollTarget);

    console.log('DateStrip click-to-scroll:', {
      date: date.toISOString().split('T')[0],
      scrollTarget,
    });
  }, [pixelsPerHour, gridStartDate, effectiveCollapses]);

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

  // Handle outsourced task ST status cycle — same data as Flux ST column (pending → progress → done)
  const handleToggleOutsourcedDone = useCallback(async (taskId: string) => {
    const task = snapshot.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = nextSTStatus(taskStatusToFluxST(task.status));
    try {
      await updateSTStatus({ taskId, status: newStatus }).unwrap();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [snapshot.tasks, updateSTStatus, showToast]);

  // v0.3.58: Handle context menu "Toggle completion" action
  const handleContextMenuToggleComplete = useCallback(() => {
    if (!contextMenu) return;
    handleToggleComplete(contextMenu.assignmentId);
  }, [contextMenu, handleToggleComplete]);

  // Handle toggle pin (mirrors handleToggleComplete)
  const sequenceIndexByTaskId = useMemo(
    () => buildSequenceIndexLookup(snapshot),
    [snapshot.jobs, snapshot.elements, snapshot.tasks],
  );

  const handleToggleFrozenOverride = useCallback(
    async (jobId: string, sequenceIndex: number, stationId: string) => {
      const existing = (snapshot.safetyOverrides ?? []).find(
        (o) =>
          o.jobId === jobId && o.sequenceIndex === sequenceIndex && o.stationId === stationId,
      );
      const next = existing ? !existing.isOverridden : true;
      try {
        await setSafetyOverride({
          jobId,
          body: { sequenceIndex, stationId, isOverridden: next },
        }).unwrap();
      } catch (e) {
        console.error('Failed to toggle safety override', e);
      }
    },
    [snapshot.safetyOverrides, setSafetyOverride],
  );

  const handleTogglePin = useCallback(async (assignmentId: string) => {
    const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
    if (!assignment) {
      console.warn('Assignment not found for pin toggle:', assignmentId);
      return;
    }

    try {
      await togglePin(assignment.taskId).unwrap();

      // If unpinning an outsourced task → clear manual dates, persist, and unassign
      if (assignment.isPinned) {
        const task = snapshot.tasks.find((t) => t.id === assignment.taskId);
        if (task?.type === 'Outsourced') {
          if (task.manualDeparture || task.manualReturn) {
            updateSnapshot((s) => {
              const idx = s.tasks.findIndex((t) => t.id === assignment.taskId);
              if (idx === -1) return s;
              const t = s.tasks[idx];
              if (t.type !== 'Outsourced') return s;
              const newTasks = [...s.tasks];
              newTasks[idx] = { ...t, manualDeparture: undefined, manualReturn: undefined, updatedAt: new Date().toISOString() };
              return { ...s, tasks: newTasks };
            });
            invalidateSnapshot();
            try {
              await updateOutsourcingDates({
                taskId: assignment.taskId,
                manualDeparture: null,
                manualReturn: null,
              }).unwrap();
            } catch { /* ignore */ }
          }
          // Unassign outsourced task so tile goes back to unplaced
          try {
            await unassignTask(assignment.taskId).unwrap();
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [snapshot.assignments, snapshot.tasks, togglePin, unassignTask, updateOutsourcingDates, showToast, invalidateSnapshot]);

  // Handle context menu "Toggle pin" action
  const handleContextMenuTogglePin = useCallback(() => {
    if (!contextMenu) return;
    handleTogglePin(contextMenu.assignmentId);
  }, [contextMenu, handleTogglePin]);

  // Derive whether the context menu task is a split task
  const contextMenuTask = useMemo(() => {
    if (!contextMenu) return null;
    // For grid context menu, assignmentId is the assignment ID
    const assignment = snapshot.assignments.find((a) => a.id === contextMenu.assignmentId);
    if (assignment) {
      return snapshot.tasks.find((t) => t.id === assignment.taskId) as InternalTask | undefined ?? null;
    }
    return null;
  }, [contextMenu, snapshot.assignments, snapshot.tasks]);

  const isContextMenuTaskSplit = contextMenuTask?.type === 'Internal' && !!contextMenuTask.splitGroupId;

  // Handle context menu "Split" action — open the split popover
  const handleContextMenuSplit = useCallback(() => {
    if (!contextMenu) return;
    // Find the task from the context menu's assignment
    const assignment = snapshot.assignments.find((a) => a.id === contextMenu.assignmentId);
    if (!assignment) return;
    const task = snapshot.tasks.find((t) => t.id === assignment.taskId);
    if (!task || task.type !== 'Internal') return;
    const internalTask = task as InternalTask;
    const station = snapshot.stations.find((s) => s.id === internalTask.stationId);
    setSplitPopover({
      x: contextMenu.x,
      y: contextMenu.y,
      taskId: internalTask.id,
      task: internalTask,
      stationName: station?.name ?? 'Unknown',
    });
  }, [contextMenu, snapshot.assignments, snapshot.tasks, snapshot.stations]);

  // Handle context menu "Fuse" action
  const handleContextMenuFuse = useCallback(async () => {
    if (!contextMenu) return;
    const assignment = snapshot.assignments.find((a) => a.id === contextMenu.assignmentId);
    if (!assignment) return;
    try {
      await fuseTask(assignment.taskId).unwrap();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [contextMenu, snapshot.assignments, fuseTask, showToast]);

  // Handle split confirm from popover
  const handleSplitConfirm = useCallback(async (ratio: number) => {
    if (!splitPopover) return;
    try {
      await splitTask({ taskId: splitPopover.taskId, body: { ratio } }).unwrap();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
    setSplitPopover(null);
  }, [splitPopover, splitTask, showToast]);

  // Handle split from JobDetailsPanel (both assigned and unassigned tasks)
  const handlePanelSplitTask = useCallback((taskId: string, x: number, y: number) => {
    const task = snapshot.tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'Internal') return;
    const internalTask = task as InternalTask;
    const station = snapshot.stations.find((s) => s.id === internalTask.stationId);
    setSplitPopover({
      x,
      y,
      taskId: internalTask.id,
      task: internalTask,
      stationName: station?.name ?? 'Unknown',
    });
  }, [snapshot.tasks, snapshot.stations]);

  // Handle fuse from JobDetailsPanel
  const handlePanelFuseTask = useCallback(async (taskId: string) => {
    try {
      await fuseTask(taskId).unwrap();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }, [fuseTask, showToast]);

  // Smart compaction handler
  const handleSmartCompact = useCallback(() => {
    setIsSmartCompactOpen(true);
  }, []);

  const handleSmartCompactComplete = useCallback(() => {
    dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
  }, [dispatch]);

  // Compute footer mode from app state
  const footerMode = useMemo(() => {
    if (isJcfModalOpen) return 'jcfModal' as const;
    if (selectedJobId) return 'jobSelected' as const;
    return 'default' as const;
  }, [isJcfModalOpen, selectedJobId]);

  // Scheduler-specific commands — registered into the global Command Center
  const schedulerCommands = useCommands({
    selectedJobId,
    onJumpToToday: useCallback(() => {
      if (gridRef.current) {
        // Route through `timeToYPosition` so the scroll is collapse-aware.
        // Previous impl used a raw `diffHours * pixelsPerHour` formula that
        // ignored collapses entirely — silently misaligned with the grid.
        const y = timeToYPosition(new Date(), START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
        gridRef.current.scrollToY(y - 200, 'smooth');
      }
    }, [gridStartDate, pixelsPerHour, effectiveCollapses]),
    onJumpToDeparture: useCallback(() => {
      if (gridRef.current && selectedJob?.workshopExitDate) {
        const deadline = getDeadlineDate(selectedJob.workshopExitDate);
        const y = timeToYPosition(deadline, START_HOUR, pixelsPerHour, gridStartDate, effectiveCollapses);
        gridRef.current.scrollToY(y - 200, 'smooth');
      }
    }, [selectedJob, pixelsPerHour, gridStartDate, effectiveCollapses]),
    onPrevJob: useCallback(() => {
      if (!selectedJobId || orderedJobIds.length === 0) return;
      const idx = orderedJobIds.indexOf(selectedJobId);
      if (idx > 0) setSelectedJobId(orderedJobIds[idx - 1]);
    }, [selectedJobId, orderedJobIds, setSelectedJobId]),
    onNextJob: useCallback(() => {
      if (!selectedJobId || orderedJobIds.length === 0) return;
      const idx = orderedJobIds.indexOf(selectedJobId);
      if (idx < orderedJobIds.length - 1) setSelectedJobId(orderedJobIds[idx + 1]);
    }, [selectedJobId, orderedJobIds, setSelectedJobId]),
    onNavigateScheduler: useCallback(() => navigate('/'), [navigate]),
    onNavigateFlux: useCallback(() => navigate('/flux'), [navigate]),
    onEditJob: handleEditJob,
    onNewJob: useCallback(() => {
      navigate('/stations/job/new');
    }, [navigate]),
    onSearchJobs: useCallback(() => {
      navigate('/flux');
    }, [navigate]),
    onToggleDisplayMode: useCallback(() => {
      setDisplayMode(prev => prev === 'produit' ? 'tirage' : 'produit');
    }, [setDisplayMode]),
    onToggleSidebar: useCallback(() => {
      setIsSidebarVisible(prev => !prev);
    }, []),
    onToggleMinimap: useCallback(() => {
      setIsMinimapVisible(prev => !prev);
    }, []),
    onSmartCompact: handleSmartCompact,
    onEvaluateSchedule: useCallback(() => setIsEvaluationOpen(true), []),
    onZoomIn: useCallback(() => {
      const idx = ZOOM_LEVELS.findIndex(z => z.pixelsPerHour === pixelsPerHour);
      if (idx < ZOOM_LEVELS.length - 1) {
        handleZoomChange(ZOOM_LEVELS[idx + 1].pixelsPerHour);
      }
    }, [pixelsPerHour, handleZoomChange]),
    onZoomOut: useCallback(() => {
      const idx = ZOOM_LEVELS.findIndex(z => z.pixelsPerHour === pixelsPerHour);
      if (idx > 0) {
        handleZoomChange(ZOOM_LEVELS[idx - 1].pixelsPerHour);
      }
    }, [pixelsPerHour, handleZoomChange]),
    onOpenSaveLoad: useCallback(() => {
      setIsSaveLoadOpen(true);
    }, []),
    onClearJobAssignments: handleClearJobAssignments,
    onPinAllJobTiles: selectedJobId ? handlePinAllJobTiles : undefined,
    onClearAllAssignments: massUnschedule.trigger,
    onAsapPlacement: handleAsapPlacement,
    onAlapPlacement: handleAlapPlacement,
    onAutoPlaceAll: handleComputeIncremental,
  });

  // Register scheduler-specific commands into the global Command Center
  useEffect(() => {
    registerPageCommands(schedulerCommands);
    return () => unregisterPageCommands();
  }, [schedulerCommands, registerPageCommands, unregisterPageCommands]);

  // Register jobs for Command Palette search
  useEffect(() => {
    registerJobs(
      snapshot.jobs.map(j => ({ id: j.id, reference: j.reference, client: j.client, description: j.description })),
      (jobId) => setSelectedJobId(jobId),
    );
    return () => unregisterJobs();
  }, [snapshot.jobs, setSelectedJobId, registerJobs, unregisterJobs]);

  // v0.5.1: Show loading spinner during initial fetch (real API mode only)
  // In mock mode, data is always instantly available, so we skip the loading state
  // This check is placed after all hooks to comply with Rules of Hooks
  const isMockMode = shouldUseMockMode();
  if (isLoading && !isMockMode && !isJcfFromFlux) {
    return <LoadingSpinner message="Chargement des données..." />;
  }

  // v0.5.7: Show maintenance page for 503 Service Unavailable
  if (isServiceUnavailable && !isJcfFromFlux) {
    return <MaintenanceState onRetry={refetch} />;
  }

  // v0.5.1: Show error state with retry button if fetch failed
  if (isError && !isJcfFromFlux) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <>
      {isJcfFromFlux ? (
        <div inert="" className="flex-1 flex flex-col overflow-hidden">
          <FluxPage backdrop />
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {isSidebarVisible && (
          <div>
            <JobsList
              jobs={snapshot.jobs}
              tasks={snapshot.tasks}
              elements={snapshot.elements}
              assignments={snapshot.assignments}
              lateJobs={snapshot.lateJobs}
              conflicts={snapshot.conflicts}
              selectedJobId={selectedJobId}
              onSelectJob={handleSelectJob}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content area */}
          <div className="flex-1 flex overflow-hidden">
        <JobDetailsPanel
          job={selectedJob}
          tasks={snapshot.tasks}
          elements={snapshot.elements}
          assignments={snapshot.assignments}
          stations={snapshot.stations}
          categories={snapshot.categories}
          providers={snapshot.providers}
          activeTaskId={undefined}
          conflictTaskIds={conflictTaskIds}
          onJumpToTask={handleJumpToTask}
          onRecallTask={handleRecallAssignment}
          onClose={() => setSelectedJobId(null)}
          onDateClick={handleDateClick}
          onToggleComplete={handleToggleComplete}
          onToggleOutsourcedDone={handleToggleOutsourcedDone}
          onTogglePin={handleTogglePin}
          onDepartureChange={handleOutsourcingDepartureChange}
          onReturnChange={handleOutsourcingReturnChange}
          onEditJob={handleEditJob}
          lateJobIds={lateJobIds}
          shippedJobIds={shippedJobIds}
          onSplitTask={handlePanelSplitTask}
          onFuseTask={handlePanelFuseTask}
          allJobs={snapshot.jobs}
          onSelectJob={setSelectedJobId}
          snapshotOperators={snapshot.operators}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
        <StalenessBadge
          hasFailed={autoRecompute.hasFailed}
          isRetrying={autoRecompute.isComputing}
          lastError={autoRecompute.lastError}
          onRetry={autoRecompute.retry}
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
          stations={activeStations}
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
          onDeselect={handleDeselect}
          onTogglePin={handleTogglePin}
          conflicts={snapshot.conflicts}
          pixelsPerHour={pixelsPerHour}
          groups={snapshot.groups}
          onContextMenu={handleContextMenuOpen}
          displayMode={displayMode}
          lateJobIds={lateJobIds}
          shippedJobIds={shippedJobIds}
          operators={snapshot.operators}
          collapses={effectiveCollapses}
          safetyZoneHours={snapshot.safetyZoneHours ?? 0}
          safetyOverrides={snapshot.safetyOverrides}
          sequenceIndexByTaskId={sequenceIndexByTaskId}
          onToggleFrozenOverride={handleToggleFrozenOverride}
        />
        {isMinimapVisible && (
          <Minimap
            stations={activeStations}
            categories={snapshot.categories}
            assignments={snapshot.assignments}
            elements={snapshot.elements}
            jobs={snapshot.jobs}
            tasks={snapshot.tasks}
            totalDays={DAY_COUNT}
            pixelsPerHour={pixelsPerHour}
            startDate={gridStartDate}
            startHour={START_HOUR}
            selectedJobId={deferredSelectedJobId}
            lateJobIds={lateJobIds}
            shippedJobIds={shippedJobIds}
            conflicts={snapshot.conflicts}
            gridRef={gridRef}
            scrollTop={gridScrollTop}
            scrollLeft={gridScrollLeft}
            theme={theme}
          />
        )}
          </div>
          </div>
          </div>
        </div>
      </div>
      )}

      {/* Instant selection ring via CSS selector (bypasses grid re-render) */}
      {selectedJobId && (
        <style>{`[data-job-id="${selectedJobId}"]::after { content: ''; position: absolute; inset: 0; border: 2px solid ${theme === 'light' ? 'rgba(147,51,234,0.75)' : 'rgba(255,255,255,0.7)'}; z-index: 5; pointer-events: none; }`}</style>
      )}

      <ShortcutFooter mode={footerMode} />

      {/* v0.3.58: Context menu for tiles */}
      {contextMenu && (
        <TileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isCompleted={contextMenu.isCompleted}
          isPinned={contextMenu.isPinned}
          onTogglePin={handleContextMenuTogglePin}
          onViewDetails={handleContextMenuViewDetails}
          onToggleComplete={handleContextMenuToggleComplete}
          onRecall={() => handleRecallAssignment(contextMenu.assignmentId)}
          onSplit={handleContextMenuSplit}
          onFuse={handleContextMenuFuse}
          isSplit={isContextMenuTaskSplit}
          onClose={handleContextMenuClose}
        />
      )}

      {/* Split task popover */}
      {splitPopover && (
        <SplitTaskPopover
          x={splitPopover.x}
          y={splitPopover.y}
          task={splitPopover.task}
          stationName={splitPopover.stationName}
          onConfirm={handleSplitConfirm}
          onCancel={() => setSplitPopover(null)}
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
        onSaveAsTemplate={handleSaveAsTemplate}
        canSaveAsTemplate={jcfElements.length > 0 && jcfElements.some(el => el.name.trim() !== '')}
      >
        <JcfJobHeader
          jobId={jcfJobId}
          onJobIdChange={isEditMode ? undefined : setJcfJobId}
          client={jcfClient}
          onClientChange={setJcfClient}
          referent={jcfReferent}
          onReferentChange={setJcfReferent}
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
          batDeadline={jcfBatDeadline}
          onBatDeadlineChange={setJcfBatDeadline}
          deadlinePriority={jcfDeadlinePriority}
          onDeadlinePriorityChange={setJcfDeadlinePriority}
          requiredJobs={jcfRequiredJobs}
          onRequiredJobsChange={setJcfRequiredJobs}
          jobSuggestions={snapshot?.jobs.map((j) => ({ reference: j.reference, client: j.client })) ?? []}
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
          sequence: sequenceWorkflows[i]?.length > 0
            ? sequenceWorkflows[i].join('\n')
            : sequenceDslToCategories(el.sequence, snapshotPostes),
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

      {/* Compute Schedule FAB */}
      <button
        onClick={handleComputeSchedule}
        disabled={computeModalMode !== null}
        className="fixed bottom-[184px] right-6 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white shadow-lg transition-all flex items-center justify-center"
        aria-label="Calculer le planning"
        title="Calculer le planning (recalcul complet)"
        data-testid="compute-schedule-fab"
      >
        <Cpu size={20} />
      </button>

      {/* Debug Export FAB — copy snapshot to clipboard */}
      <button
        onClick={handleDebugExport}
        className="fixed bottom-[136px] right-6 z-40 w-10 h-10 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 shadow-lg transition-all flex items-center justify-center opacity-50 hover:opacity-100"
        aria-label="Copy debug snapshot to clipboard"
        title="Copy debug snapshot to clipboard"
      >
        <ClipboardCopy size={16} />
      </button>

      {/* Save/Load FAB — stacked above Command Center FAB */}
      <button
        onClick={() => setIsSaveLoadOpen(true)}
        className="fixed bottom-[88px] right-6 z-40 w-12 h-12 rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 shadow-lg transition-all flex items-center justify-center"
        aria-label="Sauvegardes"
        data-testid="save-load-fab"
      >
        <Save size={20} />
      </button>

      {/* Mass unschedule confirmation dialog */}
      {massUnschedule.confirmState && (
        <MassUnscheduleDialog
          state={massUnschedule.confirmState}
          getClearableCount={massUnschedule.getClearableCount}
          onConfirm={handleMassUnscheduleConfirm}
          onDismiss={massUnschedule.dismiss}
          onUpdate={massUnschedule.setConfirmState}
        />
      )}

      {/* Schedule Evaluation modal */}
      <ScheduleEvaluationModal
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
      />

      {/* Smart Compaction modal */}
      <SmartCompactModal
        isOpen={isSmartCompactOpen}
        onClose={() => setIsSmartCompactOpen(false)}
        onComplete={handleSmartCompactComplete}
      />

      {/* Compute modal (real-time SSE — same as operator schedule) */}
      <ComputeModal
        mode={computeModalMode}
        snapshot={snapshot}
        onDone={() => { dispatch(scheduleApi.util.invalidateTags(['Snapshot'])); }}
        onDismiss={() => setComputeModalMode(null)}
        onComputeIncremental={handleComputeIncremental}
        onComputeFull={handleComputeSchedule}
      />

      {/* Schedule save/load modal */}
      <ScheduleSaveLoadModal
        isOpen={isSaveLoadOpen}
        onClose={() => setIsSaveLoadOpen(false)}
      />

    </>
  );
}

// Main App component wrapping with ErrorBoundary
function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
