import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/testUtils';
import { JcfJobHeader } from './JcfJobHeader';

const defaultProps = {
  jobId: 'J-2026-0042',
  client: '',
  onClientChange: vi.fn(),
  template: '',
  onTemplateChange: vi.fn(),
  intitule: '',
  onIntituleChange: vi.fn(),
  quantity: '',
  onQuantityChange: vi.fn(),
  deadline: '',
  onDeadlineChange: vi.fn(),
};

describe('JcfJobHeader', () => {
  it('renders the job header container', () => {
    render(<JcfJobHeader {...defaultProps} />);
    expect(screen.getByTestId('jcf-job-header')).toBeInTheDocument();
  });

  describe('ID field', () => {
    it('displays the job ID', () => {
      render(<JcfJobHeader {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-id') as HTMLInputElement;
      expect(input.value).toBe('J-2026-0042');
    });

    it('is readonly', () => {
      render(<JcfJobHeader {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-id') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });

    it('has tabIndex -1', () => {
      render(<JcfJobHeader {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-id') as HTMLInputElement;
      expect(input.tabIndex).toBe(-1);
    });
  });

  describe('Client field', () => {
    it('renders Client label', () => {
      render(<JcfJobHeader {...defaultProps} />);
      expect(screen.getByText('Client')).toBeInTheDocument();
    });

    it('renders Client autocomplete input', () => {
      render(<JcfJobHeader {...defaultProps} />);
      expect(screen.getByTestId('jcf-field-client')).toBeInTheDocument();
    });

    it('displays provided client value', () => {
      render(<JcfJobHeader {...defaultProps} client="La Poste" />);
      const input = screen.getByTestId('jcf-field-client') as HTMLInputElement;
      expect(input.value).toBe('La Poste');
    });
  });

  describe('Template field', () => {
    it('renders Template label', () => {
      render(<JcfJobHeader {...defaultProps} />);
      expect(screen.getByText('Template')).toBeInTheDocument();
    });

    it('renders Template autocomplete input', () => {
      render(<JcfJobHeader {...defaultProps} />);
      expect(screen.getByTestId('jcf-field-template')).toBeInTheDocument();
    });

    it('has "Aucun" placeholder', () => {
      render(<JcfJobHeader {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-template') as HTMLInputElement;
      expect(input.placeholder).toBe('Aucun');
    });
  });

  describe('Intitulé field', () => {
    it('renders with provided value', () => {
      render(<JcfJobHeader {...defaultProps} intitule="Cartes de voeux" />);
      const input = screen.getByTestId('jcf-field-intitule') as HTMLInputElement;
      expect(input.value).toBe('Cartes de voeux');
    });

    it('calls onIntituleChange on input', () => {
      const onChange = vi.fn();
      render(<JcfJobHeader {...defaultProps} onIntituleChange={onChange} />);
      const input = screen.getByTestId('jcf-field-intitule');
      fireEvent.change(input, { target: { value: 'Test job' } });
      expect(onChange).toHaveBeenCalledWith('Test job');
    });
  });

  describe('Quantité field', () => {
    it('renders with provided value', () => {
      render(<JcfJobHeader {...defaultProps} quantity="500" />);
      const input = screen.getByTestId('jcf-field-quantite') as HTMLInputElement;
      expect(input.value).toBe('500');
    });

    it('calls onQuantityChange on input', () => {
      const onChange = vi.fn();
      render(<JcfJobHeader {...defaultProps} onQuantityChange={onChange} />);
      const input = screen.getByTestId('jcf-field-quantite');
      fireEvent.change(input, { target: { value: '1000' } });
      expect(onChange).toHaveBeenCalledWith('1000');
    });
  });

  describe('Deadline field', () => {
    it('renders empty placeholder', () => {
      render(<JcfJobHeader {...defaultProps} />);
      const input = screen.getByTestId('jcf-field-deadline') as HTMLInputElement;
      expect(input.placeholder).toBe('jj/mm');
    });

    it('displays ISO date in French format', () => {
      render(<JcfJobHeader {...defaultProps} deadline="2026-06-15" />);
      const input = screen.getByTestId('jcf-field-deadline') as HTMLInputElement;
      expect(input.value).toBe('15/06/2026');
    });

    it('displays raw input when not ISO format', () => {
      render(<JcfJobHeader {...defaultProps} deadline="15/06" />);
      const input = screen.getByTestId('jcf-field-deadline') as HTMLInputElement;
      expect(input.value).toBe('15/06');
    });

    it('calls onDeadlineChange on input', () => {
      const onChange = vi.fn();
      render(<JcfJobHeader {...defaultProps} onDeadlineChange={onChange} />);
      const input = screen.getByTestId('jcf-field-deadline');
      fireEvent.change(input, { target: { value: '15/06' } });
      expect(onChange).toHaveBeenCalledWith('15/06');
    });

    it('converts French date to ISO on blur', () => {
      const onChange = vi.fn();
      render(<JcfJobHeader {...defaultProps} deadline="15/06" onDeadlineChange={onChange} />);
      const input = screen.getByTestId('jcf-field-deadline');
      fireEvent.blur(input);
      const year = new Date().getFullYear();
      expect(onChange).toHaveBeenCalledWith(`${year}-06-15`);
    });

    it('does not convert invalid date on blur', () => {
      const onChange = vi.fn();
      render(<JcfJobHeader {...defaultProps} deadline="invalid" onDeadlineChange={onChange} />);
      const input = screen.getByTestId('jcf-field-deadline');
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('labels', () => {
    it('renders all field labels', () => {
      render(<JcfJobHeader {...defaultProps} />);
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Client')).toBeInTheDocument();
      expect(screen.getByText('Template')).toBeInTheDocument();
      expect(screen.getByText('Intitulé')).toBeInTheDocument();
      expect(screen.getByText('Quantité')).toBeInTheDocument();
      expect(screen.getByText('Deadline')).toBeInTheDocument();
    });
  });
});
