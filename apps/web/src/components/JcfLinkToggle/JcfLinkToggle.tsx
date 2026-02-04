import { Link2, Unlink } from 'lucide-react';

export interface JcfLinkToggleProps {
  /** Whether the field is currently linked to the previous element */
  isLinked: boolean;
  /** Called when the toggle is clicked */
  onToggle: () => void;
  /** Whether the toggle is disabled (e.g., first element has no previous) */
  disabled?: boolean;
  /** Optional tooltip text */
  title?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Get the default tooltip title based on state.
 */
function getDefaultTitle(disabled: boolean, isLinked: boolean): string {
  if (disabled) return 'Pas de lien possible (premier élément)';
  if (isLinked) return 'Délier de l\'élément précédent';
  return 'Lier à l\'élément précédent';
}

/**
 * Get the button className based on state.
 */
function getButtonClassName(disabled: boolean, isLinked: boolean): string {
  const base = 'p-[2px] rounded-[2px] transition-colors';
  if (disabled) return `${base} opacity-30 cursor-not-allowed`;
  if (isLinked) return `${base} text-blue-400 bg-blue-900/50 hover:bg-blue-900/70`;
  return `${base} text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800`;
}

/**
 * Toggle button for linking/unlinking a field to the previous element.
 *
 * Visual states:
 * - Linked: blue icon (Link2)
 * - Unlinked: gray icon (Unlink)
 * - Disabled: muted icon, no interaction
 *
 * @see v0.4.35 - JCF: Link Propagation
 */
export function JcfLinkToggle({
  isLinked,
  onToggle,
  disabled = false,
  title,
  'data-testid': testId,
}: JcfLinkToggleProps) {
  const Icon = isLinked ? Link2 : Unlink;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={title ?? getDefaultTitle(disabled, isLinked)}
      className={getButtonClassName(disabled, isLinked)}
      data-testid={testId}
    >
      <Icon size={12} />
    </button>
  );
}
