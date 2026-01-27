import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfImpressionAutocomplete } from './JcfImpressionAutocomplete';
import type { ImpressionPreset } from '@flux/types';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const presets: ImpressionPreset[] = [
  { id: 'q-q', value: 'Q/Q', description: 'Quadri R/V' },
  { id: 'q', value: 'Q/', description: 'Quadri recto seul' },
  { id: 'n-n', value: 'N/N', description: 'Noir R/V' },
  { id: 'n', value: 'N/', description: 'Noir recto seul' },
];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  presets,
  id: 'test-impression',
};

describe('JcfImpressionAutocomplete', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfImpressionAutocomplete {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows empty string when value is empty', () => {
      render(<JcfImpressionAutocomplete {...defaultProps} value="" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('shows pretty format when not focused', () => {
      render(<JcfImpressionAutocomplete {...defaultProps} value="Q/Q" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('quadri recto/verso');
    });

    it('shows DSL value as-is when no pretty conversion exists', () => {
      render(
        <JcfImpressionAutocomplete {...defaultProps} value="Q+V/Q+V" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Q+V/Q+V');
    });
  });

  describe('focus/blur behavior', () => {
    it('shows DSL value when focused', () => {
      render(<JcfImpressionAutocomplete {...defaultProps} value="Q/Q" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('Q/Q');
    });

    it('converts pretty back to DSL on focus', () => {
      // Value is stored as DSL, so focus should show DSL
      render(<JcfImpressionAutocomplete {...defaultProps} value="N/N" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('N/N');
    });

    it('stores DSL value on blur', () => {
      const onChange = vi.fn();
      render(
        <JcfImpressionAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Q/Q' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('Q/Q');
    });

    it('clears value when blur with empty input', () => {
      const onChange = vi.fn();
      render(
        <JcfImpressionAutocomplete
          {...defaultProps}
          value="Q/Q"
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

  describe('suggestions', () => {
    it('shows impression suggestions on focus', () => {
      render(<JcfImpressionAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('Q/Q')).toBeInTheDocument();
      expect(screen.getByText('N/N')).toBeInTheDocument();
    });

    it('shows description badges in suggestions', () => {
      render(<JcfImpressionAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('Quadri R/V')).toBeInTheDocument();
    });

    it('merges session presets with priority', () => {
      const sessionPresets: ImpressionPreset[] = [
        { id: 'session-custom', value: 'CMJN/', description: 'custom' },
      ];
      render(
        <JcfImpressionAutocomplete
          {...defaultProps}
          sessionPresets={sessionPresets}
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('CMJN/')).toBeInTheDocument();
    });
  });

  describe('session learning', () => {
    it('learns a new valid impression preset on blur', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfImpressionAutocomplete
          {...defaultProps}
          value=""
          onLearnPreset={onLearnPreset}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'CMJN/CMJN' } });
      fireEvent.blur(input);
      expect(onLearnPreset).toHaveBeenCalledWith({
        id: 'session-cmjn/cmjn',
        value: 'CMJN/CMJN',
        description: 'custom',
      });
    });

    it('does not learn an already known preset', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfImpressionAutocomplete
          {...defaultProps}
          value=""
          onLearnPreset={onLearnPreset}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Q/Q' } });
      fireEvent.blur(input);
      expect(onLearnPreset).not.toHaveBeenCalled();
    });

    it('does not learn an invalid impression (no /)', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfImpressionAutocomplete
          {...defaultProps}
          value=""
          onLearnPreset={onLearnPreset}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);
      expect(onLearnPreset).not.toHaveBeenCalled();
    });
  });

  describe('navigation delegation', () => {
    it('delegates Tab to onTabOut', () => {
      const onTabOut = vi.fn();
      render(
        <JcfImpressionAutocomplete {...defaultProps} onTabOut={onTabOut} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(
        expect.any(Object),
        'forward',
      );
    });

    it('delegates Shift+Tab to onTabOut backward', () => {
      const onTabOut = vi.fn();
      render(
        <JcfImpressionAutocomplete {...defaultProps} onTabOut={onTabOut} />,
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
        <JcfImpressionAutocomplete
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
        <JcfImpressionAutocomplete
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
});
