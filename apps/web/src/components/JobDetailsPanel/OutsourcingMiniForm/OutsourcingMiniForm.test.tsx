import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutsourcingMiniForm } from './OutsourcingMiniForm';
import type { OutsourcedTask, OutsourcedProvider } from '@flux/types';

const createMockTask = (overrides: Partial<OutsourcedTask> = {}): OutsourcedTask => ({
  id: 'task-1',
  elementId: 'elem-1',
  sequenceOrder: 1,
  status: 'Defined',
  type: 'Outsourced',
  providerId: 'provider-1',
  actionType: 'Pelliculage',
  duration: {
    openDays: 2,
    latestDepartureTime: '14:00',
    receptionTime: '09:00',
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockProvider = (overrides: Partial<OutsourcedProvider> = {}): OutsourcedProvider => ({
  id: 'provider-1',
  name: 'ABC Finitions',
  status: 'Active',
  supportedActionTypes: ['Pelliculage', 'Dorure'],
  latestDepartureTime: '14:00',
  receptionTime: '09:00',
  transitDays: 1,
  groupId: 'group-1',
  ...overrides,
});

describe('OutsourcingMiniForm', () => {
  it('renders action type in header', () => {
    const task = createMockTask({ actionType: 'Pelliculage' });
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    expect(screen.getByTestId('outsourcing-action-type')).toHaveTextContent('Pelliculage');
  });

  it('renders provider name', () => {
    const task = createMockTask();
    const provider = createMockProvider({ name: 'ABC Finitions' });

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    expect(screen.getByTestId('outsourcing-provider-name')).toHaveTextContent('Provider: ABC Finitions');
  });

  it('shows "Unknown Provider" when provider is undefined', () => {
    const task = createMockTask();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={undefined}
        jobColor="#8b5cf6"
      />
    );

    expect(screen.getByTestId('outsourcing-provider-name')).toHaveTextContent('Provider: Unknown Provider');
  });

  it('renders work days input with correct value', () => {
    const task = createMockTask({
      duration: { openDays: 3, latestDepartureTime: '14:00', receptionTime: '09:00' },
    });
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    const input = screen.getByTestId('work-days-input') as HTMLInputElement;
    expect(input.value).toBe('3');
  });

  it('calls onWorkDaysChange when work days input changes', () => {
    const task = createMockTask();
    const provider = createMockProvider();
    const onWorkDaysChange = vi.fn();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
        onWorkDaysChange={onWorkDaysChange}
      />
    );

    const input = screen.getByTestId('work-days-input');
    fireEvent.change(input, { target: { value: '5' } });

    expect(onWorkDaysChange).toHaveBeenCalledWith('task-1', 5);
  });

  it('renders departure date picker', () => {
    const task = createMockTask();
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    expect(screen.getByTestId('outsourcing-departure')).toBeInTheDocument();
  });

  it('renders return date picker', () => {
    const task = createMockTask();
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    expect(screen.getByTestId('outsourcing-return')).toBeInTheDocument();
  });

  it('displays manual departure when set', () => {
    const task = createMockTask({
      manualDeparture: '2025-02-05T14:00:00.000Z',
    });
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    const input = screen.getByTestId('outsourcing-departure') as HTMLInputElement;
    // The formatted value depends on timezone, but should contain date/time pattern
    expect(input.value).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/);
  });

  it('displays manual return when set', () => {
    const task = createMockTask({
      manualReturn: '2025-02-10T09:00:00.000Z',
    });
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    const input = screen.getByTestId('outsourcing-return') as HTMLInputElement;
    expect(input.value).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/);
  });

  it('calculates dates from predecessor when available', () => {
    const task = createMockTask();
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
        predecessorEndTime="2025-02-05T11:00:00.000Z"
      />
    );

    // Departure and return should have calculated values
    const departure = screen.getByTestId('outsourcing-departure') as HTMLInputElement;
    const returnInput = screen.getByTestId('outsourcing-return') as HTMLInputElement;

    // Should have values (not empty placeholder)
    expect(departure.value).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/);
    expect(returnInput.value).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/);
  });

  it('applies job color to border', () => {
    const task = createMockTask();
    const provider = createMockProvider();

    render(
      <OutsourcingMiniForm
        task={task}
        provider={provider}
        jobColor="#8b5cf6"
      />
    );

    const form = screen.getByTestId('outsourcing-mini-form-task-1');
    expect(form).toHaveStyle({ borderLeftColor: '#8b5cf6' });
  });
});
