import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HeartbeatOverlay } from './HeartbeatOverlay';

describe('HeartbeatOverlay', () => {
  it('renders nothing when not active', () => {
    const { container } = render(
      <HeartbeatOverlay timeRemainingMin={5} thresholdMin={15} active={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the pulse div when active', () => {
    const { container } = render(
      <HeartbeatOverlay timeRemainingMin={5} thresholdMin={15} active={true} />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.classList.contains('mobile-heartbeat-active')).toBe(true);
  });

  it('renders nothing when threshold is 0', () => {
    const { container } = render(
      <HeartbeatOverlay timeRemainingMin={5} thresholdMin={0} active={true} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
