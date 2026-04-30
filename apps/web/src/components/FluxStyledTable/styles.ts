/**
 * Shared style constants for Flux-aligned tables.
 *
 * Use these in every settings page (and any other admin/list table)
 * so the visual rhythm stays identical to /flux:
 *
 *     <div className={FLUX_TABLE_SHELL}>
 *       <table className={FLUX_TABLE}>
 *         <thead className={FLUX_THEAD}>
 *           <tr className={FLUX_HEADER_TR}>
 *             <th className={FLUX_HEADER_CELL}>Nom</th>
 *             ...
 *           </tr>
 *         </thead>
 *         <tbody>
 *           {rows.map(r => (
 *             <tr className={FLUX_BODY_TR} style={FLUX_BODY_TR_STYLE}>
 *               <td className={FLUX_BODY_CELL_PRIMARY}>{r.name}</td>
 *               <td className={FLUX_BODY_CELL}>{r.description}</td>
 *               <td className={FLUX_BODY_CELL_ACTIONS}>
 *                 <FluxRowActions onEdit={…} onDelete={…} />
 *               </td>
 *             </tr>
 *           ))}
 *         </tbody>
 *       </table>
 *     </div>
 */

/** Outer card around the table: border + rounded + clip overflow. */
export const FLUX_TABLE_SHELL =
  'bg-flux-elevated rounded-lg border border-flux-border overflow-hidden';

/** The <table> element. */
export const FLUX_TABLE = 'w-full text-sm';

/** The <thead>. Sticky to keep headers visible while scrolling rows. */
export const FLUX_THEAD = 'sticky top-0 z-30 bg-flux-hover';

/** The single header <tr>. */
export const FLUX_HEADER_TR = 'bg-flux-hover border-b border-flux-border';

/** Standard header cell — left-aligned. */
export const FLUX_HEADER_CELL =
  'px-4 py-3 text-left text-sm font-medium whitespace-nowrap text-flux-text-secondary';

/** Header cell for right-aligned columns (numbers, action column). */
export const FLUX_HEADER_CELL_RIGHT =
  'px-4 py-3 text-right text-sm font-medium whitespace-nowrap text-flux-text-secondary';

/** Header cell for centred columns. */
export const FLUX_HEADER_CELL_CENTER =
  'px-4 py-3 text-center text-sm font-medium whitespace-nowrap text-flux-text-secondary';

/** Header cell wrapped with sortable affordance: clickable + group hover. */
export const FLUX_HEADER_CELL_SORTABLE =
  `${FLUX_HEADER_CELL} group cursor-pointer select-none`;

/** Standard body row classes. */
export const FLUX_BODY_TR =
  'border-b border-flux-border group transition-colors cursor-pointer hover:bg-flux-hover';

/** Inline style enforcing the standard 36 px row height. */
export const FLUX_BODY_TR_STYLE = { height: '2.25rem' } as const;

/** Standard body cell. */
export const FLUX_BODY_CELL = 'px-4 py-0 text-sm text-flux-text-secondary';

/** Body cell with the primary-text colour, used on the "name"/"id" first column. */
export const FLUX_BODY_CELL_PRIMARY =
  'px-4 py-0 text-sm text-flux-text-primary font-medium';

/** Body cell carrying right-aligned content (numbers, actions). */
export const FLUX_BODY_CELL_RIGHT =
  'px-4 py-0 text-sm text-flux-text-secondary text-right whitespace-nowrap';

/** Body cell for the actions column — right-aligned + flex-end inside. */
export const FLUX_BODY_CELL_ACTIONS = FLUX_BODY_CELL_RIGHT;
