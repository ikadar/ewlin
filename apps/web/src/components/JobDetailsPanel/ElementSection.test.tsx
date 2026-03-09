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

  it('renders prerequisite pills on same row as element name', () => {
    const element = createElement({ name: 'COUV' });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div>Task content</div>
      </ElementSection>
    );

    // Prerequisite status pills should be rendered
    expect(screen.getByTestId('prerequisite-status')).toBeInTheDocument();
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
