import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfQuantiteInput } from './JcfQuantiteInput';

const defaultProps = {
  value: '1',
  onChange: vi.fn(),
  id: 'test-quantite',
  inputClassName: 'test-class',
};

describe('JcfQuantiteInput', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfQuantiteInput {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows current value', () => {
      render(<JcfQuantiteInput {...defaultProps} value="5" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('5');
    });

    it('has text-right alignment class', () => {
      render(<JcfQuantiteInput {...defaultProps} />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('text-right');
    });

    it('has inputMode numeric', () => {
      render(<JcfQuantiteInput {...defaultProps} />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('inputMode')).toBe('numeric');
    });

    it('has placeholder "1"', () => {
      render(<JcfQuantiteInput {...defaultProps} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.placeholder).toBe('1');
    });
  });

  describe('digit filtering', () => {
    it('filters non-digit characters', () => {
      const onChange = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'abc123def' } });
      expect(onChange).toHaveBeenCalledWith('123');
    });

    it('strips leading zeros', () => {
      const onChange = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '007' } });
      expect(onChange).toHaveBeenCalledWith('7');
    });

    it('keeps single zero as last digit', () => {
      const onChange = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '0' } });
      expect(onChange).toHaveBeenCalledWith('0');
    });
  });

  describe('blur behavior', () => {
    it('defaults to "1" on blur when empty', () => {
      const onChange = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} value="" onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('1');
    });

    it('defaults to "1" on blur when "0"', () => {
      const onChange = vi.fn();
      render(
        <JcfQuantiteInput {...defaultProps} value="0" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('1');
    });

    it('keeps valid value on blur', () => {
      const onChange = vi.fn();
      render(
        <JcfQuantiteInput {...defaultProps} value="5" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('arrow increment/decrement', () => {
    it('ArrowUp increments value', () => {
      const onChange = vi.fn();
      render(
        <JcfQuantiteInput {...defaultProps} value="3" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenCalledWith('4');
    });

    it('ArrowDown decrements value', () => {
      const onChange = vi.fn();
      render(
        <JcfQuantiteInput {...defaultProps} value="3" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(onChange).toHaveBeenCalledWith('2');
    });

    it('ArrowDown does not go below 1', () => {
      const onChange = vi.fn();
      render(
        <JcfQuantiteInput {...defaultProps} value="1" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ArrowUp from empty increments to 1', () => {
      const onChange = vi.fn();
      render(
        <JcfQuantiteInput {...defaultProps} value="" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenCalledWith('1');
    });
  });

  describe('navigation delegation', () => {
    it('delegates Tab to onTabOut', () => {
      const onTabOut = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} onTabOut={onTabOut} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(expect.any(Object), 'forward');
    });

    it('delegates Shift+Tab to onTabOut backward', () => {
      const onTabOut = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} onTabOut={onTabOut} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
      expect(onTabOut).toHaveBeenCalledWith(expect.any(Object), 'backward');
    });

    it('delegates Alt+ArrowDown to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(expect.any(Object), 'down');
    });

    it('delegates Alt+ArrowLeft to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(<JcfQuantiteInput {...defaultProps} onArrowNav={onArrowNav} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(expect.any(Object), 'left');
    });
  });
});
