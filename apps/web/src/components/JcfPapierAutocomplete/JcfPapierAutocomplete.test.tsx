import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfPapierAutocomplete } from './JcfPapierAutocomplete';
import type { PaperType } from '@flux/types';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const paperTypes: PaperType[] = [
  { id: 'couche-mat', type: 'Couché mat', grammages: [90, 135, 200] },
  { id: 'offset', type: 'Offset', grammages: [80, 100] },
  { id: 'laser', type: 'Laser', grammages: [70, 90] },
];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  paperTypes,
  id: 'test-papier',
};

describe('JcfPapierAutocomplete', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows empty string when value is empty', () => {
      render(<JcfPapierAutocomplete {...defaultProps} value="" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('shows pretty format when not focused', () => {
      render(
        <JcfPapierAutocomplete {...defaultProps} value="Couché mat:135" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Couché mat 135g');
    });

    it('shows DSL as-is when incomplete (no grammage)', () => {
      render(
        <JcfPapierAutocomplete {...defaultProps} value="Couché mat:" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Couché mat:');
    });

    it('shows value as-is when no colon present', () => {
      render(<JcfPapierAutocomplete {...defaultProps} value="Offset" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Offset');
    });
  });

  describe('focus/blur behavior', () => {
    it('shows DSL value when focused', () => {
      render(
        <JcfPapierAutocomplete {...defaultProps} value="Couché mat:135" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('Couché mat:135');
    });

    it('converts pretty back to DSL on focus', () => {
      // Value is stored as DSL, toDslPapier converts back
      render(
        <JcfPapierAutocomplete {...defaultProps} value="Offset:80" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('Offset:80');
    });

    it('stores DSL value on blur', () => {
      const onChange = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Offset:80' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('Offset:80');
    });

    it('clears value when blur with empty input', () => {
      const onChange = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          value="Offset:80"
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('two-step suggestions', () => {
    it('shows type suggestions on focus', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('Couché mat')).toBeInTheDocument();
      expect(screen.getByText('Offset')).toBeInTheDocument();
      expect(screen.getByText('Laser')).toBeInTheDocument();
    });

    it('filters type suggestions by input', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Cou' } });
      const dropdown = screen.getByTestId('test-papier-dropdown');
      expect(dropdown.textContent).toContain('Couché mat');
      expect(dropdown.textContent).not.toContain('Offset');
      expect(dropdown.textContent).not.toContain('Laser');
    });

    it('shows grammage suggestions after typing colon', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Offset:' } });
      expect(screen.getByText('80g')).toBeInTheDocument();
      expect(screen.getByText('100g')).toBeInTheDocument();
    });

    it('filters grammage suggestions by input', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Couché mat:13' } });
      const dropdown = screen.getByTestId('test-papier-dropdown');
      expect(dropdown.textContent).toContain('135g');
      expect(dropdown.textContent).not.toContain('90g');
    });

    it('shows no grammage suggestions for unknown type', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Unknown:' } });
      // Dropdown should not have suggestions
      expect(
        screen.queryByTestId('test-papier-dropdown'),
      ).not.toBeInTheDocument();
    });
  });

  describe('session learning', () => {
    it('learns a new paper type on blur', () => {
      const onLearnPaperType = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          value=""
          onLearnPaperType={onLearnPaperType}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Recyclé:120' } });
      fireEvent.blur(input);
      expect(onLearnPaperType).toHaveBeenCalledWith({
        id: 'session-recyclé',
        type: 'Recyclé',
        grammages: [120],
      });
    });

    it('learns a new grammage for existing type', () => {
      const onLearnPaperType = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          value=""
          onLearnPaperType={onLearnPaperType}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Offset:250' } });
      fireEvent.blur(input);
      expect(onLearnPaperType).toHaveBeenCalledWith({
        id: 'offset',
        type: 'Offset',
        grammages: [80, 100, 250],
      });
    });

    it('does not learn an already known grammage', () => {
      const onLearnPaperType = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          value=""
          onLearnPaperType={onLearnPaperType}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Offset:80' } });
      fireEvent.blur(input);
      expect(onLearnPaperType).not.toHaveBeenCalled();
    });

    it('does not learn an invalid value (no colon)', () => {
      const onLearnPaperType = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          value=""
          onLearnPaperType={onLearnPaperType}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);
      expect(onLearnPaperType).not.toHaveBeenCalled();
    });

    it('does not learn a value with non-numeric grammage', () => {
      const onLearnPaperType = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          value=""
          onLearnPaperType={onLearnPaperType}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Offset:abc' } });
      fireEvent.blur(input);
      expect(onLearnPaperType).not.toHaveBeenCalled();
    });

    it('merges session paper types into suggestions', () => {
      const sessionPaperTypes: PaperType[] = [
        { id: 'session-recycled', type: 'Recyclé', grammages: [120] },
      ];
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          sessionPaperTypes={sessionPaperTypes}
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('Recyclé')).toBeInTheDocument();
    });
  });

  describe('navigation delegation', () => {
    it('delegates Tab to onTabOut', () => {
      const onTabOut = vi.fn();
      render(
        <JcfPapierAutocomplete {...defaultProps} onTabOut={onTabOut} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(expect.any(Object), 'forward');
    });

    it('delegates Shift+Tab to onTabOut backward', () => {
      const onTabOut = vi.fn();
      render(
        <JcfPapierAutocomplete {...defaultProps} onTabOut={onTabOut} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
      expect(onTabOut).toHaveBeenCalledWith(
        expect.any(Object),
        'backward',
      );
    });

    it('delegates Alt+ArrowDown to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          onArrowNav={onArrowNav}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.any(Object),
        'down',
      );
    });

    it('delegates Alt+ArrowLeft to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(
        <JcfPapierAutocomplete
          {...defaultProps}
          onArrowNav={onArrowNav}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.any(Object),
        'left',
      );
    });
  });

  describe('keyboard navigation', () => {
    it('opens dropdown on ArrowDown when closed', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      // Close it first
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(
        screen.queryByTestId('test-papier-dropdown'),
      ).not.toBeInTheDocument();
      // Open with ArrowDown
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(
        screen.getByTestId('test-papier-dropdown'),
      ).toBeInTheDocument();
    });

    it('closes dropdown on Escape', () => {
      render(<JcfPapierAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(
        screen.getByTestId('test-papier-dropdown'),
      ).toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(
        screen.queryByTestId('test-papier-dropdown'),
      ).not.toBeInTheDocument();
    });
  });
});
