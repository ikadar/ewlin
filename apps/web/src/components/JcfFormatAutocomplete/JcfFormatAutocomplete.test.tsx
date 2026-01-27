import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfFormatAutocomplete } from './JcfFormatAutocomplete';
import type { ProductFormat } from '@flux/types';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const formats: ProductFormat[] = [
  { id: 'a3', name: 'A3', width: 297, height: 420 },
  { id: 'a4', name: 'A4', width: 210, height: 297 },
  { id: 'a5', name: 'A5', width: 148, height: 210 },
];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  formats,
  id: 'test-format',
};

describe('JcfFormatAutocomplete', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfFormatAutocomplete {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows empty string when value is empty', () => {
      render(<JcfFormatAutocomplete {...defaultProps} value="" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('shows pretty format when not focused', () => {
      render(<JcfFormatAutocomplete {...defaultProps} value="A4" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('A4 — 210×297mm');
    });
  });

  describe('focus/blur behavior', () => {
    it('shows DSL value when focused', () => {
      render(<JcfFormatAutocomplete {...defaultProps} value="A4" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('A4');
    });

    it('normalizes value on blur', () => {
      const onChange = vi.fn();
      render(
        <JcfFormatAutocomplete {...defaultProps} value="" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'a4' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('A4');
    });

    it('clears value when blur with empty input', () => {
      const onChange = vi.fn();
      render(
        <JcfFormatAutocomplete {...defaultProps} value="A4" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('suggestions', () => {
    it('shows format suggestions on focus', () => {
      render(<JcfFormatAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('A3')).toBeInTheDocument();
      expect(screen.getByText('A4')).toBeInTheDocument();
      expect(screen.getByText('A5')).toBeInTheDocument();
    });

    it('shows dimension badges in suggestions', () => {
      render(<JcfFormatAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('210×297mm')).toBeInTheDocument();
    });

    it('merges session presets with priority', () => {
      const sessionPresets: ProductFormat[] = [
        { id: 'session-b4', name: 'B4', width: 250, height: 353 },
      ];
      render(
        <JcfFormatAutocomplete
          {...defaultProps}
          sessionPresets={sessionPresets}
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('B4')).toBeInTheDocument();
    });
  });

  describe('session learning', () => {
    it('learns a new format preset on blur', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfFormatAutocomplete
          {...defaultProps}
          value=""
          onLearnPreset={onLearnPreset}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '300x400' } });
      fireEvent.blur(input);
      expect(onLearnPreset).toHaveBeenCalledWith({
        id: 'session-300x400',
        name: '300x400',
        width: 300,
        height: 400,
      });
    });

    it('does not learn an already known format', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfFormatAutocomplete
          {...defaultProps}
          value=""
          onLearnPreset={onLearnPreset}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'A4' } });
      fireEvent.blur(input);
      expect(onLearnPreset).not.toHaveBeenCalled();
    });

    it('does not learn an invalid format', () => {
      const onLearnPreset = vi.fn();
      render(
        <JcfFormatAutocomplete
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
        <JcfFormatAutocomplete {...defaultProps} onTabOut={onTabOut} />,
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
        <JcfFormatAutocomplete {...defaultProps} onTabOut={onTabOut} />,
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
        <JcfFormatAutocomplete {...defaultProps} onArrowNav={onArrowNav} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.any(Object),
        'down',
      );
    });

    it('delegates Alt+ArrowRight to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(
        <JcfFormatAutocomplete {...defaultProps} onArrowNav={onArrowNav} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowRight', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(
        expect.any(Object),
        'right',
      );
    });
  });
});
