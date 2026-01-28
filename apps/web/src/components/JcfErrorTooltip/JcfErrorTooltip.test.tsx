/**
 * Unit tests for JcfErrorTooltip component
 *
 * @see JcfErrorTooltip.tsx
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { JcfErrorTooltip } from './JcfErrorTooltip';

describe('JcfErrorTooltip', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Visibility ────────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={false}
        />,
      );
      expect(screen.queryByTestId('error-badge')).not.toBeInTheDocument();
    });

    it('renders error badge when visible is true', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );
      expect(screen.getByTestId('error-badge')).toBeInTheDocument();
    });

    it('displays "!" in the error badge', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );
      const badge = screen.getByTestId('error-badge');
      expect(badge).toHaveTextContent('!');
    });
  });

  // ── Tooltip Display ───────────────────────────────────────────────────────

  describe('tooltip display', () => {
    it('shows tooltip on badge hover', async () => {
      render(
        <JcfErrorTooltip
          message="<strong>Error</strong>"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      fireEvent.mouseEnter(badge);

      const tooltip = screen.getByTestId('error-tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('hides tooltip when mouse leaves badge', async () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      fireEvent.mouseEnter(badge);
      fireEvent.mouseLeave(badge);

      expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument();
    });

    it('renders HTML content in tooltip', () => {
      render(
        <JcfErrorTooltip
          message="<strong>Bold</strong> and <code>code</code>"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      fireEvent.mouseEnter(badge);

      const tooltip = screen.getByTestId('error-tooltip');
      expect(tooltip.innerHTML).toContain('<strong>Bold</strong>');
      expect(tooltip.innerHTML).toContain('<code>code</code>');
    });
  });

  // ── Input Focus Tracking ──────────────────────────────────────────────────

  describe('input focus tracking', () => {
    it('shows tooltip when associated input is focused', async () => {
      // Create an input element
      const container = document.createElement('div');
      const input = document.createElement('input');
      input.id = 'test-input';
      container.appendChild(input);
      document.body.appendChild(container);

      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
          inputId="test-input"
        />,
      );

      // Focus the input
      await act(async () => {
        input.focus();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-tooltip')).toBeInTheDocument();
      });

      // Cleanup
      document.body.removeChild(container);
    });

    it('hides tooltip when associated input loses focus', async () => {
      // Create an input element
      const container = document.createElement('div');
      const input = document.createElement('input');
      input.id = 'test-input';
      container.appendChild(input);
      document.body.appendChild(container);

      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
          inputId="test-input"
        />,
      );

      // Focus then blur the input
      await act(async () => {
        input.focus();
      });
      await waitFor(() => {
        expect(screen.getByTestId('error-tooltip')).toBeInTheDocument();
      });

      await act(async () => {
        input.blur();
      });
      await waitFor(() => {
        expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument();
      });

      // Cleanup
      document.body.removeChild(container);
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('badge has aria-hidden attribute', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
    });

    it('tooltip has role="tooltip"', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      fireEvent.mouseEnter(badge);

      const tooltip = screen.getByTestId('error-tooltip');
      expect(tooltip).toHaveAttribute('role', 'tooltip');
    });
  });

  // ── Styling ───────────────────────────────────────────────────────────────

  describe('styling', () => {
    it('badge has red background styling', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      expect(badge.className).toContain('bg-red-500');
    });

    it('badge is positioned absolutely', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      expect(badge.className).toContain('absolute');
    });

    it('tooltip has fixed positioning', () => {
      render(
        <JcfErrorTooltip
          message="Test error"
          visible={true}
        />,
      );

      const badge = screen.getByTestId('error-badge');
      fireEvent.mouseEnter(badge);

      const tooltip = screen.getByTestId('error-tooltip');
      expect(tooltip.className).toContain('fixed');
    });
  });
});
