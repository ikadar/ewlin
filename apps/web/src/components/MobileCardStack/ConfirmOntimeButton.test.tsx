import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ConfirmOntimeButton } from './ConfirmOntimeButton';

describe('ConfirmOntimeButton', () => {
  it('renders the button text', () => {
    const { getByTestId } = render(<ConfirmOntimeButton onClick={() => {}} />);
    const btn = getByTestId('mobile-confirm-ontime');
    expect(btn.textContent).toContain('Je confirme');
  });

  it('calls onClick when clicked', () => {
    const fn = vi.fn();
    const { getByTestId } = render(<ConfirmOntimeButton onClick={fn} />);
    fireEvent.click(getByTestId('mobile-confirm-ontime'));
    expect(fn).toHaveBeenCalledOnce();
  });
});
