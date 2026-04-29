import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluxToolbar } from './FluxToolbar';
import { EMPTY_FLUX_FILTERS } from '@/components/FluxTable/fluxFilters';

function renderToolbar(overrides: Partial<React.ComponentProps<typeof FluxToolbar>> = {}) {
  const props: React.ComponentProps<typeof FluxToolbar> = {
    searchValue: '',
    onSearchChange: vi.fn(),
    onNewJob: vi.fn(),
    jobs: [],
    filters: EMPTY_FLUX_FILTERS,
    onFiltersChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<FluxToolbar {...props} />) };
}

describe('FluxToolbar', () => {
  it('renders the page title', () => {
    renderToolbar();
    expect(screen.getByText('Flux de production')).toBeInTheDocument();
  });

  it('renders the Nouveau job button', () => {
    renderToolbar();
    expect(screen.getByTestId('flux-new-job-button')).toBeInTheDocument();
    expect(screen.getByText('Nouveau job')).toBeInTheDocument();
  });

  it('calls onNewJob when Nouveau job button is clicked', () => {
    const onNewJob = vi.fn();
    renderToolbar({ onNewJob });
    fireEvent.click(screen.getByTestId('flux-new-job-button'));
    expect(onNewJob).toHaveBeenCalledOnce();
  });

  it('renders the search input with placeholder', () => {
    renderToolbar();
    const input = screen.getByTestId('flux-search');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Rechercher...');
  });

  it('displays the current searchValue in the input', () => {
    renderToolbar({ searchValue: 'Ducros' });
    expect(screen.getByTestId('flux-search')).toHaveValue('Ducros');
  });

  it('calls onSearchChange when input changes', () => {
    const onSearchChange = vi.fn();
    renderToolbar({ onSearchChange });
    fireEvent.change(screen.getByTestId('flux-search'), {
      target: { value: 'Muller' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('Muller');
  });

  it('has aria-label on search input', () => {
    renderToolbar();
    expect(screen.getByLabelText('Rechercher dans le tableau de flux')).toBeInTheDocument();
  });

  it('renders data-testid="flux-toolbar"', () => {
    renderToolbar();
    expect(screen.getByTestId('flux-toolbar')).toBeInTheDocument();
  });

  it('renders the filter bar', () => {
    renderToolbar();
    expect(screen.getByTestId('flux-filter-bar')).toBeInTheDocument();
  });
});
