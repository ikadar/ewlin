import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JcfPrecedencesAutocomplete } from './JcfPrecedencesAutocomplete';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const elementNames = ['ELT', 'COUV', 'INT', 'ENCART'];

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  elementNames,
  currentElementName: 'ELT',
  id: 'test-prec',
};

describe('JcfPrecedencesAutocomplete', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<JcfPrecedencesAutocomplete {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows empty string when value is empty', () => {
      render(<JcfPrecedencesAutocomplete {...defaultProps} value="" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('shows existing value', () => {
      render(
        <JcfPrecedencesAutocomplete {...defaultProps} value="COUV,INT" />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('COUV,INT');
    });
  });

  describe('suggestions', () => {
    it('shows other element names on focus (excludes self)', () => {
      render(<JcfPrecedencesAutocomplete {...defaultProps} />);
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = screen.getByTestId('test-prec-dropdown');
      expect(dropdown.textContent).toContain('COUV');
      expect(dropdown.textContent).toContain('INT');
      expect(dropdown.textContent).toContain('ENCART');
      // Self-reference excluded
      expect(dropdown.textContent).not.toContain('ELT');
    });

    it('excludes already-selected elements', () => {
      // Trailing comma means "COUV" is committed, now starting new selection
      render(
        <JcfPrecedencesAutocomplete {...defaultProps} value="COUV," />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = screen.getByTestId('test-prec-dropdown');
      expect(dropdown.textContent).not.toContain('COUV');
      expect(dropdown.textContent).toContain('INT');
      expect(dropdown.textContent).toContain('ENCART');
    });

    it('filters by text after last comma', () => {
      render(
        <JcfPrecedencesAutocomplete {...defaultProps} value="COUV,IN" />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = screen.getByTestId('test-prec-dropdown');
      expect(dropdown.textContent).toContain('INT');
      expect(dropdown.textContent).not.toContain('ENCART');
    });

    it('shows empty state when no suggestions match', () => {
      render(
        <JcfPrecedencesAutocomplete
          {...defaultProps}
          value="COUV,INT,ENCART"
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = screen.getByTestId('test-prec-dropdown');
      expect(dropdown.textContent).toContain('Aucun');
    });

    it('shows empty state when all elements selected', () => {
      // Only self remains (excluded), so nothing to suggest
      render(
        <JcfPrecedencesAutocomplete
          {...defaultProps}
          elementNames={['ELT', 'COUV']}
          currentElementName="ELT"
          value="COUV"
        />,
      );
      fireEvent.focus(screen.getByRole('textbox'));
      const dropdown = screen.getByTestId('test-prec-dropdown');
      expect(dropdown.textContent).toContain('Aucun');
    });
  });

  describe('selection', () => {
    it('selects a name and calls onChange', () => {
      const onChange = vi.fn();
      render(
        <JcfPrecedencesAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      // Click first suggestion (COUV — first non-self name)
      const dropdown = screen.getByTestId('test-prec-dropdown');
      const firstItem = dropdown.querySelector('button');
      fireEvent.mouseDown(firstItem!);
      expect(onChange).toHaveBeenCalledWith('COUV');
    });

    it('appends second selection after comma', () => {
      const onChange = vi.fn();
      render(
        <JcfPrecedencesAutocomplete
          {...defaultProps}
          value="COUV,"
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      // INT should be available (COUV already selected)
      const dropdown = screen.getByTestId('test-prec-dropdown');
      const firstItem = dropdown.querySelector('button');
      fireEvent.mouseDown(firstItem!);
      expect(onChange).toHaveBeenCalledWith('COUV,INT');
    });

    it('replaces partial text after comma on selection', () => {
      const onChange = vi.fn();
      render(
        <JcfPrecedencesAutocomplete
          {...defaultProps}
          value="COUV,EN"
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      // ENCART should match "EN"
      const dropdown = screen.getByTestId('test-prec-dropdown');
      const firstItem = dropdown.querySelector('button');
      fireEvent.mouseDown(firstItem!);
      expect(onChange).toHaveBeenCalledWith('COUV,ENCART');
    });
  });

  describe('navigation delegation', () => {
    it('delegates Tab to onTabOut', () => {
      const onTabOut = vi.fn();
      render(
        <JcfPrecedencesAutocomplete {...defaultProps} onTabOut={onTabOut} />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onTabOut).toHaveBeenCalledWith(expect.any(Object), 'forward');
    });

    it('delegates Shift+Tab to onTabOut backward', () => {
      const onTabOut = vi.fn();
      render(
        <JcfPrecedencesAutocomplete {...defaultProps} onTabOut={onTabOut} />,
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
        <JcfPrecedencesAutocomplete
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
  });

  describe('keyboard navigation', () => {
    it('opens dropdown on ArrowDown when closed', () => {
      render(<JcfPrecedencesAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(
        screen.queryByTestId('test-prec-dropdown'),
      ).not.toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByTestId('test-prec-dropdown')).toBeInTheDocument();
    });

    it('closes dropdown on Escape', () => {
      render(<JcfPrecedencesAutocomplete {...defaultProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(screen.getByTestId('test-prec-dropdown')).toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(
        screen.queryByTestId('test-prec-dropdown'),
      ).not.toBeInTheDocument();
    });

    it('Enter selects highlighted item', () => {
      const onChange = vi.fn();
      render(
        <JcfPrecedencesAutocomplete
          {...defaultProps}
          value=""
          onChange={onChange}
        />,
      );
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith('COUV');
    });
  });
});
