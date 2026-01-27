import { describe, it, expect } from 'vitest';
import { mergeWithSession } from './mergeWithSession';

interface Item {
  name: string;
  value: number;
}

const getKey = (item: Item) => item.name;

describe('mergeWithSession', () => {
  it('session items appear before base items', () => {
    const base: Item[] = [
      { name: 'Alpha', value: 1 },
      { name: 'Beta', value: 2 },
    ];
    const session: Item[] = [{ name: 'Gamma', value: 3 }];

    const result = mergeWithSession(base, session, getKey);

    expect(result).toEqual([
      { name: 'Gamma', value: 3 },
      { name: 'Alpha', value: 1 },
      { name: 'Beta', value: 2 },
    ]);
  });

  it('duplicates between session and base are removed (base copy removed)', () => {
    const base: Item[] = [
      { name: 'Alpha', value: 1 },
      { name: 'Beta', value: 2 },
    ];
    const session: Item[] = [{ name: 'Alpha', value: 99 }];

    const result = mergeWithSession(base, session, getKey);

    expect(result).toEqual([
      { name: 'Alpha', value: 99 },
      { name: 'Beta', value: 2 },
    ]);
  });

  it('key comparison is case-insensitive', () => {
    const base: Item[] = [{ name: 'ALPHA', value: 1 }];
    const session: Item[] = [{ name: 'alpha', value: 99 }];

    const result = mergeWithSession(base, session, getKey);

    expect(result).toEqual([{ name: 'alpha', value: 99 }]);
  });

  it('empty session returns base unchanged', () => {
    const base: Item[] = [
      { name: 'Alpha', value: 1 },
      { name: 'Beta', value: 2 },
    ];

    const result = mergeWithSession(base, [], getKey);

    expect(result).toBe(base); // Same reference, not copy
  });

  it('empty base returns session items', () => {
    const session: Item[] = [{ name: 'Gamma', value: 3 }];

    const result = mergeWithSession([], session, getKey);

    expect(result).toBe(session); // Same reference
  });

  it('both empty returns empty array', () => {
    const result = mergeWithSession<Item>([], [], getKey);

    expect(result).toEqual([]);
  });
});
