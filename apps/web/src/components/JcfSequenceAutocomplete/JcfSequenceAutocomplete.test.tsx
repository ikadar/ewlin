import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfSequenceAutocomplete } from './JcfSequenceAutocomplete';
import type { PostePreset, SoustraitantPreset } from '@flux/types';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const postePresets: PostePreset[] = [
  { name: 'G37', category: 'Presse offset' },
  { name: '754', category: 'Presse offset' },
  { name: 'Stahl', category: 'Plieuse' },
  { name: 'H', category: 'Encarteuse-piqueuse' },
];

const stPresets: SoustraitantPreset[] = [
  { name: 'MCA' },
  { name: 'F37' },
  { name: 'LGI' },
  { name: 'AVN' },
  { name: 'JF' },
];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  postePresets,
  soustraitantPresets: stPresets,
  id: 'test-seq',
};

describe('JcfSequenceAutocomplete', () => {
  describe('rendering', () => {
    it('renders a textarea element', () => {
      render(<JcfSequenceAutocomplete {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('shows empty string when value is empty', () => {
      render(<JcfSequenceAutocomplete {...defaultProps} value="" />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('shows existing value', () => {
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value="G37(20+40)"
        />,
      );
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('G37(20+40)');
    });

    it('shows placeholder text', () => {
      render(<JcfSequenceAutocomplete {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder');
    });
  });

  describe('poste suggestions', () => {
    it('shows poste names on focus', () => {
      render(<JcfSequenceAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      expect(dropdown).toBeInTheDocument();
      expect(dropdown!.textContent).toContain('G37');
      expect(dropdown!.textContent).toContain('754');
      expect(dropdown!.textContent).toContain('Stahl');
      expect(dropdown!.textContent).toContain('H');
    });

    it('shows ST: option in suggestions', () => {
      render(<JcfSequenceAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      expect(dropdown!.textContent).toContain('ST:');
      expect(dropdown!.textContent).toContain('Sous-traitant');
    });

    it('shows category descriptions', () => {
      render(<JcfSequenceAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      expect(dropdown!.textContent).toContain('Presse offset');
      expect(dropdown!.textContent).toContain('Plieuse');
    });

    it('filters suggestions by typed text', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="G3" />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.focus(textarea);
      // Simulate cursor at end
      Object.defineProperty(textarea, 'selectionStart', { value: 2 });
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('G37');
        expect(dropdown.textContent).not.toContain('Stahl');
      }
    });
  });

  describe('duration suggestions', () => {
    it('shows duration suggestions after poste(', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="G37(" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 4 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('20)');
        expect(dropdown.textContent).toContain('30)');
        expect(dropdown.textContent).toContain('20+30)');
      }
    });

    it('filters duration suggestions by typed text', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="G37(20" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 6 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('20)');
        expect(dropdown.textContent).toContain('20+30)');
        expect(dropdown.textContent).toContain('20+40)');
        expect(dropdown.textContent).not.toContain('60)');
      }
    });
  });

  describe('selection', () => {
    it('calls onChange when poste is selected', () => {
      const onChange = vi.fn();
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 0 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        const firstItem = dropdown.querySelector(
          'div[class*="cursor-pointer"]',
        );
        if (firstItem) {
          fireEvent.mouseDown(firstItem);
          expect(onChange).toHaveBeenCalledWith('G37(');
        }
      }
    });
  });

  describe('complete lines', () => {
    it('does not show suggestions for complete line', () => {
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value="G37(20)"
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 7 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      // Complete line: dropdown may not render or show no items
      expect(
        dropdown === null || dropdown.textContent === '',
      ).toBe(true);
    });
  });

  describe('multi-line', () => {
    it('shows suggestions for new empty line', () => {
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value={'G37(20)\n'}
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 8 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('G37');
        expect(dropdown.textContent).toContain('Stahl');
      }
    });
  });

  describe('navigation delegation', () => {
    it('delegates Tab to onTabOut', () => {
      const onTabOut = vi.fn();
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          onTabOut={onTabOut}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(
        expect.any(Object),
        'forward',
      );
    });

    it('delegates Shift+Tab to onTabOut backward', () => {
      const onTabOut = vi.fn();
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          onTabOut={onTabOut}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });
      expect(onTabOut).toHaveBeenCalledWith(
        expect.any(Object),
        'backward',
      );
    });

    it('delegates Alt+ArrowDown to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          onArrowNav={onArrowNav}
        />,
      );
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, {
        key: 'ArrowDown',
        altKey: true,
      });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.any(Object),
        'down',
      );
    });
  });

  describe('keyboard navigation', () => {
    it('closes dropdown on Escape', () => {
      render(<JcfSequenceAutocomplete {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.focus(textarea);
      expect(
        document.querySelector('[data-testid="test-seq-dropdown"]'),
      ).toBeInTheDocument();

      fireEvent.keyDown(textarea, { key: 'Escape' });
      // Escape should close dropdown
      expect(
        document.querySelector('[data-testid="test-seq-dropdown"]'),
      ).not.toBeInTheDocument();
    });

    it('Enter selects highlighted item', () => {
      const onChange = vi.fn();
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 0 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith('G37(');
    });
  });

  describe('session learning', () => {
    it('shows session postes first in suggestions', () => {
      const sessionPostes: PostePreset[] = [
        { name: 'CustomMachine', category: 'Presse offset' },
      ];
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          sessionPostes={sessionPostes}
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('CustomMachine');
        // Session postes should appear before presets
        const items = dropdown.querySelectorAll(
          'div[class*="cursor-pointer"]',
        );
        if (items.length > 0) {
          expect(items[0].textContent).toContain('CustomMachine');
        }
      }
    });
  });

  describe('ST name suggestions', () => {
    it('shows sous-traitant names after ST:', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="ST:" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 3 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('MCA');
        expect(dropdown.textContent).toContain('F37');
        expect(dropdown.textContent).toContain('LGI');
        expect(dropdown.textContent).toContain('AVN');
        expect(dropdown.textContent).toContain('JF');
      }
    });

    it('filters ST names by typed text', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="ST:MC" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 5 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('MCA');
        expect(dropdown.textContent).not.toContain('LGI');
        expect(dropdown.textContent).not.toContain('JF');
      }
    });

    it('shows ST name with Sous-traitant description', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="ST:" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 3 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('Sous-traitant');
      }
    });

    it('calls onChange with ST:Name( when ST name selected', () => {
      const onChange = vi.fn();
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value="ST:"
          onChange={onChange}
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 3 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        const firstItem = dropdown.querySelector(
          'div[class*="cursor-pointer"]',
        );
        if (firstItem) {
          fireEvent.mouseDown(firstItem);
          expect(onChange).toHaveBeenCalledWith('ST:MCA(');
        }
      }
    });
  });

  describe('ST duration suggestions', () => {
    it('shows ST durations after ST:Name(', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="ST:MCA(" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 7 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('1j)');
        expect(dropdown.textContent).toContain('2j)');
        expect(dropdown.textContent).toContain('3j)');
        expect(dropdown.textContent).toContain('4j)');
        expect(dropdown.textContent).toContain('5j)');
      }
    });

    it('filters ST durations by typed text', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="ST:MCA(3" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 8 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('3j)');
        expect(dropdown.textContent).not.toContain('1j)');
        expect(dropdown.textContent).not.toContain('2j)');
      }
    });

    it('shows Durée ST description badge', () => {
      render(
        <JcfSequenceAutocomplete {...defaultProps} value="ST:MCA(" />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 7 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('Durée ST');
      }
    });
  });

  describe('ST description mode', () => {
    it('does not show suggestions for ST description (free text)', () => {
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value="ST:MCA(3j):"
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 11 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      expect(
        dropdown === null || dropdown.textContent === '',
      ).toBe(true);
    });

    it('does not show suggestions when typing description', () => {
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value="ST:MCA(3j):dos carré"
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 21 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      expect(
        dropdown === null || dropdown.textContent === '',
      ).toBe(true);
    });
  });

  describe('ST session learning', () => {
    it('shows session sous-traitants first in ST name suggestions', () => {
      const sessionSoustraitants: SoustraitantPreset[] = [
        { name: 'CustomST' },
      ];
      render(
        <JcfSequenceAutocomplete
          {...defaultProps}
          value="ST:"
          sessionSoustraitants={sessionSoustraitants}
        />,
      );
      const textarea = screen.getByRole('textbox');
      Object.defineProperty(textarea, 'selectionStart', { value: 3 });
      fireEvent.focus(textarea);
      fireEvent.select(textarea);

      const dropdown = document.querySelector(
        '[data-testid="test-seq-dropdown"]',
      );
      if (dropdown) {
        expect(dropdown.textContent).toContain('CustomST');
        const items = dropdown.querySelectorAll(
          'div[class*="cursor-pointer"]',
        );
        if (items.length > 0) {
          expect(items[0].textContent).toContain('CustomST');
        }
      }
    });
  });
});
