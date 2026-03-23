/**
 * Layout-agnostic Alt+letter shortcut matching.
 *
 * The problem: detecting Alt+letter is hard across layouts and OSes.
 * - e.key: on macOS, Alt remaps it to special chars (Alt+A → 'å' / 'æ')
 * - e.code: physical key position, assumes QWERTY (AZERTY swaps A↔Q, W↔Z)
 * - e.keyCode: deprecated but always returns the logical key code (65 for A)
 *   regardless of layout or macOS Alt remapping. Supported in all browsers.
 *
 * We use keyCode as the primary method, with e.key as a fallback.
 */

// keyCode values for A-Z
const LETTER_KEYCODES: Record<string, number> = {
  a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72, i: 73,
  j: 74, k: 75, l: 76, m: 77, n: 78, o: 79, p: 80, q: 81, r: 82,
  s: 83, t: 84, u: 85, v: 86, w: 87, x: 88, y: 89, z: 90,
};

/**
 * Check if a keyboard event matches an Alt+<letter> shortcut,
 * regardless of QWERTY/AZERTY layout and macOS Alt remapping.
 *
 * @param e - The keyboard event
 * @param letter - The intended logical letter (e.g., 'a' for Alt+A)
 */
export function isAltLetter(e: KeyboardEvent, letter: string): boolean {
  if (!e.altKey || e.ctrlKey || e.metaKey) return false;

  const l = letter.toLowerCase();
  const expectedKeyCode = LETTER_KEYCODES[l];

  // Primary: keyCode — layout-agnostic, works even with macOS Alt remapping
  if (expectedKeyCode !== undefined && e.keyCode === expectedKeyCode) return true;

  // Fallback: logical key check (works on Linux/Windows without Alt remapping)
  if (e.key.toLowerCase() === l) return true;

  return false;
}

/**
 * Check if a keyboard event matches a Ctrl+Alt+<letter> shortcut,
 * regardless of QWERTY/AZERTY layout and macOS Alt remapping.
 *
 * @param e - The keyboard event
 * @param letter - The intended logical letter (e.g., 'z' for Ctrl+Alt+Z)
 */
export function isCtrlAltLetter(e: KeyboardEvent, letter: string): boolean {
  if (!e.altKey || !e.ctrlKey || e.metaKey) return false;

  const l = letter.toLowerCase();
  const expectedKeyCode = LETTER_KEYCODES[l];

  if (expectedKeyCode !== undefined && e.keyCode === expectedKeyCode) return true;
  if (e.key.toLowerCase() === l) return true;

  return false;
}

/**
 * No-op kept for API compatibility — detection is no longer needed
 * since keyCode is layout-agnostic.
 */
export function detectKeyboardLayout(_e: KeyboardEvent): void {
  // keyCode-based approach doesn't require layout detection
}
