/**
 * Unit tests for JcfJsonEditor field detection (v0.4.40)
 */

import { describe, it, expect } from 'vitest';
import { detectFieldContext } from './fieldDetection';

describe('detectFieldContext', () => {
  describe('simple string fields', () => {
    it('detects cursor inside "name" field value', () => {
      const doc = '{"name": "COUV"}';
      // Cursor after opening quote of value: {"name": "|COUV"}
      const pos = doc.indexOf('COUV');
      expect(detectFieldContext(doc, pos)).toBe('name');
    });

    it('detects cursor inside "format" field value', () => {
      const doc = '{"format": "A4"}';
      const pos = doc.indexOf('A4');
      expect(detectFieldContext(doc, pos)).toBe('format');
    });

    it('detects cursor inside "impression" field value', () => {
      const doc = '{"impression": "Q/Q"}';
      const pos = doc.indexOf('Q/Q');
      expect(detectFieldContext(doc, pos)).toBe('impression');
    });

    it('detects cursor inside "surfacage" field value', () => {
      const doc = '{"surfacage": "mat/mat"}';
      const pos = doc.indexOf('mat/mat');
      expect(detectFieldContext(doc, pos)).toBe('surfacage');
    });

    it('detects cursor inside "papier" field value', () => {
      const doc = '{"papier": "Couché mat"}';
      const pos = doc.indexOf('Couché');
      expect(detectFieldContext(doc, pos)).toBe('papier');
    });

    it('detects cursor at empty string value', () => {
      const doc = '{"name": ""}';
      // Cursor between the two quotes: {"name": "|"}
      const pos = doc.indexOf('""') + 1;
      expect(detectFieldContext(doc, pos)).toBe('name');
    });

    it('detects cursor in middle of value', () => {
      const doc = '{"format": "A4"}';
      // Cursor in middle: {"format": "A|4"}
      const pos = doc.indexOf('A4') + 1;
      expect(detectFieldContext(doc, pos)).toBe('format');
    });
  });

  describe('non-autocompletable fields', () => {
    it('returns null for "autres" field', () => {
      const doc = '{"autres": "some text"}';
      const pos = doc.indexOf('some');
      expect(detectFieldContext(doc, pos)).toBeNull();
    });

    it('returns null for "commentaires" field', () => {
      const doc = '{"commentaires": "some comment"}';
      const pos = doc.indexOf('some');
      expect(detectFieldContext(doc, pos)).toBeNull();
    });

    it('returns null for "quantite" field', () => {
      const doc = '{"quantite": "1000"}';
      const pos = doc.indexOf('1000');
      expect(detectFieldContext(doc, pos)).toBeNull();
    });
  });

  describe('cursor outside string values', () => {
    it('returns null when cursor is in field name', () => {
      const doc = '{"name": "COUV"}';
      // Cursor in field name: {"|name": "COUV"}
      const pos = doc.indexOf('name');
      expect(detectFieldContext(doc, pos)).toBeNull();
    });

    it('returns null when cursor is after string value', () => {
      const doc = '{"name": "COUV"}';
      // Cursor after closing quote: {"name": "COUV"|}
      const pos = doc.indexOf('}');
      expect(detectFieldContext(doc, pos)).toBeNull();
    });

    it('returns null when cursor is before opening quote', () => {
      const doc = '{"name": "COUV"}';
      // Cursor before opening quote of value: {"name": |"COUV"}
      const pos = doc.indexOf(': "') + 2;
      expect(detectFieldContext(doc, pos)).toBeNull();
    });

    it('returns null for numeric values', () => {
      const doc = '{"quantite": 1000}';
      const pos = doc.indexOf('1000');
      expect(detectFieldContext(doc, pos)).toBeNull();
    });
  });

  describe('sequence array field', () => {
    it('detects cursor inside sequence array string', () => {
      const doc = '{"sequence": ["Presse offset"]}';
      const pos = doc.indexOf('Presse');
      expect(detectFieldContext(doc, pos)).toBe('sequence');
    });

    it('detects cursor in second sequence array element', () => {
      const doc = '{"sequence": ["Presse offset", "Massicot"]}';
      const pos = doc.indexOf('Massicot');
      expect(detectFieldContext(doc, pos)).toBe('sequence');
    });

    it('detects cursor in empty sequence array string', () => {
      const doc = '{"sequence": [""]}';
      // Cursor in empty string: {"sequence": ["|"]}
      const pos = doc.indexOf('[""]') + 2;
      expect(detectFieldContext(doc, pos)).toBe('sequence');
    });

    it('returns null when cursor is outside sequence array', () => {
      const doc = '{"sequence": ["Presse"], "name": "COUV"}';
      // Cursor in name field
      const pos = doc.indexOf('COUV');
      expect(detectFieldContext(doc, pos)).toBe('name');
    });
  });

  describe('multiline JSON', () => {
    it('detects field in multiline JSON', () => {
      const doc = `{
  "name": "COUV",
  "format": "A4"
}`;
      const pos = doc.indexOf('COUV');
      expect(detectFieldContext(doc, pos)).toBe('name');
    });

    it('detects format field in multiline JSON', () => {
      const doc = `{
  "name": "COUV",
  "format": "A4"
}`;
      const pos = doc.indexOf('A4');
      expect(detectFieldContext(doc, pos)).toBe('format');
    });

    it('detects sequence in multiline JSON', () => {
      const doc = `{
  "name": "COUV",
  "sequence": [
    "Presse offset",
    "Massicot"
  ]
}`;
      const pos = doc.indexOf('Massicot');
      expect(detectFieldContext(doc, pos)).toBe('sequence');
    });
  });

  describe('nested objects', () => {
    it('detects field in array of objects', () => {
      const doc = '[{"name": "COUV"}, {"name": "INT"}]';
      const pos = doc.indexOf('INT');
      expect(detectFieldContext(doc, pos)).toBe('name');
    });

    it('handles complex nested structure', () => {
      const doc = `[
  {
    "name": "COUV",
    "format": "A4",
    "sequence": ["Presse"]
  }
]`;
      expect(detectFieldContext(doc, doc.indexOf('COUV'))).toBe('name');
      expect(detectFieldContext(doc, doc.indexOf('A4'))).toBe('format');
      expect(detectFieldContext(doc, doc.indexOf('Presse'))).toBe('sequence');
    });
  });

  describe('edge cases', () => {
    it('handles empty document', () => {
      expect(detectFieldContext('', 0)).toBeNull();
    });

    it('handles cursor at start of document', () => {
      const doc = '{"name": "COUV"}';
      expect(detectFieldContext(doc, 0)).toBeNull();
    });

    it('handles cursor at end of document', () => {
      const doc = '{"name": "COUV"}';
      expect(detectFieldContext(doc, doc.length)).toBeNull();
    });

    it('handles incomplete JSON', () => {
      const doc = '{"name": "';
      // Even in incomplete JSON, we can detect the context
      expect(detectFieldContext(doc, doc.length)).toBeNull(); // No closing quote after cursor
    });

    it('handles field with special characters in value', () => {
      const doc = '{"papier": "Couché mat 135g/m²"}';
      const pos = doc.indexOf('Couché');
      expect(detectFieldContext(doc, pos)).toBe('papier');
    });
  });
});
