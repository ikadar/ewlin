/**
 * TileTooltip Component Tests
 * Fázis D: TileTooltip Enhancement (spec §6, 2026-02-23)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TileTooltip } from './TileTooltip';
import type { Job, Element, InternalTask, TaskAssignment } from '@flux/types';
import type { PrerequisiteBlockingInfo } from '../../utils';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    reference: 'CMD-001',
    client: 'Acme Corp',
    description: 'Brochure A4',
    status: 'scheduled',
    workshopExitDate: '2026-03-15T00:00:00.000Z',
    fullyScheduled: true,
    color: '#3B82F6',
    comments: [],
    elementIds: [],
    taskIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Job;
}

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'elem-1',
    jobId: 'job-1',
    name: 'couv',
    label: 'Couverture',
    prerequisiteElementIds: [],
    taskIds: ['task-1'],
    spec: {
      format: 'A4f',
      papier: 'Couché mat:135',
      pagination: 16,
      imposition: '50x70(8)',
      impression: 'Q/Q',
      surfacage: 'mat/mat',
      quantite: 5000,
      qteFeuilles: 250,
      autres: 'Note spéciale',
    },
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Element;
}

function makeTask(overrides: Partial<InternalTask> = {}): InternalTask {
  return {
    id: 'task-1',
    elementId: 'elem-1',
    stationId: 'station-1',
    duration: { setupMinutes: 30, runMinutes: 120 },
    isInternal: true,
    ...overrides,
  } as InternalTask;
}

function makeAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    id: 'assign-1',
    taskId: 'task-1',
    targetId: 'station-1',
    scheduledStart: '2026-03-10T08:00:00.000Z',
    scheduledEnd: '2026-03-10T10:30:00.000Z',
    isCompleted: false,
    isOutsourced: false,
    ...overrides,
  } as TaskAssignment;
}

function makeBlockingInfo(overrides: Partial<PrerequisiteBlockingInfo> = {}): PrerequisiteBlockingInfo {
  return {
    isBlocked: true,
    paper: { status: 'to_order', isReady: false },
    bat: { status: 'bat_approved', isReady: true },
    plates: { status: 'ready', isReady: true },
    forme: { status: 'none', isReady: true },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TileTooltip', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <TileTooltip
        isVisible={false}
        job={makeJob()}
        task={makeTask()}
        assignment={makeAssignment()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders tooltip when visible', () => {
    render(
      <TileTooltip
        isVisible={true}
        job={makeJob()}
        task={makeTask()}
        assignment={makeAssignment()}
      />
    );
    expect(screen.getByTestId('tile-tooltip')).toBeInTheDocument();
  });

  describe('Header section', () => {
    it('shows job reference and client', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByText('CMD-001')).toBeInTheDocument();
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    });
  });

  describe('Description section', () => {
    it('shows description when non-empty', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob({ description: 'Brochure A4' })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByTestId('tile-tooltip-description')).toBeInTheDocument();
      expect(screen.getByText('Brochure A4')).toBeInTheDocument();
    });

    it('hides description section when empty', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob({ description: '' })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.queryByTestId('tile-tooltip-description')).not.toBeInTheDocument();
    });
  });

  describe('Deadline section', () => {
    it('shows deadline when workshopExitDate is set', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob({ workshopExitDate: '2026-03-15T00:00:00.000Z' })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByTestId('tile-tooltip-deadline')).toBeInTheDocument();
      expect(screen.getByText(/Sortie atelier/)).toBeInTheDocument();
      expect(screen.getByText('15/03/2026')).toBeInTheDocument();
    });

    it('hides deadline when workshopExitDate is empty', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob({ workshopExitDate: '' })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.queryByTestId('tile-tooltip-deadline')).not.toBeInTheDocument();
    });
  });

  describe('Element section', () => {
    it('shows element label when present', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement({ label: 'Couverture' })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByTestId('tile-tooltip-element')).toBeInTheDocument();
      expect(screen.getByText('Couverture')).toBeInTheDocument();
    });

    it('falls back to element name when no label', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement({ label: undefined, name: 'couv' })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByText('couv')).toBeInTheDocument();
    });

    it('hides element section when no element', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.queryByTestId('tile-tooltip-element')).not.toBeInTheDocument();
    });
  });

  describe('Spec section', () => {
    it('shows parsed papier with grammage', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement()}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByText(/Couché mat 135g/)).toBeInTheDocument();
    });

    it('shows pagination with p suffix', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement()}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByText('16p')).toBeInTheDocument();
    });

    it('shows quantite with ex suffix', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement()}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByText('5000ex')).toBeInTheDocument();
    });

    it('shows qteFeuilles with F suffix', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement()}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByText('250F')).toBeInTheDocument();
    });

    it('hides spec section when element has no spec', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement({ spec: undefined })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.queryByTestId('tile-tooltip-spec')).not.toBeInTheDocument();
    });

    it('skips null spec fields silently', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          element={makeElement({ spec: { format: 'A4f' } })}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByText('A4f')).toBeInTheDocument();
      expect(screen.queryByText(/Papier/)).not.toBeInTheDocument();
    });
  });

  describe('Prerequisites section', () => {
    it('shows prerequisite items when blockingInfo has non-none fields', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask()}
          assignment={makeAssignment()}
          blockingInfo={makeBlockingInfo()}
          isBlocked={true}
        />
      );
      expect(screen.getByTestId('tile-tooltip-prerequisites')).toBeInTheDocument();
      expect(screen.getByText(/Papier/)).toBeInTheDocument();
      expect(screen.getByText('⚠')).toBeInTheDocument();
    });

    it('shows check icon for ready prerequisites', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask()}
          assignment={makeAssignment()}
          blockingInfo={makeBlockingInfo()}
          isBlocked={true}
        />
      );
      // BAT and Plates are ready
      const checks = screen.getAllByText('✓');
      expect(checks.length).toBeGreaterThanOrEqual(1);
    });

    it('hides prerequisites section when no blockingInfo', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask()}
          assignment={makeAssignment()}
        />
      );
      expect(screen.queryByTestId('tile-tooltip-prerequisites')).not.toBeInTheDocument();
    });

    it('hides prerequisites section when all fields are none+ready', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask()}
          assignment={makeAssignment()}
          blockingInfo={{
            isBlocked: false,
            paper: { status: 'none', isReady: true },
            bat: { status: 'none', isReady: true },
            plates: { status: 'none', isReady: true },
            forme: { status: 'none', isReady: true },
          }}
        />
      );
      expect(screen.queryByTestId('tile-tooltip-prerequisites')).not.toBeInTheDocument();
    });
  });

  describe('Task section', () => {
    it('shows setup and run minutes', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask({ duration: { setupMinutes: 30, runMinutes: 120 } })}
          assignment={makeAssignment()}
        />
      );
      expect(screen.getByTestId('tile-tooltip-task')).toBeInTheDocument();
      expect(screen.getByText('30min')).toBeInTheDocument();
      expect(screen.getByText('120min')).toBeInTheDocument();
    });
  });

  describe('Schedule section', () => {
    it('shows formatted start and end times', () => {
      render(
        <TileTooltip
          isVisible={true}
          job={makeJob()}
          task={makeTask()}
          assignment={makeAssignment({
            scheduledStart: '2026-03-10T08:00:00.000Z',
            scheduledEnd: '2026-03-10T10:30:00.000Z',
          })}
        />
      );
      expect(screen.getByTestId('tile-tooltip-schedule')).toBeInTheDocument();
    });
  });
});
