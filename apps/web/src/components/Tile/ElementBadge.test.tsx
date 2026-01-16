import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ElementBadge } from './ElementBadge';

describe('ElementBadge', () => {
  it('renders suffix in lowercase', () => {
    render(<ElementBadge suffix="COUV" />);

    expect(screen.getByTestId('element-badge')).toHaveTextContent('couv');
  });

  it('renders already lowercase suffix correctly', () => {
    render(<ElementBadge suffix="int" />);

    expect(screen.getByTestId('element-badge')).toHaveTextContent('int');
  });

  it('renders mixed case suffix in lowercase', () => {
    render(<ElementBadge suffix="FiN" />);

    expect(screen.getByTestId('element-badge')).toHaveTextContent('fin');
  });

  it('has correct styling classes', () => {
    render(<ElementBadge suffix="COUV" />);

    const badge = screen.getByTestId('element-badge');
    expect(badge).toHaveClass('bg-black/50', 'rounded-sm', 'px-1', 'text-xs', 'font-normal');
  });
});
