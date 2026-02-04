import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ElementSection } from './ElementSection';
import type { Element } from '@flux/types';

// Helper to create test element
function createElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'elem-job-00001-couv',
    jobId: 'job-00001',
    name: 'COUV',
    label: 'Couverture',
    prerequisiteElementIds: [],
    taskIds: ['task-1', 'task-2'],
    paperStatus: 'in_stock',
    batStatus: 'bat_approved',
    plateStatus: 'ready',
    formeStatus: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ElementSection', () => {
  it('renders element name in uppercase', () => {
    const element = createElement({ name: 'couv' });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div data-testid="child">Task content</div>
      </ElementSection>
    );

    expect(screen.getByText('COUV')).toBeInTheDocument();
  });

  it('renders element label when provided', () => {
    const element = createElement({ label: 'Couverture' });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div>Task content</div>
      </ElementSection>
    );

    expect(screen.getByText('Couverture')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    const element = createElement({ label: undefined });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div>Task content</div>
      </ElementSection>
    );

    expect(screen.queryByText('Couverture')).not.toBeInTheDocument();
  });

  it('renders prerequisite namees with Workflow icon', () => {
    const couvElement = createElement({
      id: 'elem-couv',
      name: 'COUV',
      prerequisiteElementIds: [],
    });
    const intElement = createElement({
      id: 'elem-int',
      name: 'INT',
      prerequisiteElementIds: [],
    });
    const finElement = createElement({
      id: 'elem-fin',
      name: 'FIN',
      prerequisiteElementIds: ['elem-couv', 'elem-int'],
    });

    const allElements = [couvElement, intElement, finElement];

    render(
      <ElementSection element={finElement} allElements={allElements}>
        <div>Task content</div>
      </ElementSection>
    );

    // Should show lowercase prerequisite namees
    expect(screen.getByText('couv int')).toBeInTheDocument();
  });

  it('does not show prerequisites section when there are none', () => {
    const element = createElement({ prerequisiteElementIds: [] });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div>Task content</div>
      </ElementSection>
    );

    // Should not find the Workflow icon text (no prerequisites)
    expect(screen.queryByText('couv int')).not.toBeInTheDocument();
  });

  it('hides header for single-element jobs', () => {
    const element = createElement({ name: 'ELT' });

    render(
      <ElementSection element={element} allElements={[element]} isSingleElement>
        <div data-testid="child">Task content</div>
      </ElementSection>
    );

    // Header should not be visible
    expect(screen.queryByText('ELT')).not.toBeInTheDocument();
    // But children should still render
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders children', () => {
    const element = createElement();

    render(
      <ElementSection element={element} allElements={[element]}>
        <div data-testid="task-1">Task 1</div>
        <div data-testid="task-2">Task 2</div>
      </ElementSection>
    );

    expect(screen.getByTestId('task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-2')).toBeInTheDocument();
  });
});
