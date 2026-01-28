import { describe, it, expect } from 'vitest';
import {
  parseLine,
  isSequenceLineComplete,
  isValidSequenceLine,
  isSequenceLineInvalid,
  getCurrentLineInfo,
  getWorkflowStepIndex,
  getExpectedCategories,
  DEFAULT_DURATIONS,
  DEFAULT_ST_DURATIONS,
} from './sequenceDsl';

describe('parseLine', () => {
  describe('poste step', () => {
    it('returns poste for empty string', () => {
      const result = parseLine('');
      expect(result.step).toBe('poste');
      expect(result.search).toBe('');
    });

    it('returns poste for partial text', () => {
      const result = parseLine('G3');
      expect(result.step).toBe('poste');
      expect(result.search).toBe('G3');
    });

    it('returns poste for full poste name without paren', () => {
      const result = parseLine('G37');
      expect(result.step).toBe('poste');
      expect(result.search).toBe('G37');
    });
  });

  describe('poste-duration step', () => {
    it('returns poste-duration after open paren', () => {
      const result = parseLine('G37(');
      expect(result.step).toBe('poste-duration');
      expect(result.prefix).toBe('G37(');
      expect(result.search).toBe('');
      expect(result.posteName).toBe('G37');
    });

    it('returns poste-duration with partial duration', () => {
      const result = parseLine('G37(20');
      expect(result.step).toBe('poste-duration');
      expect(result.prefix).toBe('G37(');
      expect(result.search).toBe('20');
      expect(result.posteName).toBe('G37');
    });

    it('returns poste-duration with setup+run partial', () => {
      const result = parseLine('Stahl(20+');
      expect(result.step).toBe('poste-duration');
      expect(result.search).toBe('20+');
    });
  });

  describe('st-prefix step', () => {
    it('returns st-prefix for "st"', () => {
      const result = parseLine('st');
      expect(result.step).toBe('st-prefix');
      expect(result.search).toBe('st');
    });

    it('returns st-prefix for "ST"', () => {
      const result = parseLine('ST');
      expect(result.step).toBe('st-prefix');
      expect(result.search).toBe('ST');
    });
  });

  describe('st-name step', () => {
    it('returns st-name after ST:', () => {
      const result = parseLine('ST:');
      expect(result.step).toBe('st-name');
      expect(result.prefix).toBe('ST:');
      expect(result.search).toBe('');
    });

    it('returns st-name with partial name', () => {
      const result = parseLine('ST:MC');
      expect(result.step).toBe('st-name');
      expect(result.search).toBe('MC');
    });
  });

  describe('st-duration step', () => {
    it('returns st-duration after ST:Name(', () => {
      const result = parseLine('ST:MCA(');
      expect(result.step).toBe('st-duration');
      expect(result.prefix).toBe('ST:MCA(');
      expect(result.search).toBe('');
      expect(result.stName).toBe('MCA');
    });

    it('returns st-duration with partial duration', () => {
      const result = parseLine('ST:MCA(3');
      expect(result.step).toBe('st-duration');
      expect(result.search).toBe('3');
    });
  });

  describe('st-description step', () => {
    it('returns st-description after ST:Name(duration):', () => {
      const result = parseLine('ST:MCA(3j):');
      expect(result.step).toBe('st-description');
      expect(result.prefix).toBe('ST:MCA(3j):');
      expect(result.search).toBe('');
    });

    it('returns st-description with partial description', () => {
      const result = parseLine('ST:MCA(3j):dos carré');
      expect(result.step).toBe('st-description');
      expect(result.prefix).toBe('ST:MCA(3j):');
      expect(result.search).toBe('dos carré');
    });

    it('returns st-description for full ST line', () => {
      const result = parseLine('ST:MCA(3j):dos carré collé');
      expect(result.step).toBe('st-description');
      expect(result.search).toBe('dos carré collé');
    });

    it('returns st-description with hour duration', () => {
      const result = parseLine('ST:F37(5h):pelliculage');
      expect(result.step).toBe('st-description');
      expect(result.prefix).toBe('ST:F37(5h):');
      expect(result.search).toBe('pelliculage');
    });

    it('returns st-description with plain number duration', () => {
      const result = parseLine('ST:LGI(3):reliure');
      expect(result.step).toBe('st-description');
      expect(result.prefix).toBe('ST:LGI(3):');
      expect(result.search).toBe('reliure');
    });
  });

  describe('complete step', () => {
    it('returns complete for finished poste line', () => {
      const result = parseLine('G37(20)');
      expect(result.step).toBe('complete');
    });

    it('returns complete for setup+run format', () => {
      const result = parseLine('G37(20+40)');
      expect(result.step).toBe('complete');
    });

    it('returns complete for ST line without description colon', () => {
      // ST:MCA(3j) without trailing colon is "complete" (invalid ST but has closing paren)
      const result = parseLine('ST:MCA(3j)');
      expect(result.step).toBe('complete');
    });
  });
});

describe('isSequenceLineComplete', () => {
  it('returns false for empty string', () => {
    expect(isSequenceLineComplete('')).toBe(false);
  });

  it('returns false for partial poste name', () => {
    expect(isSequenceLineComplete('G37')).toBe(false);
  });

  it('returns false for open paren without close', () => {
    expect(isSequenceLineComplete('G37(20')).toBe(false);
  });

  it('returns true for closed paren', () => {
    expect(isSequenceLineComplete('G37(20)')).toBe(true);
  });

  it('returns true for ST line with close paren', () => {
    expect(isSequenceLineComplete('ST:MCA(3j):text')).toBe(true);
  });
});

describe('isValidSequenceLine', () => {
  it('returns true for empty string', () => {
    expect(isValidSequenceLine('')).toBe(true);
  });

  it('returns true for valid poste line', () => {
    expect(isValidSequenceLine('G37(20)')).toBe(true);
  });

  it('returns true for setup+run format', () => {
    expect(isValidSequenceLine('G37(20+40)')).toBe(true);
  });

  it('returns true for valid ST line', () => {
    expect(isValidSequenceLine('ST:MCA(3j):dos carré collé')).toBe(true);
  });

  it('returns true for ST line with hours', () => {
    expect(isValidSequenceLine('ST:F37(5h):pelliculage')).toBe(true);
  });

  it('returns true for ST line with plain number', () => {
    expect(isValidSequenceLine('ST:LGI(3):reliure')).toBe(true);
  });

  it('returns false for missing parens', () => {
    expect(isValidSequenceLine('G37')).toBe(false);
  });

  it('returns false for empty parens', () => {
    expect(isValidSequenceLine('G37()')).toBe(false);
  });

  it('returns false for non-numeric duration', () => {
    expect(isValidSequenceLine('G37(abc)')).toBe(false);
  });

  it('returns false for ST line without description', () => {
    expect(isValidSequenceLine('ST:MCA(3j)')).toBe(false);
  });
});

describe('isSequenceLineInvalid', () => {
  it('returns false for empty string', () => {
    expect(isSequenceLineInvalid('')).toBe(false);
  });

  it('returns false for incomplete line (no close paren)', () => {
    expect(isSequenceLineInvalid('G37(20')).toBe(false);
  });

  it('returns false for valid complete line', () => {
    expect(isSequenceLineInvalid('G37(20)')).toBe(false);
  });

  it('returns true for invalid complete line', () => {
    expect(isSequenceLineInvalid('G37(abc)')).toBe(true);
  });

  it('returns true for empty parens', () => {
    expect(isSequenceLineInvalid('G37()')).toBe(true);
  });
});

describe('getCurrentLineInfo', () => {
  it('returns info for single-line text', () => {
    const result = getCurrentLineInfo('G37(20)', 3);
    expect(result.lineText).toBe('G37(20)');
    expect(result.partialLine).toBe('G37');
    expect(result.lineStart).toBe(0);
    expect(result.lineEnd).toBe(7);
  });

  it('returns info for first line of multi-line text', () => {
    const result = getCurrentLineInfo('G37(20)\nStahl(35)', 3);
    expect(result.lineText).toBe('G37(20)');
    expect(result.partialLine).toBe('G37');
    expect(result.lineStart).toBe(0);
    expect(result.lineEnd).toBe(7);
  });

  it('returns info for second line of multi-line text', () => {
    const text = 'G37(20)\nStahl(35)';
    const cursorPos = 11; // "Sta" on second line
    const result = getCurrentLineInfo(text, cursorPos);
    expect(result.lineText).toBe('Stahl(35)');
    expect(result.partialLine).toBe('Sta');
    expect(result.lineStart).toBe(8);
    expect(result.lineEnd).toBe(17);
  });

  it('returns info for middle line of three-line text', () => {
    const text = 'G37(20)\nStahl(35)\nH(50)';
    const cursorPos = 13; // "Stahl" on second line
    const result = getCurrentLineInfo(text, cursorPos);
    expect(result.lineText).toBe('Stahl(35)');
    expect(result.partialLine).toBe('Stahl');
    expect(result.lineStart).toBe(8);
    expect(result.lineEnd).toBe(17);
  });

  it('handles cursor at start of line', () => {
    const text = 'G37(20)\n';
    const cursorPos = 8; // Start of second line
    const result = getCurrentLineInfo(text, cursorPos);
    expect(result.partialLine).toBe('');
    expect(result.lineStart).toBe(8);
  });
});

describe('DEFAULT_DURATIONS', () => {
  it('has expected duration values', () => {
    expect(DEFAULT_DURATIONS).toContain('20');
    expect(DEFAULT_DURATIONS).toContain('30');
    expect(DEFAULT_DURATIONS).toContain('20+30');
    expect(DEFAULT_DURATIONS.length).toBe(7);
  });
});

describe('DEFAULT_ST_DURATIONS', () => {
  it('has expected ST duration values', () => {
    expect(DEFAULT_ST_DURATIONS).toContain('1j');
    expect(DEFAULT_ST_DURATIONS).toContain('3j');
    expect(DEFAULT_ST_DURATIONS).toContain('5j');
    expect(DEFAULT_ST_DURATIONS.length).toBe(5);
  });

  it('all values have day suffix', () => {
    DEFAULT_ST_DURATIONS.forEach((d) => {
      expect(d).toMatch(/^\d+j$/);
    });
  });
});

describe('getWorkflowStepIndex', () => {
  it('returns 0 for empty text', () => {
    expect(getWorkflowStepIndex('', 0)).toBe(0);
  });

  it('returns 0 for incomplete first line', () => {
    expect(getWorkflowStepIndex('G37(', 4)).toBe(0);
  });

  it('returns 1 after one complete line', () => {
    expect(getWorkflowStepIndex('G37(20)\n', 8)).toBe(1);
  });

  it('returns 1 when cursor is on second line after one complete', () => {
    expect(getWorkflowStepIndex('G37(20)\nSta', 11)).toBe(1);
  });

  it('returns 2 after two complete lines', () => {
    expect(getWorkflowStepIndex('G37(20)\nStahl(35)\n', 18)).toBe(2);
  });

  it('returns 2 when cursor is on third line', () => {
    expect(getWorkflowStepIndex('G37(20)\nStahl(35)\nH', 19)).toBe(2);
  });

  it('counts only lines with closing paren', () => {
    // First line complete, second line incomplete, cursor on second
    expect(getWorkflowStepIndex('G37(20)\nStahl(', 14)).toBe(1);
  });

  it('counts ST lines as complete', () => {
    expect(getWorkflowStepIndex('ST:MCA(3j):desc\n', 16)).toBe(1);
  });

  it('returns 0 for cursor at very start', () => {
    expect(getWorkflowStepIndex('G37(20)\nStahl(35)', 0)).toBe(0);
  });

  it('counts lines before cursor only', () => {
    // Cursor is at position 4 (middle of first line), even though full text has complete line
    expect(getWorkflowStepIndex('G37(20)\nStahl(35)', 4)).toBe(0);
  });
});

describe('getExpectedCategories', () => {
  it('returns empty array for empty workflow', () => {
    expect(getExpectedCategories([], 0)).toEqual([]);
  });

  it('returns single category for step 0', () => {
    const workflow = ['Presse offset'];
    expect(getExpectedCategories(workflow, 0)).toEqual(['Presse offset']);
  });

  it('returns correct category for step 1', () => {
    const workflow = ['Presse offset', 'Massicot'];
    expect(getExpectedCategories(workflow, 1)).toEqual(['Massicot']);
  });

  it('returns empty array when step exceeds workflow length', () => {
    const workflow = ['Presse offset'];
    expect(getExpectedCategories(workflow, 1)).toEqual([]);
  });

  it('returns empty array for negative step', () => {
    const workflow = ['Presse offset'];
    expect(getExpectedCategories(workflow, -1)).toEqual([]);
  });

  it('splits comma-separated categories', () => {
    const workflow = ['Presse offset, Presse numérique'];
    expect(getExpectedCategories(workflow, 0)).toEqual([
      'Presse offset',
      'Presse numérique',
    ]);
  });

  it('trims whitespace from comma-separated categories', () => {
    const workflow = ['Presse offset  ,  Presse numérique'];
    expect(getExpectedCategories(workflow, 0)).toEqual([
      'Presse offset',
      'Presse numérique',
    ]);
  });

  it('handles multi-step workflow with mixed categories', () => {
    const workflow = [
      'Presse offset, Presse numérique',
      'Massicot',
      'Plieuse, Conditionnement',
    ];
    expect(getExpectedCategories(workflow, 0)).toEqual([
      'Presse offset',
      'Presse numérique',
    ]);
    expect(getExpectedCategories(workflow, 1)).toEqual(['Massicot']);
    expect(getExpectedCategories(workflow, 2)).toEqual([
      'Plieuse',
      'Conditionnement',
    ]);
    expect(getExpectedCategories(workflow, 3)).toEqual([]);
  });
});
