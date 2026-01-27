import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfSurfacageAutocomplete } from './JcfSurfacageAutocomplete';
import type { SurfacagePreset } from '@flux/types';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const presets: SurfacagePreset[] = [
  { id: 'mat-mat', value: 'mat/mat', description: 'Pelli mat R/V' },
  { id: 'satin-satin', value: 'satin/satin', description: 'Pelli satin R/V' },
  { id: 'uv-uv', value: 'UV/UV', description: 'Vernis UV R/V' },
  { id: 'mat', value: 'mat/', description: 'Pelli mat recto' },
];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  presets,
  id: 'test-surfacage',
};

describe('JcfSurfacageAutocomplete', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfSurfacageAutocomplete {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows empty string when value is empty', () => {
      render(<JcfSurfacageAutocomplete {...defaultProps} value="" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('shows pretty format when not focused', () => {
      render(<JcfSurfacageAutocomplete {...defaultProps} value="mat/mat" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('pelli mat recto/verso');
    });

    it('shows DSL value as-is when no pretty conversion exists', () => {
      render(
        <JcfSurfacageAutocomplete {...defaultProps} value="gaufrage/" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('gaufrage/');
    });
  });

  describe('focus/blur behavior', () => {
    it('shows DSL value when focused', () => {
      render(<JcfSurfacageAutocomplete {...defaultProps} value="mat/mat" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('mat/mat');
    });

    it('converts pretty back to DSL on focus', () => {
      render(<JcfSurfacageAutocomplete {...defaultProps} value="UV/UV" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('UV/UV');
    });

    it('stores DSL value on blur', () => {
      const onChange = vi.fn();
      render(
        <JcfSurfacageAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'mat/mat' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('mat/mat');
    });

    it('clears value when blur with empty input', () => {
      const onChange = vi.fn();
      render(
        <JcfSurfacageAutocomplete
          {...defaultProps}
          value="mat/mat"
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
    it('shows surfacage suggestions on focus', () => {
      render(<JcfSurfacageAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('mat/mat')).toBeInTheDocument();
      expect(screen.getByText('UV/UV')).toBeInTheDocument();
    });

    it('shows description badges in suggestions', () => {
      render(<JcfSurfacageAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('Pelli mat R/V')).toBeInTheDocument();
    });

    it('merges session presets with priority', () => {
      const sessionPresets: SurfacagePreset[] = [
        { id: 'session-custom', value: 'gaufrage/', description: 'custom' },
      ];
      render(
        <JcfSurfacageAutocomplete
          {...defaultProps}
          sessionPresets={sessionPresets}
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('gaufrage/')).toBeInTheDocument();
    });
  });

  describe('session learning', () => {
    it('learns a new valid surfacage preset on blur', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfSurfacageAutocomplete
          {...defaultProps}
          value=""
          onLearnPreset={onLearnPreset}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'gaufrage/gaufrage' } });
      fireEvent.blur(input);
      expect(onLearnPreset).toHaveBeenCalledWith({
        id: 'session-gaufrage/gaufrage',
        value: 'gaufrage/gaufrage',
        description: 'custom',
      });
    });

    it('does not learn an already known preset', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfSurfacageAutocomplete
          {...defaultProps}
          value=""
          onLearnPreset={onLearnPreset}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'mat/mat' } });
      fireEvent.blur(input);
      expect(onLearnPreset).not.toHaveBeenCalled();
    });

    it('does not learn an invalid surfacage (no /)', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfSurfacageAutocomplete
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
        <JcfSurfacageAutocomplete {...defaultProps} onTabOut={onTabOut} />,
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
        <JcfSurfacageAutocomplete {...defaultProps} onTabOut={onTabOut} />,
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
        <JcfSurfacageAutocomplete
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
        <JcfSurfacageAutocomplete
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
