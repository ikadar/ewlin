import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfPaginationInput } from './JcfPaginationInput';

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  id: 'test-pagination',
  inputClassName: 'test-class',
};

describe('JcfPaginationInput', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfPaginationInput {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows current value', () => {
      render(<JcfPaginationInput {...defaultProps} value="8" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('8');
    });

    it('has text-right alignment class', () => {
      render(<JcfPaginationInput {...defaultProps} />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('text-right');
    });

    it('has inputMode numeric', () => {
      render(<JcfPaginationInput {...defaultProps} />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('inputMode')).toBe('numeric');
    });
  });

  describe('digit filtering', () => {
    it('filters non-digit characters', () => {
      const onChange = vi.fn();
      render(<JcfPaginationInput {...defaultProps} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'abc8' } });
      expect(onChange).toHaveBeenCalledWith('8');
    });

    it('strips leading zeros', () => {
      const onChange = vi.fn();
      render(<JcfPaginationInput {...defaultProps} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '008' } });
      expect(onChange).toHaveBeenCalledWith('8');
    });

    it('allows clearing to empty value', () => {
      const onChange = vi.fn();
      render(
        <JcfPaginationInput {...defaultProps} value="8" onChange={onChange} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('validation visual feedback', () => {
    it('shows normal border for empty value', () => {
      render(<JcfPaginationInput {...defaultProps} value="" />);
      const input = screen.getByRole('textbox');
      expect(input.className).not.toContain('border-red-500');
    });

    it('shows normal border for valid value "2"', () => {
      render(<JcfPaginationInput {...defaultProps} value="2" />);
      const input = screen.getByRole('textbox');
      expect(input.className).not.toContain('border-red-500');
    });

    it('shows normal border for valid value "8"', () => {
      render(<JcfPaginationInput {...defaultProps} value="8" />);
      const input = screen.getByRole('textbox');
      expect(input.className).not.toContain('border-red-500');
    });

    it('shows normal border for valid value "16"', () => {
      render(<JcfPaginationInput {...defaultProps} value="16" />);
      const input = screen.getByRole('textbox');
      expect(input.className).not.toContain('border-red-500');
    });

    it('shows red border for invalid value "1"', () => {
      render(<JcfPaginationInput {...defaultProps} value="1" />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('border-red-500');
    });

    it('shows red border for invalid value "3"', () => {
      render(<JcfPaginationInput {...defaultProps} value="3" />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('border-red-500');
    });

    it('shows red border for invalid value "5"', () => {
      render(<JcfPaginationInput {...defaultProps} value="5" />);
      const input = screen.getByRole('textbox');
      expect(input.className).toContain('border-red-500');
    });

    it('sets data-invalid attribute when invalid', () => {
      render(<JcfPaginationInput {...defaultProps} value="3" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('data-invalid')).toBe('true');
    });

    it('does not set data-invalid when valid', () => {
      render(<JcfPaginationInput {...defaultProps} value="4" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('data-invalid')).toBeNull();
    });
  });

  describe('navigation delegation', () => {
    it('delegates Tab to onTabOut', () => {
      const onTabOut = vi.fn();
      render(<JcfPaginationInput {...defaultProps} onTabOut={onTabOut} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(expect.any(Object), 'forward');
    });

    it('delegates Shift+Tab to onTabOut backward', () => {
      const onTabOut = vi.fn();
      render(<JcfPaginationInput {...defaultProps} onTabOut={onTabOut} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
      expect(onTabOut).toHaveBeenCalledWith(expect.any(Object), 'backward');
    });

    it('delegates Alt+ArrowDown to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(
        <JcfPaginationInput {...defaultProps} onArrowNav={onArrowNav} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(expect.any(Object), 'down');
    });

    it('delegates Alt+ArrowLeft to onArrowNav', () => {
      const onArrowNav = vi.fn();
      render(
        <JcfPaginationInput {...defaultProps} onArrowNav={onArrowNav} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'ArrowLeft', altKey: true });
      expect(onArrowNav).toHaveBeenCalledWith(expect.any(Object), 'left');
    });
  });
});
