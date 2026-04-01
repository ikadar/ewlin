/**
 * JCF Form State Slice
 *
 * Manages Job Creation Form (JCF) state that was previously in App.tsx useState hooks:
 * - Modal state (isJcfModalOpen, isTemplateEditorOpen)
 * - Form fields (jobId, client, template, intitule, quantity, deadline)
 * - Elements table state
 * - Sequence workflow (from template)
 * - Save state (isSaving, error)
 *
 * @see docs/releases/v0.4.37-redux-rtk-query-setup.md
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { JcfElement } from '../../components/JcfElementsTable/types';
import { DEFAULT_ELEMENT } from '../../components/JcfElementsTable/types';

// ============================================================================
// Types
// ============================================================================

export interface JcfState {
  /** Whether JCF modal is open */
  isJcfModalOpen: boolean;
  /** Generated job ID */
  jcfJobId: string;
  /** Client name */
  jcfClient: string;
  /** Referent (contact person) name */
  jcfReferent: string;
  /** Template name */
  jcfTemplate: string;
  /** Job title/description */
  jcfIntitule: string;
  /** Quantity */
  jcfQuantity: string;
  /** Deadline (ISO date string or French format) */
  jcfDeadline: string;
  /** BAT deadline (ISO date string or French format) */
  jcfBatDeadline: string;
  /** Shipper (transporteur) ID */
  jcfShipperId: string;
  /** Elements array */
  jcfElements: JcfElement[];
  /** Sequence workflow from selected template */
  sequenceWorkflow: string[];
  /** Whether template editor modal is open */
  isTemplateEditorOpen: boolean;
  /** Whether template is being saved */
  isTemplateSaving: boolean;
  /** Whether job is being saved */
  isJcfSaving: boolean;
  /** Save error message (null if no error) */
  jcfSaveError: string | null;
  /** Required job references (comma-separated) */
  jcfRequiredJobs: string;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: JcfState = {
  isJcfModalOpen: false,
  jcfJobId: '',
  jcfClient: '',
  jcfReferent: '',
  jcfTemplate: '',
  jcfIntitule: '',
  jcfQuantity: '',
  jcfDeadline: '',
  jcfBatDeadline: '',
  jcfShipperId: '',
  jcfElements: [{ ...DEFAULT_ELEMENT }],
  sequenceWorkflow: [],
  isTemplateEditorOpen: false,
  isTemplateSaving: false,
  isJcfSaving: false,
  jcfSaveError: null,
  jcfRequiredJobs: '',
};

// ============================================================================
// Slice Definition
// ============================================================================

const jcfSlice = createSlice({
  name: 'jcf',
  initialState,
  reducers: {
    openJcfModal: (state, action: PayloadAction<string>) => {
      state.isJcfModalOpen = true;
      state.jcfJobId = action.payload;
    },

    closeJcfModal: (state) => {
      state.isJcfModalOpen = false;
      // Reset form on close
      state.jcfClient = '';
      state.jcfReferent = '';
      state.jcfTemplate = '';
      state.jcfIntitule = '';
      state.jcfQuantity = '';
      state.jcfDeadline = '';
      state.jcfBatDeadline = '';
      state.jcfShipperId = '';
      state.jcfRequiredJobs = '';
      state.jcfElements = [{ ...DEFAULT_ELEMENT }];
      state.sequenceWorkflow = [];
      state.jcfSaveError = null;
    },

    setJcfJobId: (state, action: PayloadAction<string>) => {
      state.jcfJobId = action.payload;
    },

    setJcfClient: (state, action: PayloadAction<string>) => {
      state.jcfClient = action.payload;
    },

    setJcfReferent: (state, action: PayloadAction<string>) => {
      state.jcfReferent = action.payload;
    },

    setJcfTemplate: (state, action: PayloadAction<string>) => {
      state.jcfTemplate = action.payload;
    },

    setJcfIntitule: (state, action: PayloadAction<string>) => {
      state.jcfIntitule = action.payload;
    },

    setJcfQuantity: (state, action: PayloadAction<string>) => {
      state.jcfQuantity = action.payload;
    },

    setJcfDeadline: (state, action: PayloadAction<string>) => {
      state.jcfDeadline = action.payload;
    },

    setJcfBatDeadline: (state, action: PayloadAction<string>) => {
      state.jcfBatDeadline = action.payload;
    },

    setJcfShipperId: (state, action: PayloadAction<string>) => {
      state.jcfShipperId = action.payload;
    },

    setJcfElements: (state, action: PayloadAction<JcfElement[]>) => {
      state.jcfElements = action.payload;
    },

    setSequenceWorkflow: (state, action: PayloadAction<string[]>) => {
      state.sequenceWorkflow = action.payload;
    },

    setIsTemplateEditorOpen: (state, action: PayloadAction<boolean>) => {
      state.isTemplateEditorOpen = action.payload;
    },

    setIsTemplateSaving: (state, action: PayloadAction<boolean>) => {
      state.isTemplateSaving = action.payload;
    },

    setIsJcfSaving: (state, action: PayloadAction<boolean>) => {
      state.isJcfSaving = action.payload;
    },

    setJcfSaveError: (state, action: PayloadAction<string | null>) => {
      state.jcfSaveError = action.payload;
    },

    setJcfRequiredJobs: (state, action: PayloadAction<string>) => {
      state.jcfRequiredJobs = action.payload;
    },

    resetJcfForm: (state) => {
      state.jcfClient = '';
      state.jcfReferent = '';
      state.jcfTemplate = '';
      state.jcfIntitule = '';
      state.jcfQuantity = '';
      state.jcfDeadline = '';
      state.jcfBatDeadline = '';
      state.jcfShipperId = '';
      state.jcfElements = [{ ...DEFAULT_ELEMENT }];
      state.sequenceWorkflow = [];
      state.jcfSaveError = null;
      state.isJcfSaving = false;
      state.jcfRequiredJobs = '';
    },
  },
});

// ============================================================================
// Exports
// ============================================================================

export const {
  openJcfModal,
  closeJcfModal,
  setJcfJobId,
  setJcfClient,
  setJcfReferent,
  setJcfTemplate,
  setJcfIntitule,
  setJcfQuantity,
  setJcfDeadline,
  setJcfBatDeadline,
  setJcfShipperId,
  setJcfElements,
  setSequenceWorkflow,
  setIsTemplateEditorOpen,
  setIsTemplateSaving,
  setIsJcfSaving,
  setJcfSaveError,
  setJcfRequiredJobs,
  resetJcfForm,
} = jcfSlice.actions;

export const jcfReducer = jcfSlice.reducer;
