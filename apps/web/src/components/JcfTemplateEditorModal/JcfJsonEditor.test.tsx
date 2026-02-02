import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JcfJsonEditor } from './JcfJsonEditor';

// Skip tests that require full CodeMirror functionality in jsdom
// CodeMirror requires real DOM APIs not available in jsdom
// These tests focus on basic component rendering

describe('JcfJsonEditor', () => {
  it('renders the container with test id', () => {
    render(
      <JcfJsonEditor
        value="[]"
        onChange={() => {}}
        data-testid="json-editor"
      />
    );

    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
  });

  it('applies custom className to container', () => {
    render(
      <JcfJsonEditor
        value="[]"
        onChange={() => {}}
        className="custom-class"
        data-testid="json-editor"
      />
    );

    const container = screen.getByTestId('json-editor');
    expect(container).toHaveClass('custom-class');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('flex-col');
  });

  it('renders the editor wrapper element', () => {
    render(
      <JcfJsonEditor
        value="[]"
        onChange={() => {}}
        data-testid="json-editor"
      />
    );

    const editorWrapper = screen.getByTestId('json-editor-editor');
    expect(editorWrapper).toBeInTheDocument();
    expect(editorWrapper).toHaveClass('border-zinc-700');
  });

  it('shows error styling for invalid JSON', () => {
    render(
      <JcfJsonEditor
        value="{ invalid json }"
        onChange={() => {}}
        data-testid="json-editor"
      />
    );

    // Should show error message and red border
    const editorWrapper = screen.getByTestId('json-editor-editor');
    expect(editorWrapper).toHaveClass('border-red-500');

    const errorElement = screen.getByTestId('json-editor-error');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveClass('text-red-400');
  });

  it('does not show error for valid JSON', () => {
    render(
      <JcfJsonEditor
        value='[{"name": "test"}]'
        onChange={() => {}}
        data-testid="json-editor"
      />
    );

    const editorWrapper = screen.getByTestId('json-editor-editor');
    expect(editorWrapper).toHaveClass('border-zinc-700');
    expect(editorWrapper).not.toHaveClass('border-red-500');

    expect(screen.queryByTestId('json-editor-error')).not.toBeInTheDocument();
  });

  it('does not show error for empty value', () => {
    render(
      <JcfJsonEditor
        value=""
        onChange={() => {}}
        data-testid="json-editor"
      />
    );

    expect(screen.queryByTestId('json-editor-error')).not.toBeInTheDocument();
  });
});
