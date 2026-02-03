import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/testUtils';
import { JcfTemplateHeaderForm } from './JcfTemplateHeaderForm';
import type { TemplateHeaderData } from './JcfTemplateHeaderForm';
import { resetTemplates } from '../../mock/templateApi';

describe('JcfTemplateHeaderForm', () => {
  const defaultValue: TemplateHeaderData = {
    name: '',
    description: '',
    category: '',
    clientName: '',
  };

  beforeEach(() => {
    resetTemplates();
  });

  it('renders all form fields', () => {
    const onChange = vi.fn();
    render(<JcfTemplateHeaderForm value={defaultValue} onChange={onChange} />);

    expect(screen.getByLabelText(/Nom/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Catégorie/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Client/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
  });

  it('shows required indicator on name field', () => {
    const onChange = vi.fn();
    render(<JcfTemplateHeaderForm value={defaultValue} onChange={onChange} />);

    const nameLabel = screen.getByText('Nom');
    expect(nameLabel.parentElement?.querySelector('.text-red-400')).toBeInTheDocument();
  });

  it('displays current values', () => {
    const onChange = vi.fn();
    const value: TemplateHeaderData = {
      name: 'Test Template',
      description: 'A test description',
      category: 'Brochure',
      clientName: 'Client A',
    };

    render(<JcfTemplateHeaderForm value={value} onChange={onChange} />);

    expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Brochure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Client A')).toBeInTheDocument();
  });

  it('calls onChange when name is typed', () => {
    const onChange = vi.fn();

    render(<JcfTemplateHeaderForm value={defaultValue} onChange={onChange} />);

    const nameInput = screen.getByTestId('template-field-name');
    fireEvent.change(nameInput, { target: { value: 'N' } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultValue,
      name: 'N',
    });
  });

  it('calls onChange when description is typed', () => {
    const onChange = vi.fn();

    render(<JcfTemplateHeaderForm value={defaultValue} onChange={onChange} />);

    const descInput = screen.getByTestId('template-field-description');
    fireEvent.change(descInput, { target: { value: 'D' } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultValue,
      description: 'D',
    });
  });

  it('disables inputs when disabled prop is true', () => {
    const onChange = vi.fn();
    render(
      <JcfTemplateHeaderForm value={defaultValue} onChange={onChange} disabled={true} />
    );

    const nameInput = screen.getByTestId('template-field-name');
    const descInput = screen.getByTestId('template-field-description');

    expect(nameInput).toBeDisabled();
    expect(descInput).toBeDisabled();
  });

  it('shows category suggestions from existing templates', () => {
    const onChange = vi.fn();

    render(<JcfTemplateHeaderForm value={defaultValue} onChange={onChange} />);

    const categoryInput = screen.getByLabelText(/Catégorie/);
    fireEvent.focus(categoryInput);

    // Should show existing categories from seed templates
    expect(screen.getByText('Brochure')).toBeInTheDocument();
    expect(screen.getByText('Feuillet')).toBeInTheDocument();
  });

  it('shows session-learned client suggestions', () => {
    // v0.5.5: Client suggestions from API require debounce (300ms) which makes
    // unit testing complex. This test verifies session learning still works
    // (adding new clients on blur). E2E tests cover full API flow.

    const onChange = vi.fn();

    // Start with a new client value that's not in the API
    const value: TemplateHeaderData = {
      ...defaultValue,
      clientName: 'New Client Name',
    };

    render(<JcfTemplateHeaderForm value={value} onChange={onChange} />);

    const clientInput = screen.getByLabelText(/Client/);

    // Blur to trigger session learning
    fireEvent.blur(clientInput);

    // Focus to reopen dropdown
    fireEvent.focus(clientInput);

    // New client should appear in suggestions
    expect(screen.getByText('New Client Name')).toBeInTheDocument();
  });

  describe('session learning', () => {
    it('adds new category to suggestions on blur', () => {
      const onChange = vi.fn();

      // Start with a new category value
      const value: TemplateHeaderData = {
        ...defaultValue,
        category: 'Nouvelle Catégorie',
      };

      render(<JcfTemplateHeaderForm value={value} onChange={onChange} />);

      const categoryInput = screen.getByLabelText(/Catégorie/);

      // Blur the input to trigger session learning
      fireEvent.blur(categoryInput);

      // Focus again to open dropdown
      fireEvent.focus(categoryInput);

      // New category should appear with 'nouveau' badge
      expect(screen.getByText('Nouvelle Catégorie')).toBeInTheDocument();
    });

    it('adds new client to suggestions on blur', () => {
      const onChange = vi.fn();

      // Start with a new client value
      const value: TemplateHeaderData = {
        ...defaultValue,
        clientName: 'Nouveau Client',
      };

      render(<JcfTemplateHeaderForm value={value} onChange={onChange} />);

      const clientInput = screen.getByLabelText(/Client/);

      // Blur to trigger session learning
      fireEvent.blur(clientInput);

      // Focus to reopen dropdown
      fireEvent.focus(clientInput);

      // New client should appear
      expect(screen.getByText('Nouveau Client')).toBeInTheDocument();
    });

    it('does not duplicate existing categories', () => {
      const onChange = vi.fn();

      // Use existing category name
      const value: TemplateHeaderData = {
        ...defaultValue,
        category: 'Brochure',
      };

      render(<JcfTemplateHeaderForm value={value} onChange={onChange} />);

      const categoryInput = screen.getByLabelText(/Catégorie/);
      fireEvent.blur(categoryInput);
      fireEvent.focus(categoryInput);

      // Should only show one 'Brochure', not duplicated
      const brochureItems = screen.getAllByText('Brochure');
      expect(brochureItems.length).toBe(1);
    });
  });

  it('has correct placeholders', () => {
    const onChange = vi.fn();
    render(<JcfTemplateHeaderForm value={defaultValue} onChange={onChange} />);

    expect(screen.getByPlaceholderText('Ex: Brochure piquée')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Brochures')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Universel')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        'Ex: Brochure avec couverture et intérieur, reliure agrafes'
      )
    ).toBeInTheDocument();
  });

  it('has correct test ids', () => {
    const onChange = vi.fn();
    render(<JcfTemplateHeaderForm value={defaultValue} onChange={onChange} />);

    expect(screen.getByTestId('jcf-template-header-form')).toBeInTheDocument();
    expect(screen.getByTestId('template-field-name')).toBeInTheDocument();
    expect(screen.getByTestId('template-field-description')).toBeInTheDocument();
  });
});
