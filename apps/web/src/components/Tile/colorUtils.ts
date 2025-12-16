/**
 * Color utilities for mapping job hex colors to Tailwind classes.
 * Since Tailwind classes are static, we need predefined mappings.
 */

export type TailwindColor =
  | 'purple'
  | 'rose'
  | 'yellow'
  | 'teal'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'pink'
  | 'orange'
  | 'violet'
  | 'lime'
  | 'fuchsia'
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'red';

interface ColorClasses {
  border: string;
  setupBg: string;
  setupBorder: string;
  runBg: string;
  text: string;
}

/**
 * Map hex color to Tailwind color name.
 * Falls back to 'purple' for unknown colors.
 */
export function hexToTailwindColor(hex: string): TailwindColor {
  const normalizedHex = hex.toUpperCase();

  const colorMap: Record<string, TailwindColor> = {
    '#8B5CF6': 'purple',
    '#A855F7': 'violet',
    '#F43F5E': 'rose',
    '#EF4444': 'red',
    '#EAB308': 'yellow',
    '#F59E0B': 'amber',
    '#F97316': 'orange',
    '#14B8A6': 'teal',
    '#22C55E': 'green',
    '#10B981': 'emerald',
    '#84CC16': 'lime',
    '#06B6D4': 'cyan',
    '#0EA5E9': 'sky',
    '#3B82F6': 'blue',
    '#6366F1': 'indigo',
    '#EC4899': 'pink',
    '#D946EF': 'fuchsia',
  };

  return colorMap[normalizedHex] || 'purple';
}

/**
 * Get Tailwind classes for a job color.
 * Returns classes for border, setup background, run background, and text.
 */
export function getColorClasses(color: TailwindColor): ColorClasses {
  const colorClassMap: Record<TailwindColor, ColorClasses> = {
    purple: {
      border: 'border-l-purple-500',
      setupBg: 'bg-purple-900/40',
      setupBorder: 'border-purple-700/30',
      runBg: 'bg-purple-950/35',
      text: 'text-purple-300',
    },
    violet: {
      border: 'border-l-violet-500',
      setupBg: 'bg-violet-900/40',
      setupBorder: 'border-violet-700/30',
      runBg: 'bg-violet-950/35',
      text: 'text-violet-300',
    },
    rose: {
      border: 'border-l-rose-500',
      setupBg: 'bg-rose-900/40',
      setupBorder: 'border-rose-700/30',
      runBg: 'bg-rose-950/35',
      text: 'text-rose-300',
    },
    red: {
      border: 'border-l-red-500',
      setupBg: 'bg-red-900/40',
      setupBorder: 'border-red-700/30',
      runBg: 'bg-red-950/35',
      text: 'text-red-300',
    },
    yellow: {
      border: 'border-l-yellow-500',
      setupBg: 'bg-yellow-900/40',
      setupBorder: 'border-yellow-700/30',
      runBg: 'bg-yellow-950/35',
      text: 'text-yellow-300',
    },
    amber: {
      border: 'border-l-amber-500',
      setupBg: 'bg-amber-900/40',
      setupBorder: 'border-amber-700/30',
      runBg: 'bg-amber-950/35',
      text: 'text-amber-300',
    },
    orange: {
      border: 'border-l-orange-500',
      setupBg: 'bg-orange-900/40',
      setupBorder: 'border-orange-700/30',
      runBg: 'bg-orange-950/35',
      text: 'text-orange-300',
    },
    teal: {
      border: 'border-l-teal-500',
      setupBg: 'bg-teal-900/40',
      setupBorder: 'border-teal-700/30',
      runBg: 'bg-teal-950/35',
      text: 'text-teal-300',
    },
    green: {
      border: 'border-l-green-500',
      setupBg: 'bg-green-900/40',
      setupBorder: 'border-green-700/30',
      runBg: 'bg-green-950/35',
      text: 'text-green-300',
    },
    emerald: {
      border: 'border-l-emerald-500',
      setupBg: 'bg-emerald-900/40',
      setupBorder: 'border-emerald-700/30',
      runBg: 'bg-emerald-950/35',
      text: 'text-emerald-300',
    },
    lime: {
      border: 'border-l-lime-500',
      setupBg: 'bg-lime-900/40',
      setupBorder: 'border-lime-700/30',
      runBg: 'bg-lime-950/35',
      text: 'text-lime-300',
    },
    cyan: {
      border: 'border-l-cyan-500',
      setupBg: 'bg-cyan-900/40',
      setupBorder: 'border-cyan-700/30',
      runBg: 'bg-cyan-950/35',
      text: 'text-cyan-300',
    },
    sky: {
      border: 'border-l-sky-500',
      setupBg: 'bg-sky-900/40',
      setupBorder: 'border-sky-700/30',
      runBg: 'bg-sky-950/35',
      text: 'text-sky-300',
    },
    blue: {
      border: 'border-l-blue-500',
      setupBg: 'bg-blue-900/40',
      setupBorder: 'border-blue-700/30',
      runBg: 'bg-blue-950/35',
      text: 'text-blue-300',
    },
    indigo: {
      border: 'border-l-indigo-500',
      setupBg: 'bg-indigo-900/40',
      setupBorder: 'border-indigo-700/30',
      runBg: 'bg-indigo-950/35',
      text: 'text-indigo-300',
    },
    pink: {
      border: 'border-l-pink-500',
      setupBg: 'bg-pink-900/40',
      setupBorder: 'border-pink-700/30',
      runBg: 'bg-pink-950/35',
      text: 'text-pink-300',
    },
    fuchsia: {
      border: 'border-l-fuchsia-500',
      setupBg: 'bg-fuchsia-900/40',
      setupBorder: 'border-fuchsia-700/30',
      runBg: 'bg-fuchsia-950/35',
      text: 'text-fuchsia-300',
    },
  };

  return colorClassMap[color];
}

/**
 * Get all color classes for a job's hex color.
 */
export function getJobColorClasses(hexColor: string): ColorClasses {
  const tailwindColor = hexToTailwindColor(hexColor);
  return getColorClasses(tailwindColor);
}
