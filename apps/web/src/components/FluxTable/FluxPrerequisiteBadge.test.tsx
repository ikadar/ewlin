import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FluxPrerequisiteBadge } from './FluxPrerequisiteBadge';

describe('FluxPrerequisiteBadge', () => {
  it('renders the status text', () => {
    render(<FluxPrerequisiteBadge status="OK" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('renders green color for OK', () => {
    render(<FluxPrerequisiteBadge status="OK" />);
    const badge = screen.getByText('OK');
    expect(badge).toHaveAttribute('data-color', 'green');
  });

  it('renders green color for Stock', () => {
    render(<FluxPrerequisiteBadge status="Stock" />);
    expect(screen.getByText('Stock')).toHaveAttribute('data-color', 'green');
  });

  it('renders green color for Pretes', () => {
    render(<FluxPrerequisiteBadge status="Pretes" />);
    expect(screen.getByText('Pretes')).toHaveAttribute('data-color', 'green');
  });

  it('renders green color for Livre', () => {
    render(<FluxPrerequisiteBadge status="Livre" />);
    expect(screen.getByText('Livre')).toHaveAttribute('data-color', 'green');
  });

  it('renders green color for Livree', () => {
    render(<FluxPrerequisiteBadge status="Livree" />);
    expect(screen.getByText('Livree')).toHaveAttribute('data-color', 'green');
  });

  it('renders yellow color for Envoye', () => {
    render(<FluxPrerequisiteBadge status="Envoye" />);
    expect(screen.getByText('Envoye')).toHaveAttribute('data-color', 'yellow');
  });

  it('renders yellow color for Recus', () => {
    render(<FluxPrerequisiteBadge status="Recus" />);
    expect(screen.getByText('Recus')).toHaveAttribute('data-color', 'yellow');
  });

  it('renders yellow color for Cde', () => {
    render(<FluxPrerequisiteBadge status="Cde" />);
    expect(screen.getByText('Cde')).toHaveAttribute('data-color', 'yellow');
  });

  it('renders yellow color for Cdee', () => {
    render(<FluxPrerequisiteBadge status="Cdee" />);
    expect(screen.getByText('Cdee')).toHaveAttribute('data-color', 'yellow');
  });

  it('renders red color for Att.fich', () => {
    render(<FluxPrerequisiteBadge status="Att.fich" />);
    expect(screen.getByText('Att.fich')).toHaveAttribute('data-color', 'red');
  });

  it('renders red color for A cder', () => {
    render(<FluxPrerequisiteBadge status="A cder" />);
    expect(screen.getByText('A cder')).toHaveAttribute('data-color', 'red');
  });

  it('renders red color for A faire', () => {
    render(<FluxPrerequisiteBadge status="A faire" />);
    expect(screen.getByText('A faire')).toHaveAttribute('data-color', 'red');
  });

  it('renders gray color for n.a.', () => {
    render(<FluxPrerequisiteBadge status="n.a." />);
    expect(screen.getByText('n.a.')).toHaveAttribute('data-color', 'gray');
  });

  it('does not render plusCount when not provided', () => {
    render(<FluxPrerequisiteBadge status="OK" />);
    expect(screen.queryByTestId('flux-prereq-plus-count')).not.toBeInTheDocument();
  });

  it('does not render plusCount when 0', () => {
    render(<FluxPrerequisiteBadge status="OK" plusCount={0} />);
    expect(screen.queryByTestId('flux-prereq-plus-count')).not.toBeInTheDocument();
  });

  it('renders +N label when plusCount > 0', () => {
    render(<FluxPrerequisiteBadge status="Att.fich" plusCount={2} />);
    expect(screen.getByTestId('flux-prereq-plus-count')).toHaveTextContent('+2');
  });

  it('renders +1 label when plusCount is 1', () => {
    render(<FluxPrerequisiteBadge status="Att.fich" plusCount={1} />);
    expect(screen.getByTestId('flux-prereq-plus-count')).toHaveTextContent('+1');
  });
});
