import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ElementSection } from './ElementSection';
import type { Element } from '@flux/types';

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
  it('renders element name', () => {
    const element = createElement({ name: 'COUV' });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div data-testid="child">Task content</div>
      </ElementSection>
    );

    expect(screen.getByText('COUV')).toBeInTheDocument();
  });

  it('renders children tasks', () => {
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

  it('renders upstream precedence pills inline on same row as name', () => {
    const couv = createElement({ id: 'elem-couv', name: 'COUV', prerequisiteElementIds: [] });
    const inter = createElement({ id: 'elem-int', name: 'INTERIEUR', prerequisiteElementIds: [] });
    const finition = createElement({
      id: 'elem-fin',
      name: 'FINITION',
      prerequisiteElementIds: ['elem-couv', 'elem-int'],
    });

    render(
      <ElementSection element={finition} allElements={[couv, inter, finition]}>
        <div>tile</div>
      </ElementSection>
    );

    expect(screen.getByText('FINITION')).toBeInTheDocument();
    expect(screen.getByText('après')).toBeInTheDocument();
    expect(screen.getByText('COUV')).toBeInTheDocument();
    expect(screen.getByText('INTERIEUR')).toBeInTheDocument();
  });

  it('does not render "après" label when element has no precedence', () => {
    const element = createElement({ name: 'COUV', prerequisiteElementIds: [] });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div>tile</div>
      </ElementSection>
    );

    expect(screen.queryByText('après')).not.toBeInTheDocument();
  });

  it('renders single-element jobs with the same card frame as multi-element', () => {
    const element = createElement({ name: 'ELT' });

    render(
      <ElementSection element={element} allElements={[element]} isSingleElement>
        <div data-testid="child">Task content</div>
      </ElementSection>
    );

    expect(screen.getByText('ELT')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('falls back to "Élément unique" when single-element has no name', () => {
    const element = createElement({ name: '' });

    render(
      <ElementSection element={element} allElements={[element]} isSingleElement>
        <div data-testid="child">Task content</div>
      </ElementSection>
    );

    expect(screen.getByText('Élément unique')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('keeps element name as-is for multi-element jobs even when empty', () => {
    const element = createElement({ name: '' });

    render(
      <ElementSection element={element} allElements={[element]}>
        <div>tile</div>
      </ElementSection>
    );

    // Multi-element with no name should NOT use the single-element fallback.
    expect(screen.queryByText('Élément unique')).not.toBeInTheDocument();
  });
});
