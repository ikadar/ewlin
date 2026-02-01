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

  const defaultTitle = disabled
    ? 'Pas de lien possible (premier élément)'
    : isLinked
      ? 'Délier de l\'élément précédent'
      : 'Lier à l\'élément précédent';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={title ?? defaultTitle}
      className={`
        p-[2px] rounded-[2px] transition-colors
        ${disabled
          ? 'opacity-30 cursor-not-allowed'
          : isLinked
            ? 'text-blue-400 bg-blue-900/50 hover:bg-blue-900/70'
            : 'text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800'
        }
      `}
      data-testid={testId}
    >
      <Icon size={12} />
    </button>
  );
}
