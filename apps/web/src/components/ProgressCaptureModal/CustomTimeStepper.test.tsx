import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomTimeStepper } from './CustomTimeStepper';

const baseProps = {
  currentTimeMin: 720,    // 12h00
  lowerBoundMin: 645,     // 10h45
};

describe('CustomTimeStepper', () => {
  it('renders the field with the formatted current time', () => {
    render(<CustomTimeStepper {...baseProps} onChange={() => {}} />);
    const input = screen.getByTestId('pm-custom-input') as HTMLInputElement;
    expect(input.value).toBe('12h00');
  });

  it('decrements by 15 when the minus button is clicked', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper {...baseProps} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('pm-custom-minus'));
    expect(onChange).toHaveBeenCalledWith(705);
  });

  it('increments by 15 when the plus button is clicked', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper {...baseProps} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('pm-custom-plus'));
    expect(onChange).toHaveBeenCalledWith(735);
  });

  it('clamps the minus button to lowerBoundMin', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper currentTimeMin={650} lowerBoundMin={645} onChange={onChange} />);
    // 650 − 15 = 635 < 645 → clamp to 645
    fireEvent.click(screen.getByTestId('pm-custom-minus'));
    expect(onChange).toHaveBeenCalledWith(645);
  });

  it('commits a typed value on blur (snapped to 15 min)', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper {...baseProps} onChange={onChange} />);
    const input = screen.getByTestId('pm-custom-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12h17' } });
    fireEvent.blur(input);
    // 12h17 → 737 → snapped to 735 (12h15)
    expect(onChange).toHaveBeenCalledWith(735);
  });

  it('reverts to the canonical value on invalid input', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper {...baseProps} onChange={onChange} />);
    const input = screen.getByTestId('pm-custom-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'gibberish' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('12h00');
  });

  it('accepts both "HhMM" and "HH:MM" formats', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper {...baseProps} onChange={onChange} />);
    const input = screen.getByTestId('pm-custom-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '13:30' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(810);
  });

  it('blurs on Enter (committing the value)', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper {...baseProps} onChange={onChange} />);
    const input = screen.getByTestId('pm-custom-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12h45' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Enter triggers blur which triggers commit
    expect(onChange).toHaveBeenCalledWith(765);
  });

  it('reverts on Escape without firing onChange', () => {
    const onChange = vi.fn();
    render(<CustomTimeStepper {...baseProps} onChange={onChange} />);
    const input = screen.getByTestId('pm-custom-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '13h00' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('12h00');
  });
});
