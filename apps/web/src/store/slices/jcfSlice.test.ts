/**
 * JCF Slice Unit Tests
 *
 * @see docs/releases/v0.4.37-redux-rtk-query-setup.md
 */

import { describe, it, expect } from 'vitest';
import {
  jcfReducer,
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
  type JcfState,
} from './jcfSlice';
import { DEFAULT_ELEMENT } from '../../components/JcfElementsTable/types';

describe('jcfSlice', () => {
  const initialState: JcfState = {
    isJcfModalOpen: false,
    jcfJobId: '',
    jcfClient: '',
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

  describe('modal actions', () => {
    it('openJcfModal opens modal and sets job ID', () => {
      const state = jcfReducer(initialState, openJcfModal('JOB-2024-001'));
      expect(state.isJcfModalOpen).toBe(true);
      expect(state.jcfJobId).toBe('JOB-2024-001');
    });

    it('closeJcfModal closes modal and resets form', () => {
      const filledState: JcfState = {
        ...initialState,
        isJcfModalOpen: true,
        jcfJobId: 'JOB-2024-001',
        jcfClient: 'Test Client',
        jcfTemplate: 'Test Template',
        jcfIntitule: 'Test Job',
        jcfQuantity: '1000',
        jcfDeadline: '2024-02-15',
        jcfElements: [{ ...DEFAULT_ELEMENT, name: 'COUV' }],
        sequenceWorkflow: ['Print', 'Cut'],
        jcfSaveError: 'Previous error',
      };

      const state = jcfReducer(filledState, closeJcfModal());

      expect(state.isJcfModalOpen).toBe(false);
      expect(state.jcfClient).toBe('');
      expect(state.jcfTemplate).toBe('');
      expect(state.jcfIntitule).toBe('');
      expect(state.jcfQuantity).toBe('');
      expect(state.jcfDeadline).toBe('');
      expect(state.jcfElements).toEqual([{ ...DEFAULT_ELEMENT }]);
      expect(state.sequenceWorkflow).toEqual([]);
      expect(state.jcfSaveError).toBeNull();
      // Job ID is NOT reset on close (user might reopen)
    });
  });

  describe('form field actions', () => {
    it('setJcfJobId sets job ID', () => {
      const state = jcfReducer(initialState, setJcfJobId('JOB-2024-002'));
      expect(state.jcfJobId).toBe('JOB-2024-002');
    });

    it('setJcfClient sets client name', () => {
      const state = jcfReducer(initialState, setJcfClient('Acme Corp'));
      expect(state.jcfClient).toBe('Acme Corp');
    });

    it('setJcfTemplate sets template name', () => {
      const state = jcfReducer(initialState, setJcfTemplate('Brochure A4'));
      expect(state.jcfTemplate).toBe('Brochure A4');
    });

    it('setJcfIntitule sets job title', () => {
      const state = jcfReducer(initialState, setJcfIntitule('Flyer A5 5000pcs'));
      expect(state.jcfIntitule).toBe('Flyer A5 5000pcs');
    });

    it('setJcfQuantity sets quantity', () => {
      const state = jcfReducer(initialState, setJcfQuantity('5000'));
      expect(state.jcfQuantity).toBe('5000');
    });

    it('setJcfDeadline sets deadline', () => {
      const state = jcfReducer(initialState, setJcfDeadline('2024-02-15'));
      expect(state.jcfDeadline).toBe('2024-02-15');
    });
  });

  describe('elements actions', () => {
    it('setJcfElements sets elements array', () => {
      const elements = [
        { ...DEFAULT_ELEMENT, name: 'INT' },
        { ...DEFAULT_ELEMENT, name: 'COUV' },
      ];
      const state = jcfReducer(initialState, setJcfElements(elements));
      expect(state.jcfElements).toHaveLength(2);
      expect(state.jcfElements[0].name).toBe('INT');
      expect(state.jcfElements[1].name).toBe('COUV');
    });

    it('setSequenceWorkflow sets workflow array', () => {
      const workflow = ['Print', 'Cut', 'Fold', 'Package'];
      const state = jcfReducer(initialState, setSequenceWorkflow(workflow));
      expect(state.sequenceWorkflow).toEqual(workflow);
    });
  });

  describe('template editor actions', () => {
    it('setIsTemplateEditorOpen opens editor', () => {
      const state = jcfReducer(initialState, setIsTemplateEditorOpen(true));
      expect(state.isTemplateEditorOpen).toBe(true);
    });

    it('setIsTemplateEditorOpen closes editor', () => {
      const stateWithEditor = { ...initialState, isTemplateEditorOpen: true };
      const state = jcfReducer(stateWithEditor, setIsTemplateEditorOpen(false));
      expect(state.isTemplateEditorOpen).toBe(false);
    });

    it('setIsTemplateSaving sets saving state', () => {
      const state = jcfReducer(initialState, setIsTemplateSaving(true));
      expect(state.isTemplateSaving).toBe(true);
    });
  });

  describe('save actions', () => {
    it('setIsJcfSaving sets saving state', () => {
      const state = jcfReducer(initialState, setIsJcfSaving(true));
      expect(state.isJcfSaving).toBe(true);
    });

    it('setJcfSaveError sets error message', () => {
      const state = jcfReducer(initialState, setJcfSaveError('Validation failed'));
      expect(state.jcfSaveError).toBe('Validation failed');
    });

    it('setJcfSaveError clears error', () => {
      const stateWithError = { ...initialState, jcfSaveError: 'Previous error' };
      const state = jcfReducer(stateWithError, setJcfSaveError(null));
      expect(state.jcfSaveError).toBeNull();
    });
  });

  describe('resetJcfForm', () => {
    it('resets form fields but keeps modal state', () => {
      const filledState: JcfState = {
        isJcfModalOpen: true,
        jcfJobId: 'JOB-2024-001',
        jcfClient: 'Test Client',
        jcfTemplate: 'Test Template',
        jcfIntitule: 'Test Job',
        jcfQuantity: '1000',
        jcfDeadline: '2024-02-15',
        jcfBatDeadline: '2024-02-10T10:00',
        jcfShipperId: 'shipper-1',
        jcfElements: [{ ...DEFAULT_ELEMENT, name: 'COUV' }],
        sequenceWorkflow: ['Print', 'Cut'],
        isTemplateEditorOpen: false,
        isTemplateSaving: false,
        isJcfSaving: true,
        jcfSaveError: 'Error',
        jcfRequiredJobs: 'JOB-001',
      };

      const state = jcfReducer(filledState, resetJcfForm());

      // Modal state and job ID should be preserved
      expect(state.isJcfModalOpen).toBe(true);
      expect(state.jcfJobId).toBe('JOB-2024-001');

      // Form fields should be reset
      expect(state.jcfClient).toBe('');
      expect(state.jcfTemplate).toBe('');
      expect(state.jcfIntitule).toBe('');
      expect(state.jcfQuantity).toBe('');
      expect(state.jcfDeadline).toBe('');
      expect(state.jcfElements).toEqual([{ ...DEFAULT_ELEMENT }]);
      expect(state.sequenceWorkflow).toEqual([]);

      // Save state should be reset
      expect(state.isJcfSaving).toBe(false);
      expect(state.jcfSaveError).toBeNull();
    });
  });
});
