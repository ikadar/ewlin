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
  /** Template name */
  jcfTemplate: string;
  /** Job title/description */
  jcfIntitule: string;
  /** Quantity */
  jcfQuantity: string;
  /** Deadline (ISO date string or French format) */
  jcfDeadline: string;
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
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: JcfState = {
  isJcfModalOpen: false,
  jcfJobId: '',
  jcfClient: '',
  jcfTemplate: '',
  jcfIntitule: '',
  jcfQuantity: '',
  jcfDeadline: '',
  jcfElements: [{ ...DEFAULT_ELEMENT }],
  sequenceWorkflow: [],
  isTemplateEditorOpen: false,
  isTemplateSaving: false,
  isJcfSaving: false,
  jcfSaveError: null,
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
      state.jcfTemplate = '';
      state.jcfIntitule = '';
      state.jcfQuantity = '';
      state.jcfDeadline = '';
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

    resetJcfForm: (state) => {
      state.jcfClient = '';
      state.jcfTemplate = '';
      state.jcfIntitule = '';
      state.jcfQuantity = '';
      state.jcfDeadline = '';
      state.jcfElements = [{ ...DEFAULT_ELEMENT }];
      state.sequenceWorkflow = [];
      state.jcfSaveError = null;
      state.isJcfSaving = false;
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
  setJcfTemplate,
  setJcfIntitule,
  setJcfQuantity,
  setJcfDeadline,
  setJcfElements,
  setSequenceWorkflow,
  setIsTemplateEditorOpen,
  setIsTemplateSaving,
  setIsJcfSaving,
  setJcfSaveError,
  resetJcfForm,
} = jcfSlice.actions;

export const jcfReducer = jcfSlice.reducer;
