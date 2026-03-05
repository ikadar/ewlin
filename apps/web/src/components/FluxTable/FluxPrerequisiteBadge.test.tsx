import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FluxPrerequisiteBadge } from './FluxPrerequisiteBadge';

describe('FluxPrerequisiteBadge', () => {
  it('renders the badge label for bat_approved', () => {
    render(<FluxPrerequisiteBadge status="bat_approved" />);
    expect(screen.getByText('BAT OK')).toBeInTheDocument();
  });

  it('renders green color for bat_approved', () => {
    render(<FluxPrerequisiteBadge status="bat_approved" />);
    const badge = screen.getByText('BAT OK');
    expect(badge).toHaveAttribute('data-color', 'green');
  });

  it('renders green color for in_stock', () => {
    render(<FluxPrerequisiteBadge status="in_stock" />);
    expect(screen.getByText('Stock')).toHaveAttribute('data-color', 'green');
  });

  it('renders green color for ready', () => {
    render(<FluxPrerequisiteBadge status="ready" />);
    expect(screen.getByText('Prêt')).toHaveAttribute('data-color', 'green');
  });

  it('renders green color for delivered', () => {
    render(<FluxPrerequisiteBadge status="delivered" />);
    expect(screen.getByText('Livré')).toHaveAttribute('data-color', 'green');
  });

  it('renders yellow color for bat_sent', () => {
    render(<FluxPrerequisiteBadge status="bat_sent" />);
    expect(screen.getByText('Envoyé')).toHaveAttribute('data-color', 'yellow');
  });

  it('renders yellow color for files_received', () => {
    render(<FluxPrerequisiteBadge status="files_received" />);
    expect(screen.getByText('Reçus')).toHaveAttribute('data-color', 'yellow');
  });

  it('renders yellow color for ordered', () => {
    render(<FluxPrerequisiteBadge status="ordered" />);
    expect(screen.getByText('Cdé')).toHaveAttribute('data-color', 'yellow');
  });

  it('renders red color for waiting_files', () => {
    render(<FluxPrerequisiteBadge status="waiting_files" />);
    expect(screen.getByText('Att.fich')).toHaveAttribute('data-color', 'red');
  });

  it('renders red color for to_order', () => {
    render(<FluxPrerequisiteBadge status="to_order" />);
    expect(screen.getByText('A cder')).toHaveAttribute('data-color', 'red');
  });

  it('renders red color for to_make', () => {
    render(<FluxPrerequisiteBadge status="to_make" />);
    expect(screen.getByText('A faire')).toHaveAttribute('data-color', 'red');
  });

  it('renders gray color for none', () => {
    render(<FluxPrerequisiteBadge status="none" />);
    expect(screen.getByText('n.a.')).toHaveAttribute('data-color', 'gray');
  });

  it('does not render plusCount when not provided', () => {
    render(<FluxPrerequisiteBadge status="bat_approved" />);
    expect(screen.queryByTestId('flux-prereq-plus-count')).not.toBeInTheDocument();
  });

  it('does not render plusCount when 0', () => {
    render(<FluxPrerequisiteBadge status="bat_approved" plusCount={0} />);
    expect(screen.queryByTestId('flux-prereq-plus-count')).not.toBeInTheDocument();
  });

  it('renders +N label when plusCount > 0', () => {
    render(<FluxPrerequisiteBadge status="waiting_files" plusCount={2} />);
    expect(screen.getByTestId('flux-prereq-plus-count')).toHaveTextContent('+2');
  });

  it('renders +1 label when plusCount is 1', () => {
    render(<FluxPrerequisiteBadge status="waiting_files" plusCount={1} />);
    expect(screen.getByTestId('flux-prereq-plus-count')).toHaveTextContent('+1');
  });
});
