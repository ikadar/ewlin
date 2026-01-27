import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfAutocomplete } from './JcfAutocomplete';
import type { Suggestion } from './JcfAutocomplete';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const suggestions: Suggestion[] = [
  { label: 'Imprimerie Léon', value: 'Imprimerie Léon' },
  { label: 'Éditions Gallimard', value: 'Éditions Gallimard' },
  { label: 'Hachette Livre', value: 'Hachette Livre' },
  { label: 'Publicis France', value: 'Publicis France', category: 'premium' },
  { label: 'La Poste', value: 'La Poste' },
];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  suggestions,
  id: 'test-autocomplete',
};

describe('JcfAutocomplete', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      expect(screen.getByTestId('jcf-field-test-autocomplete')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<JcfAutocomplete {...defaultProps} placeholder="Search..." />);
      const input = screen.getByTestId('jcf-field-test-autocomplete') as HTMLInputElement;
      expect(input.placeholder).toBe('Search...');
    });

    it('shows dropdown on focus', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
    });

    it('does not show dropdown when closed', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('shows all suggestions when input is empty', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      const dropdown = screen.getByTestId('test-autocomplete-dropdown');
      expect(dropdown).toHaveTextContent('Imprimerie Léon');
      expect(dropdown).toHaveTextContent('Hachette Livre');
      expect(dropdown).toHaveTextContent('La Poste');
    });

    it('filters suggestions based on input value', () => {
      render(<JcfAutocomplete {...defaultProps} value="poste" />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      const dropdown = screen.getByTestId('test-autocomplete-dropdown');
      expect(dropdown).toHaveTextContent('La Poste');
      // Only 1 item should match
      expect(dropdown.children).toHaveLength(1);
    });

    it('filters case-insensitively', () => {
      render(<JcfAutocomplete {...defaultProps} value="HACHETTE" />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      const dropdown = screen.getByTestId('test-autocomplete-dropdown');
      expect(dropdown).toHaveTextContent('Hachette Livre');
    });

    it('shows no dropdown when no matches', () => {
      render(<JcfAutocomplete {...defaultProps} value="zzzzz" />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('opens dropdown on ArrowDown when closed', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
    });

    it('opens dropdown on ArrowUp when closed', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
    });

    it('navigates down with ArrowDown', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      // First item highlighted by default (index 0)
      // ArrowDown moves to index 1
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      const items = screen.getByTestId('test-autocomplete-dropdown').children;
      expect(items[1]).toHaveClass('bg-blue-600');
    });

    it('navigates up with ArrowUp', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      // Move down first, then up
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      const items = screen.getByTestId('test-autocomplete-dropdown').children;
      expect(items[0]).toHaveClass('bg-blue-600');
    });

    it('does not go below last item', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      }
      const items = screen.getByTestId('test-autocomplete-dropdown').children;
      // Last item (index 4) should be highlighted
      expect(items[4]).toHaveClass('bg-blue-600');
    });

    it('does not go above first item', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      const items = screen.getByTestId('test-autocomplete-dropdown').children;
      expect(items[0]).toHaveClass('bg-blue-600');
    });
  });

  describe('selection', () => {
    it('selects item on Enter', () => {
      const onChange = vi.fn();
      const onSelect = vi.fn();
      render(
        <JcfAutocomplete {...defaultProps} onChange={onChange} onSelect={onSelect} />
      );
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith('Imprimerie Léon');
      expect(onSelect).toHaveBeenCalledWith('Imprimerie Léon');
    });

    it('selects item on mouse click', () => {
      const onChange = vi.fn();
      const onSelect = vi.fn();
      render(
        <JcfAutocomplete {...defaultProps} onChange={onChange} onSelect={onSelect} />
      );
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      fireEvent.mouseDown(screen.getByText('Hachette Livre'));
      expect(onChange).toHaveBeenCalledWith('Hachette Livre');
      expect(onSelect).toHaveBeenCalledWith('Hachette Livre');
    });

    it('closes dropdown after selection', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('escape handling', () => {
    it('closes dropdown on Escape', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
    });

    it('closes dropdown on Tab', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('click outside', () => {
    it('closes dropdown on click outside', () => {
      render(
        <div>
          <JcfAutocomplete {...defaultProps} />
          <button data-testid="outside">Outside</button>
        </div>
      );
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('category badges', () => {
    it('displays category badge when present', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      expect(screen.getByText('premium')).toBeInTheDocument();
    });

    it('does not display badge when no category', () => {
      const simpleItems: Suggestion[] = [{ label: 'Item A', value: 'a' }];
      render(<JcfAutocomplete {...defaultProps} suggestions={simpleItems} />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      expect(screen.getByText('Item A')).toBeInTheDocument();
    });
  });

  describe('mouse hover', () => {
    it('highlights item on mouse enter', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByTestId('jcf-field-test-autocomplete'));
      const items = screen.getByTestId('test-autocomplete-dropdown').children;
      fireEvent.mouseEnter(items[2]);
      expect(items[2]).toHaveClass('bg-blue-600');
      expect(items[0]).not.toHaveClass('bg-blue-600');
    });
  });

  describe('onChange callback', () => {
    it('calls onChange when typing', () => {
      const onChange = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onChange={onChange} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalledWith('test');
    });
  });

  describe('onBlur callback', () => {
    it('calls onBlur when input loses focus', () => {
      const onBlur = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onBlur={onBlur} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('table navigation delegation', () => {
    it('Tab calls onTabOut with direction forward', () => {
      const onTabOut = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onTabOut={onTabOut} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Tab' }),
        'forward',
      );
    });

    it('Shift+Tab calls onTabOut with direction backward', () => {
      const onTabOut = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onTabOut={onTabOut} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
      expect(onTabOut).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Tab' }),
        'backward',
      );
    });

    it('Tab without onTabOut behaves as before (native Tab)', () => {
      render(<JcfAutocomplete {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      input.dispatchEvent(event);
      // Without onTabOut, preventDefault should NOT be called (native Tab)
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('Tab closes dropdown before calling onTabOut', () => {
      const onTabOut = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onTabOut={onTabOut} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
      expect(onTabOut).toHaveBeenCalled();
    });

    it('Alt+ArrowDown calls onArrowNav with direction down', () => {
      const onArrowNav = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'ArrowDown' }),
        'down',
      );
    });

    it('Alt+ArrowUp calls onArrowNav with direction up', () => {
      const onArrowNav = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'ArrowUp' }),
        'up',
      );
    });

    it('Alt+ArrowRight calls onArrowNav with direction right', () => {
      const onArrowNav = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'ArrowRight', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'ArrowRight' }),
        'right',
      );
    });

    it('Alt+ArrowLeft calls onArrowNav with direction left', () => {
      const onArrowNav = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'ArrowLeft' }),
        'left',
      );
    });

    it('Alt+Arrow closes dropdown before calling onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete-dropdown')).toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
      expect(onArrowNav).toHaveBeenCalled();
    });

    it('plain ArrowDown still navigates dropdown (not delegated)', () => {
      const onArrowNav = vi.fn();
      render(<JcfAutocomplete {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      // Should navigate dropdown, NOT call onArrowNav
      expect(onArrowNav).not.toHaveBeenCalled();
      const items = screen.getByTestId('test-autocomplete-dropdown').children;
      expect(items[1]).toHaveClass('bg-blue-600');
    });

    it('existing Enter and Escape behavior unchanged with delegation props', () => {
      const onTabOut = vi.fn();
      const onArrowNav = vi.fn();
      const onChange = vi.fn();
      render(
        <JcfAutocomplete
          {...defaultProps}
          onChange={onChange}
          onTabOut={onTabOut}
          onArrowNav={onArrowNav}
        />,
      );
      const input = screen.getByTestId('jcf-field-test-autocomplete');
      fireEvent.focus(input);
      // Enter selects item
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith('Imprimerie Léon');
      // Reopen
      fireEvent.focus(input);
      // Escape closes dropdown
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByTestId('test-autocomplete-dropdown')).not.toBeInTheDocument();
    });
  });
});
