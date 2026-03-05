import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluxToolbar } from './FluxToolbar';

describe('FluxToolbar', () => {
  it('renders the page title', () => {
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onNewJob={vi.fn()}
      />
    );
    expect(screen.getByText('Flux de production')).toBeInTheDocument();
  });

  it('renders the Nouveau job button', () => {
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onNewJob={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-new-job-button')).toBeInTheDocument();
    expect(screen.getByText('Nouveau job')).toBeInTheDocument();
  });

  it('renders the Alt+N keyboard hint badge', () => {
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onNewJob={vi.fn()}
      />
    );
    expect(screen.getByText('Alt+N')).toBeInTheDocument();
  });

  it('calls onNewJob when Nouveau job button is clicked', () => {
    const onNewJob = vi.fn();
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onNewJob={onNewJob}
      />
    );
    fireEvent.click(screen.getByTestId('flux-new-job-button'));
    expect(onNewJob).toHaveBeenCalledOnce();
  });

  it('renders the search input with placeholder', () => {
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onNewJob={vi.fn()}
      />
    );
    const input = screen.getByTestId('flux-search');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Rechercher...');
  });

  it('displays the current searchValue in the input', () => {
    render(
      <FluxToolbar
        searchValue="Ducros"
        onSearchChange={vi.fn()}
        onNewJob={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-search')).toHaveValue('Ducros');
  });

  it('calls onSearchChange when input changes', () => {
    const onSearchChange = vi.fn();
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={onSearchChange}
        onNewJob={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId('flux-search'), {
      target: { value: 'Muller' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('Muller');
  });

  it('has aria-label on search input', () => {
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onNewJob={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Rechercher dans le tableau de flux')).toBeInTheDocument();
  });

  it('renders data-testid="flux-toolbar"', () => {
    render(
      <FluxToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onNewJob={vi.fn()}
      />
    );
    expect(screen.getByTestId('flux-toolbar')).toBeInTheDocument();
  });
});
