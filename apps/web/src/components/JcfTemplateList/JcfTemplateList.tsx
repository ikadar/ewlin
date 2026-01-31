/**
 * JcfTemplateList - Sortable template table with CRUD actions
 *
 * Features:
 * - Sortable columns (name, client, category, elements count, modified date)
 * - Action buttons per row (delete, edit, use)
 * - Empty state message
 * - Relative date formatting (French)
 *
 * @see v0.4.34 - JCF: Template CRUD & Apply
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trash2, Pencil, Play } from 'lucide-react';
import type { JcfTemplate } from '@flux/types';

export interface JcfTemplateListProps {
  templates: JcfTemplate[];
  onDeleteClick?: (template: JcfTemplate) => void;
  onEditClick?: (template: JcfTemplate) => void;
  onUseClick?: (template: JcfTemplate) => void;
}

type SortColumn = 'name' | 'clientName' | 'category' | 'elementsCount' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

/**
 * Sort indicator icon component.
 */
function SortIcon({
  column,
  sortColumn,
  sortDirection,
}: {
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (sortColumn !== column) return null;
  return sortDirection === 'asc' ? (
    <ChevronUp size={14} className="inline ml-[3px]" aria-hidden="true" />
  ) : (
    <ChevronDown size={14} className="inline ml-[3px]" aria-hidden="true" />
  );
}

/**
 * Format ISO date to relative French string.
 */
function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * JcfTemplateList component - displays templates in a sortable table format.
 */
export function JcfTemplateList({
  templates,
  onDeleteClick,
  onEditClick,
  onUseClick,
}: JcfTemplateListProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'fr');
          break;
        case 'clientName':
          comparison = (a.clientName || 'zzz').localeCompare(b.clientName || 'zzz', 'fr');
          break;
        case 'category':
          comparison = (a.category || 'zzz').localeCompare(b.category || 'zzz', 'fr');
          break;
        case 'elementsCount':
          comparison = a.elements.length - b.elements.length;
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [templates, sortColumn, sortDirection]);

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection('asc');
      return column;
    });
  }, []);

  // Empty state
  if (templates.length === 0) {
    return (
      <div
        className="text-center text-zinc-500 py-[48px]"
        data-testid="template-list-empty"
      >
        <p>Aucun template trouvé</p>
        <p className="text-sm mt-[8px]">
          Pour créer un template, utilisez &quot;Enregistrer comme template&quot; depuis un job.
        </p>
      </div>
    );
  }

  // Header styles
  const thClass =
    'pb-[10px] font-medium cursor-pointer hover:text-zinc-200 transition-colors text-left';

  return (
    <table className="w-full" data-testid="template-list-table">
      <caption className="sr-only">Liste des templates</caption>
      <thead className="text-zinc-400 text-sm border-b border-zinc-800">
        <tr>
          <th
            className={`${thClass} pl-[13px]`}
            onClick={() => handleSort('name')}
            aria-sort={
              sortColumn === 'name'
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
          >
            Nom
            <SortIcon column="name" sortColumn={sortColumn} sortDirection={sortDirection} />
          </th>
          <th
            className={`${thClass} px-[13px]`}
            onClick={() => handleSort('clientName')}
            aria-sort={
              sortColumn === 'clientName'
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
          >
            Client
            <SortIcon
              column="clientName"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
            />
          </th>
          <th
            className={`${thClass} px-[13px]`}
            onClick={() => handleSort('category')}
            aria-sort={
              sortColumn === 'category'
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
          >
            Catégorie
            <SortIcon
              column="category"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
            />
          </th>
          <th
            className={`${thClass} px-[13px] text-right`}
            onClick={() => handleSort('elementsCount')}
            aria-sort={
              sortColumn === 'elementsCount'
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
          >
            Éléments
            <SortIcon
              column="elementsCount"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
            />
          </th>
          <th
            className={`${thClass} px-[13px]`}
            onClick={() => handleSort('updatedAt')}
            aria-sort={
              sortColumn === 'updatedAt'
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
          >
            Modifié
            <SortIcon
              column="updatedAt"
              sortColumn={sortColumn}
              sortDirection={sortDirection}
            />
          </th>
          <th className="pb-[10px] pr-[13px]">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedTemplates.map((template) => (
          <tr
            key={template.id}
            className="border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors"
            data-testid={`template-row-${template.id}`}
          >
            <td className="py-[10px] pl-[13px] text-zinc-100 font-medium">
              {template.name}
            </td>
            <td className="py-[10px] px-[13px] text-zinc-300">
              {template.clientName || (
                <span className="text-zinc-500 italic">Universel</span>
              )}
            </td>
            <td className="py-[10px] px-[13px] text-zinc-400">
              {template.category || <span className="text-zinc-600">—</span>}
            </td>
            <td className="py-[10px] px-[13px] text-zinc-400 text-right tabular-nums">
              {template.elements.length}
            </td>
            <td className="py-[10px] px-[13px] text-zinc-400">
              {formatRelativeDate(template.updatedAt)}
            </td>
            <td className="py-[10px] pr-[13px] text-right">
              <div className="flex items-center justify-end gap-[3px]">
                <button
                  className="p-[5px] text-zinc-500 hover:text-red-400 rounded transition-colors"
                  aria-label="Supprimer le template"
                  title="Supprimer"
                  onClick={() => onDeleteClick?.(template)}
                  data-testid={`template-delete-${template.id}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
                <button
                  className="p-[5px] text-zinc-500 hover:text-blue-400 rounded transition-colors"
                  aria-label="Modifier les propriétés"
                  title="Modifier"
                  onClick={() => onEditClick?.(template)}
                  data-testid={`template-edit-${template.id}`}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  className="p-[5px] text-zinc-500 hover:text-emerald-400 rounded transition-colors"
                  aria-label="Utiliser ce template"
                  title="Utiliser"
                  onClick={() => onUseClick?.(template)}
                  data-testid={`template-use-${template.id}`}
                >
                  <Play size={16} aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
