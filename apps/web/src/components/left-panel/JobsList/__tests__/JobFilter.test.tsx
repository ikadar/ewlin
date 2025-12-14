import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobFilter } from '../JobFilter';

describe('JobFilter', () => {
  it('renders input with placeholder', () => {
    render(<JobFilter value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Filter jobs...')).toBeInTheDocument();
  });

  it('displays the current filter value', () => {
    render(<JobFilter value="test" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<JobFilter value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'new value' },
    });

    expect(onChange).toHaveBeenCalledWith('new value');
  });

  it('shows clear button when value is not empty', () => {
    render(<JobFilter value="test" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Clear filter')).toBeInTheDocument();
  });

  it('does not show clear button when value is empty', () => {
    render(<JobFilter value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Clear filter')).not.toBeInTheDocument();
  });

  it('calls onChange with empty string when clear button is clicked', () => {
    const onChange = vi.fn();
    render(<JobFilter value="test" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Clear filter'));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('has correct aria-label', () => {
    render(<JobFilter value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Filter jobs')).toBeInTheDocument();
  });
});
