import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfLinkToggle } from './JcfLinkToggle';

describe('JcfLinkToggle', () => {
  it('renders with Link2 icon when linked', () => {
    render(
      <JcfLinkToggle
        isLinked={true}
        onToggle={() => {}}
        data-testid="link-toggle"
      />
    );

    const button = screen.getByTestId('link-toggle');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('text-blue-400');
  });

  it('renders with Unlink icon when not linked', () => {
    render(
      <JcfLinkToggle
        isLinked={false}
        onToggle={() => {}}
        data-testid="link-toggle"
      />
    );

    const button = screen.getByTestId('link-toggle');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('text-zinc-500');
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();

    render(
      <JcfLinkToggle
        isLinked={false}
        onToggle={onToggle}
        data-testid="link-toggle"
      />
    );

    fireEvent.click(screen.getByTestId('link-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not call onToggle when disabled', () => {
    const onToggle = vi.fn();

    render(
      <JcfLinkToggle
        isLinked={false}
        onToggle={onToggle}
        disabled={true}
        data-testid="link-toggle"
      />
    );

    fireEvent.click(screen.getByTestId('link-toggle'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('has disabled styling when disabled', () => {
    render(
      <JcfLinkToggle
        isLinked={false}
        onToggle={() => {}}
        disabled={true}
        data-testid="link-toggle"
      />
    );

    const button = screen.getByTestId('link-toggle');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-30');
    expect(button).toHaveClass('cursor-not-allowed');
  });

  it('shows correct title for linked state', () => {
    render(
      <JcfLinkToggle
        isLinked={true}
        onToggle={() => {}}
        data-testid="link-toggle"
      />
    );

    const button = screen.getByTestId('link-toggle');
    expect(button).toHaveAttribute('title', "Délier de l'élément précédent");
  });

  it('shows correct title for unlinked state', () => {
    render(
      <JcfLinkToggle
        isLinked={false}
        onToggle={() => {}}
        data-testid="link-toggle"
      />
    );

    const button = screen.getByTestId('link-toggle');
    expect(button).toHaveAttribute('title', "Lier à l'élément précédent");
  });

  it('shows correct title for disabled state', () => {
    render(
      <JcfLinkToggle
        isLinked={false}
        onToggle={() => {}}
        disabled={true}
        data-testid="link-toggle"
      />
    );

    const button = screen.getByTestId('link-toggle');
    expect(button).toHaveAttribute('title', 'Pas de lien possible (premier élément)');
  });

  it('uses custom title when provided', () => {
    render(
      <JcfLinkToggle
        isLinked={false}
        onToggle={() => {}}
        title="Custom tooltip"
        data-testid="link-toggle"
      />
    );

    const button = screen.getByTestId('link-toggle');
    expect(button).toHaveAttribute('title', 'Custom tooltip');
  });
});
