import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluxDeleteConfirmDialog } from './FluxDeleteConfirmDialog';

describe('FluxDeleteConfirmDialog', () => {
  it('renders the dialog', () => {
    render(<FluxDeleteConfirmDialog onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId('flux-delete-dialog')).toBeInTheDocument();
  });

  it('shows the confirmation title', () => {
    render(<FluxDeleteConfirmDialog onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Supprimer le job ?')).toBeInTheDocument();
  });

  it('shows the irreversible warning', () => {
    render(<FluxDeleteConfirmDialog onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Cette action est irréversible.')).toBeInTheDocument();
  });

  it('clicking Annuler calls onCancel', () => {
    const onCancel = vi.fn();
    render(<FluxDeleteConfirmDialog onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flux-delete-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('clicking Supprimer calls onConfirm', () => {
    const onConfirm = vi.fn();
    render(<FluxDeleteConfirmDialog onCancel={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('flux-delete-confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('clicking backdrop calls onCancel', () => {
    const onCancel = vi.fn();
    render(<FluxDeleteConfirmDialog onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flux-delete-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('clicking inside the dialog does not call onCancel', () => {
    const onCancel = vi.fn();
    render(<FluxDeleteConfirmDialog onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flux-delete-dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
