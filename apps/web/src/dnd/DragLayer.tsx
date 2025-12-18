/**
 * DragLayer - Portal-based drag preview for pragmatic-drag-and-drop
 *
 * Replaces dnd-kit's DragOverlay component.
 * Uses monitorForElements to track drag position and renders
 * the DragPreview component at the cursor position.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { DragPreview } from '../components/DragPreview';
import { useDragStateValue } from './DragStateContext';

interface DragPosition {
  x: number;
  y: number;
}

/**
 * DragLayer component that renders a drag preview at the cursor position.
 * Must be placed inside DragStateProvider.
 */
export function DragLayer() {
  const { isDragging, activeTask, activeJob, grabOffset } = useDragStateValue();
  const [position, setPosition] = useState<DragPosition | null>(null);

  useEffect(() => {
    // Monitor for drag events to track cursor position
    return monitorForElements({
      onDragStart: ({ location }) => {
        setPosition({
          x: location.current.input.clientX,
          y: location.current.input.clientY,
        });
      },
      onDrag: ({ location }) => {
        setPosition({
          x: location.current.input.clientX,
          y: location.current.input.clientY,
        });
      },
      onDrop: () => {
        setPosition(null);
      },
    });
  }, []);

  // Don't render if not dragging or no task/job
  if (!isDragging || !activeTask || !activeJob || !position) {
    return null;
  }

  // Position the preview so the grab point stays under the cursor
  // We offset by grabOffset.x and grabOffset.y to maintain the visual position
  const previewStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x - grabOffset.x, // Offset so grab point X stays under cursor
    top: position.y - grabOffset.y,  // Offset so grab point Y stays under cursor
    pointerEvents: 'none',
    zIndex: 9999,
  };

  return createPortal(
    <div style={previewStyle}>
      <DragPreview task={activeTask} job={activeJob} />
    </div>,
    document.body
  );
}
