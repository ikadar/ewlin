import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfImpositionAutocomplete } from './JcfImpositionAutocomplete';
import type { FeuilleFormat } from '@flux/types';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const feuilleFormats: FeuilleFormat[] = [
  { format: '50x70', poses: [1, 2, 4, 8, 16] },
  { format: '65x90', poses: [1, 2, 4, 8, 16, 32] },
  { format: '70x100', poses: [1, 2, 4, 8] },
];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  feuilleFormats,
  id: 'test-imposition',
};

describe('JcfImpositionAutocomplete', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows empty string when value is empty', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} value="" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('shows pretty format when not focused', () => {
      render(
        <JcfImpositionAutocomplete {...defaultProps} value="50x70(8)" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('50x70cm 8poses/f');
    });

    it('shows value as-is when invalid DSL', () => {
      render(
        <JcfImpositionAutocomplete {...defaultProps} value="50x70" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('50x70');
    });
  });

  describe('focus/blur behavior', () => {
    it('shows DSL value when focused', () => {
      render(
        <JcfImpositionAutocomplete {...defaultProps} value="50x70(8)" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('50x70(8)');
    });

    it('converts pretty back to DSL on focus', () => {
      render(
        <JcfImpositionAutocomplete {...defaultProps} value="65x90(16)" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.value).toBe('65x90(16)');
    });

    it('stores DSL value on blur', () => {
      const onChange = vi.fn();
      render(
        <JcfImpositionAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '50x70(8)' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith('50x70(8)');
    });

    it('clears value when blur with empty input', () => {
      const onChange = vi.fn();
      render(
        <JcfImpositionAutocomplete
          {...defaultProps}
          value="50x70(8)"
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
    it('shows format suggestions on focus', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('50x70')).toBeInTheDocument();
      expect(screen.getByText('65x90')).toBeInTheDocument();
      expect(screen.getByText('70x100')).toBeInTheDocument();
    });

    it('filters format suggestions by input', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '50' } });
      const dropdown = screen.getByTestId('test-imposition-dropdown');
      expect(dropdown.textContent).toContain('50x70');
      expect(dropdown.textContent).not.toContain('65x90');
      expect(dropdown.textContent).not.toContain('70x100');
    });

    it('shows poses suggestions after typing opening paren', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '50x70(' } });
      const dropdown = screen.getByTestId('test-imposition-dropdown');
      expect(dropdown.textContent).toContain('1)');
      expect(dropdown.textContent).toContain('2)');
      expect(dropdown.textContent).toContain('4)');
      expect(dropdown.textContent).toContain('8)');
      expect(dropdown.textContent).toContain('16)');
    });

    it('filters poses suggestions by input', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '65x90(16' } });
      const dropdown = screen.getByTestId('test-imposition-dropdown');
      expect(dropdown.textContent).toContain('16)');
      expect(dropdown.textContent).not.toContain('2)');
      expect(dropdown.textContent).not.toContain('4)');
    });

    it('shows no poses suggestions for unknown format', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '99x99(' } });
      expect(
        screen.queryByTestId('test-imposition-dropdown'),
      ).not.toBeInTheDocument();
    });
  });

  describe('session learning', () => {
    it('learns a new format on blur', () => {
      const onLearnFormat = vi.fn();
      render(
        <JcfImpositionAutocomplete
          {...defaultProps}
          value=""
          onLearnFormat={onLearnFormat}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '40x60(4)' } });
      fireEvent.blur(input);
      expect(onLearnFormat).toHaveBeenCalledWith({
        format: '40x60',
        poses: [4],
      });
    });

    it('learns a new poses for existing format', () => {
      const onLearnFormat = vi.fn();
      render(
        <JcfImpositionAutocomplete
          {...defaultProps}
          value=""
          onLearnFormat={onLearnFormat}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '50x70(64)' } });
      fireEvent.blur(input);
      expect(onLearnFormat).toHaveBeenCalledWith({
        format: '50x70',
        poses: [1, 2, 4, 8, 16, 64],
      });
    });

    it('does not learn an already known poses', () => {
      const onLearnFormat = vi.fn();
      render(
        <JcfImpositionAutocomplete
          {...defaultProps}
          value=""
          onLearnFormat={onLearnFormat}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '50x70(8)' } });
      fireEvent.blur(input);
      expect(onLearnFormat).not.toHaveBeenCalled();
    });

    it('does not learn an invalid value', () => {
      const onLearnFormat = vi.fn();
      render(
        <JcfImpositionAutocomplete
          {...defaultProps}
          value=""
          onLearnFormat={onLearnFormat}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);
      expect(onLearnFormat).not.toHaveBeenCalled();
    });

    it('merges session formats into suggestions', () => {
      const sessionFormats: FeuilleFormat[] = [
        { format: '40x60', poses: [4, 8] },
      ];
      render(
        <JcfImpositionAutocomplete
          {...defaultProps}
          sessionFormats={sessionFormats}
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      expect(screen.getByText('40x60')).toBeInTheDocument();
    });
  });

  describe('navigation delegation', () => {
    it('delegates Tab to onTabOut', () => {
      const onTabOut = vi.fn();
      render(
        <JcfImpositionAutocomplete {...defaultProps} onTabOut={onTabOut} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(expect.any(Object), 'forward');
    });

    it('delegates Shift+Tab to onTabOut backward', () => {
      const onTabOut = vi.fn();
      render(
        <JcfImpositionAutocomplete {...defaultProps} onTabOut={onTabOut} />,
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
        <JcfImpositionAutocomplete
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
        <JcfImpositionAutocomplete
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
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      // Close it first
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(
        screen.queryByTestId('test-imposition-dropdown'),
      ).not.toBeInTheDocument();
      // Open with ArrowDown
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(
        screen.getByTestId('test-imposition-dropdown'),
      ).toBeInTheDocument();
    });

    it('closes dropdown on Escape', () => {
      render(<JcfImpositionAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(
        screen.getByTestId('test-imposition-dropdown'),
      ).toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(
        screen.queryByTestId('test-imposition-dropdown'),
      ).not.toBeInTheDocument();
    });
  });
});
