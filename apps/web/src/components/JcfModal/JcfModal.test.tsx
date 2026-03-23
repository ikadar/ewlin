/**
 * JcfModal Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfModal } from './JcfModal';

describe('JcfModal', () => {
  describe('visibility', () => {
    it('renders when isOpen is true', () => {
      render(<JcfModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByTestId('jcf-modal-backdrop')).toBeInTheDocument();
      expect(screen.getByTestId('jcf-modal-dialog')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<JcfModal isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByTestId('jcf-modal-backdrop')).not.toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('displays default title "Nouveau Job"', () => {
      render(<JcfModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByTestId('jcf-modal-title')).toHaveTextContent('Nouveau Job');
    });

    it('displays custom title', () => {
      render(<JcfModal isOpen={true} onClose={vi.fn()} title="Modifier Job" />);
      expect(screen.getByTestId('jcf-modal-title')).toHaveTextContent('Modifier Job');
    });

    it('has a close button', () => {
      render(<JcfModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByTestId('jcf-modal-close')).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<JcfModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('jcf-modal-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<JcfModal isOpen={true} onClose={onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close when backdrop is clicked', () => {
      const onClose = vi.fn();
      render(<JcfModal isOpen={true} onClose={onClose} />);
      const backdrop = screen.getByTestId('jcf-modal-backdrop');
      fireEvent.mouseDown(backdrop, { target: backdrop });
      fireEvent.mouseUp(backdrop, { target: backdrop });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('content', () => {
    it('renders placeholder content when no children provided', () => {
      render(<JcfModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('Contenu du formulaire job...')).toBeInTheDocument();
    });

    it('renders children when provided', () => {
      render(
        <JcfModal isOpen={true} onClose={vi.fn()}>
          <div data-testid="custom-content">Custom</div>
        </JcfModal>
      );
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.queryByText('Contenu du formulaire job...')).not.toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('renders keyboard hints', () => {
      render(<JcfModal isOpen={true} onClose={vi.fn()} />);
      const footer = screen.getByTestId('jcf-modal-footer');
      expect(footer).toBeInTheDocument();
      expect(footer.textContent).toContain('Tab');
      expect(footer.textContent).not.toContain('Esc');
      expect(footer.textContent).toContain('⌘S');
    });
  });

  describe('keyboard shortcuts', () => {
    it('prevents default on Cmd+S', () => {
      render(<JcfModal isOpen={true} onClose={vi.fn()} />);
      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const prevented = !document.dispatchEvent(event);
      expect(prevented).toBe(true);
    });
  });
});
