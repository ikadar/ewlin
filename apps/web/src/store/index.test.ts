/**
 * Store Configuration Unit Tests
 *
 * @see docs/releases/v0.4.37-redux-rtk-query-setup.md
 */

import { describe, it, expect } from 'vitest';
import { store } from './index';

describe('Redux Store', () => {
  describe('store configuration', () => {
    it('creates a valid store', () => {
      expect(store).toBeDefined();
      expect(store.getState).toBeDefined();
      expect(store.dispatch).toBeDefined();
    });

    it('has correct reducer structure', () => {
      const state = store.getState();

      // RTK Query reducer
      expect(state.scheduleApi).toBeDefined();

      // UI slice
      expect(state.ui).toBeDefined();
      expect(state.ui.selectedJobId).toBeNull();
      expect(state.ui.isAltPressed).toBe(false);

      // JCF slice
      expect(state.jcf).toBeDefined();
      expect(state.jcf.isJcfModalOpen).toBe(false);
      expect(state.jcf.jcfJobId).toBe('');
    });
  });

  describe('typed hooks', () => {
    it('exports useAppSelector', async () => {
      const { useAppSelector } = await import('./index');
      expect(useAppSelector).toBeDefined();
    });

    it('exports useAppDispatch', async () => {
      const { useAppDispatch } = await import('./index');
      expect(useAppDispatch).toBeDefined();
    });
  });

  describe('actions', () => {
    it('can dispatch UI actions', async () => {
      const { setSelectedJobId } = await import('./index');
      store.dispatch(setSelectedJobId('test-job-id'));
      expect(store.getState().ui.selectedJobId).toBe('test-job-id');

      // Reset
      store.dispatch(setSelectedJobId(null));
    });

    it('can dispatch JCF actions', async () => {
      const { setJcfClient, openJcfModal, closeJcfModal } = await import('./index');

      store.dispatch(openJcfModal('JOB-001'));
      expect(store.getState().jcf.isJcfModalOpen).toBe(true);
      expect(store.getState().jcf.jcfJobId).toBe('JOB-001');

      store.dispatch(setJcfClient('Test Client'));
      expect(store.getState().jcf.jcfClient).toBe('Test Client');

      // Reset
      store.dispatch(closeJcfModal());
    });
  });

  describe('RTK Query API', () => {
    it('exports scheduleApi', async () => {
      const { scheduleApi } = await import('./index');
      expect(scheduleApi).toBeDefined();
      expect(scheduleApi.reducerPath).toBe('scheduleApi');
    });

    it('exports query hooks', async () => {
      const { useGetSnapshotQuery } = await import('./index');
      expect(useGetSnapshotQuery).toBeDefined();
    });

    it('exports mutation hooks', async () => {
      const {
        useCreateJobMutation,
        useAssignTaskMutation,
        useRescheduleTaskMutation,
        useUnassignTaskMutation,
        useToggleCompletionMutation,
      } = await import('./index');

      expect(useCreateJobMutation).toBeDefined();
      expect(useAssignTaskMutation).toBeDefined();
      expect(useRescheduleTaskMutation).toBeDefined();
      expect(useUnassignTaskMutation).toBeDefined();
      expect(useToggleCompletionMutation).toBeDefined();
    });
  });
});
