import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { highlightMatch } from './highlightMatch';

describe('highlightMatch', () => {
  describe('match found', () => {
    it('highlights matching substring with bold+blue', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'ach', false)}</>);
      const boldSpan = container.querySelector('.font-bold.text-blue-400');
      expect(boldSpan).toBeInTheDocument();
      expect(boldSpan?.textContent).toBe('ach');
    });

    it('renders non-matching parts as plain text', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'ach', false)}</>);
      expect(container.textContent).toBe('Hachette Livre');
    });

    it('handles match at beginning of string', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'Hach', false)}</>);
      const boldSpan = container.querySelector('.font-bold.text-blue-400');
      expect(boldSpan?.textContent).toBe('Hach');
    });

    it('handles match at end of string', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'ivre', false)}</>);
      const boldSpan = container.querySelector('.font-bold.text-blue-400');
      expect(boldSpan?.textContent).toBe('ivre');
    });

    it('is case-insensitive', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'HACH', false)}</>);
      const boldSpan = container.querySelector('.font-bold.text-blue-400');
      expect(boldSpan?.textContent).toBe('Hach');
    });
  });

  describe('highlighted state', () => {
    it('uses bold+underline when highlighted', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'ach', true)}</>);
      const boldSpan = container.querySelector('.font-bold.underline');
      expect(boldSpan).toBeInTheDocument();
      expect(boldSpan?.textContent).toBe('ach');
    });

    it('does not use text-blue-400 when highlighted', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'ach', true)}</>);
      const blueSpan = container.querySelector('.text-blue-400');
      expect(blueSpan).not.toBeInTheDocument();
    });
  });

  describe('no match', () => {
    it('returns plain text span when no match', () => {
      render(<>{highlightMatch('Hachette Livre', 'xyz', false)}</>);
      expect(screen.getByText('Hachette Livre')).toBeInTheDocument();
    });

    it('does not add bold styling when no match', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', 'xyz', false)}</>);
      expect(container.querySelector('.font-bold')).not.toBeInTheDocument();
    });
  });

  describe('empty search', () => {
    it('returns plain text span for empty search', () => {
      render(<>{highlightMatch('Hachette Livre', '', false)}</>);
      expect(screen.getByText('Hachette Livre')).toBeInTheDocument();
    });

    it('does not add bold styling for empty search', () => {
      const { container } = render(<>{highlightMatch('Hachette Livre', '', false)}</>);
      expect(container.querySelector('.font-bold')).not.toBeInTheDocument();
    });
  });
});
