/**
 * Prerequisites Utility Tests
 * v0.4.32b: Scheduler Tile Blocking Visual
 * v0.4.32c: Forme Status & Date Tracking
 */

import { describe, it, expect } from 'vitest';
import type { Element } from '@flux/types';
import {
  isElementBlocked,
  isPaperReady,
  isBatReady,
  isPlatesReady,
  isFormeReady,
  getPrerequisiteBlockingInfo,
} from './prerequisites';

// Helper to create a mock element
function createElement(
  paperStatus: Element['paperStatus'],
  batStatus: Element['batStatus'],
  plateStatus: Element['plateStatus'],
  formeStatus: Element['formeStatus'] = 'none'
): Element {
  return {
    id: 'elem-test',
    jobId: 'job-test',
    suffix: 'test',
    label: 'Test Element',
    prerequisiteElementIds: [],
    taskIds: ['task-test'],
    paperStatus,
    batStatus,
    plateStatus,
    formeStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('isPaperReady', () => {
  it('returns true for "none" status', () => {
    expect(isPaperReady('none')).toBe(true);
  });

  it('returns true for "in_stock" status', () => {
    expect(isPaperReady('in_stock')).toBe(true);
  });

  it('returns true for "delivered" status', () => {
    expect(isPaperReady('delivered')).toBe(true);
  });

  it('returns false for "to_order" status', () => {
    expect(isPaperReady('to_order')).toBe(false);
  });

  it('returns false for "ordered" status', () => {
    expect(isPaperReady('ordered')).toBe(false);
  });
});

describe('isBatReady', () => {
  it('returns true for "none" status', () => {
    expect(isBatReady('none')).toBe(true);
  });

  it('returns true for "bat_approved" status', () => {
    expect(isBatReady('bat_approved')).toBe(true);
  });

  it('returns false for "waiting_files" status', () => {
    expect(isBatReady('waiting_files')).toBe(false);
  });

  it('returns false for "files_received" status', () => {
    expect(isBatReady('files_received')).toBe(false);
  });

  it('returns false for "bat_sent" status', () => {
    expect(isBatReady('bat_sent')).toBe(false);
  });
});

describe('isPlatesReady', () => {
  it('returns true for "none" status', () => {
    expect(isPlatesReady('none')).toBe(true);
  });

  it('returns true for "ready" status', () => {
    expect(isPlatesReady('ready')).toBe(true);
  });

  it('returns false for "to_make" status', () => {
    expect(isPlatesReady('to_make')).toBe(false);
  });
});

describe('isFormeReady', () => {
  it('returns true for "none" status', () => {
    expect(isFormeReady('none')).toBe(true);
  });

  it('returns true for "in_stock" status', () => {
    expect(isFormeReady('in_stock')).toBe(true);
  });

  it('returns true for "delivered" status', () => {
    expect(isFormeReady('delivered')).toBe(true);
  });

  it('returns false for "to_order" status', () => {
    expect(isFormeReady('to_order')).toBe(false);
  });

  it('returns false for "ordered" status', () => {
    expect(isFormeReady('ordered')).toBe(false);
  });
});

describe('isElementBlocked', () => {
  it('returns false when all prerequisites are ready', () => {
    const element = createElement('in_stock', 'bat_approved', 'ready');
    expect(isElementBlocked(element)).toBe(false);
  });

  it('returns false when all statuses are "none"', () => {
    const element = createElement('none', 'none', 'none');
    expect(isElementBlocked(element)).toBe(false);
  });

  it('returns true when paper is not ready', () => {
    const element = createElement('to_order', 'bat_approved', 'ready');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns true when paper is "ordered" (not yet delivered)', () => {
    const element = createElement('ordered', 'bat_approved', 'ready');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns true when BAT is not ready', () => {
    const element = createElement('in_stock', 'waiting_files', 'ready');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns true when BAT is "files_received" (not yet approved)', () => {
    const element = createElement('in_stock', 'files_received', 'ready');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns true when BAT is "bat_sent" (not yet approved)', () => {
    const element = createElement('in_stock', 'bat_sent', 'ready');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns true when plates are not ready', () => {
    const element = createElement('in_stock', 'bat_approved', 'to_make');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns true when multiple prerequisites are not ready', () => {
    const element = createElement('to_order', 'waiting_files', 'to_make');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns false for delivered paper with approved BAT and no plates', () => {
    const element = createElement('delivered', 'bat_approved', 'none');
    expect(isElementBlocked(element)).toBe(false);
  });

  it('returns true when forme is not ready', () => {
    const element = createElement('in_stock', 'bat_approved', 'ready', 'to_order');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns true when forme is "ordered" (not yet delivered)', () => {
    const element = createElement('in_stock', 'bat_approved', 'ready', 'ordered');
    expect(isElementBlocked(element)).toBe(true);
  });

  it('returns false when forme is "delivered"', () => {
    const element = createElement('in_stock', 'bat_approved', 'ready', 'delivered');
    expect(isElementBlocked(element)).toBe(false);
  });

  it('returns false when forme is "in_stock"', () => {
    const element = createElement('in_stock', 'bat_approved', 'ready', 'in_stock');
    expect(isElementBlocked(element)).toBe(false);
  });
});

describe('getPrerequisiteBlockingInfo', () => {
  it('returns correct info for ready element', () => {
    const element = createElement('in_stock', 'bat_approved', 'ready');
    const info = getPrerequisiteBlockingInfo(element);

    expect(info.isBlocked).toBe(false);
    expect(info.paper.status).toBe('in_stock');
    expect(info.paper.isReady).toBe(true);
    expect(info.bat.status).toBe('bat_approved');
    expect(info.bat.isReady).toBe(true);
    expect(info.plates.status).toBe('ready');
    expect(info.plates.isReady).toBe(true);
    expect(info.forme.status).toBe('none');
    expect(info.forme.isReady).toBe(true);
  });

  it('returns correct info for blocked element (paper)', () => {
    const element = createElement('to_order', 'bat_approved', 'ready');
    const info = getPrerequisiteBlockingInfo(element);

    expect(info.isBlocked).toBe(true);
    expect(info.paper.status).toBe('to_order');
    expect(info.paper.isReady).toBe(false);
    expect(info.bat.isReady).toBe(true);
    expect(info.plates.isReady).toBe(true);
  });

  it('returns correct info for blocked element (BAT)', () => {
    const element = createElement('in_stock', 'waiting_files', 'none');
    const info = getPrerequisiteBlockingInfo(element);

    expect(info.isBlocked).toBe(true);
    expect(info.paper.isReady).toBe(true);
    expect(info.bat.status).toBe('waiting_files');
    expect(info.bat.isReady).toBe(false);
    expect(info.plates.status).toBe('none');
    expect(info.plates.isReady).toBe(true);
  });

  it('returns correct info for blocked element (plates)', () => {
    const element = createElement('delivered', 'bat_approved', 'to_make');
    const info = getPrerequisiteBlockingInfo(element);

    expect(info.isBlocked).toBe(true);
    expect(info.paper.isReady).toBe(true);
    expect(info.bat.isReady).toBe(true);
    expect(info.plates.status).toBe('to_make');
    expect(info.plates.isReady).toBe(false);
  });

  it('returns correct info for blocked element (forme)', () => {
    const element = createElement('in_stock', 'bat_approved', 'ready', 'to_order');
    const info = getPrerequisiteBlockingInfo(element);

    expect(info.isBlocked).toBe(true);
    expect(info.paper.isReady).toBe(true);
    expect(info.bat.isReady).toBe(true);
    expect(info.plates.isReady).toBe(true);
    expect(info.forme.status).toBe('to_order');
    expect(info.forme.isReady).toBe(false);
  });
});
