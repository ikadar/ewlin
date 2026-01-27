import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { parseFrenchDate, formatToFrench } from './frenchDate';

export interface JcfJobHeaderProps {
  jobId: string;
  intitule: string;
  onIntituleChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  deadline: string;
  onDeadlineChange: (value: string) => void;
}

/**
 * JCF Job Header — horizontal form row with basic job fields.
 *
 * Fields: ID (readonly), Intitulé, Quantité, Deadline.
 * Client and Template autocomplete fields will be added in v0.4.8.
 *
 * All rem-based Tailwind classes are converted to px equivalents
 * for the 13px base used by the reference JCF app.
 */
export function JcfJobHeader({
  jobId,
  intitule,
  onIntituleChange,
  quantity,
  onQuantityChange,
  deadline,
  onDeadlineChange,
}: JcfJobHeaderProps) {
  const deadlineInputRef = useRef<HTMLInputElement>(null);

  const labelClass = 'block text-[10px] leading-[13px] text-zinc-500 mb-[3px]';
  const inputBaseClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

  const handleDeadlineBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseFrenchDate(e.target.value);
    if (parsed) {
      onDeadlineChange(parsed);
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDeadlineChange(e.target.value);
  };

  // Display value: if stored as ISO, convert to French; otherwise show raw input
  const deadlineDisplay = deadline.includes('-') ? formatToFrench(deadline) : deadline;

  // Hidden native date picker value: always ISO format
  const deadlineNativeValue = deadline.includes('-') ? deadline : parseFrenchDate(deadline);

  return (
    <div
      className="bg-zinc-900/50 rounded-[3px] border border-zinc-800 p-[10px]"
      data-testid="jcf-job-header"
    >
      <div className="flex gap-[10px] flex-wrap">
        {/* ID — readonly */}
        <div className="w-[91px]">
          <label htmlFor="jcf-job-id" className={labelClass}>
            ID
          </label>
          <input
            id="jcf-job-id"
            type="text"
            value={jobId}
            readOnly
            className="w-full bg-zinc-800 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-400 font-mono cursor-not-allowed"
            tabIndex={-1}
            data-testid="jcf-field-id"
          />
        </div>

        {/* Intitulé */}
        <div className="flex-1 min-w-[208px]">
          <label htmlFor="jcf-intitule" className={labelClass}>
            Intitulé
          </label>
          <input
            id="jcf-intitule"
            type="text"
            value={intitule}
            onChange={(e) => onIntituleChange(e.target.value)}
            className={inputBaseClass}
            data-testid="jcf-field-intitule"
          />
        </div>

        {/* Quantité */}
        <div className="w-[78px]">
          <label htmlFor="jcf-quantite" className={labelClass}>
            Quantité
          </label>
          <input
            id="jcf-quantite"
            type="text"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            className={`${inputBaseClass} text-right font-mono`}
            data-testid="jcf-field-quantite"
          />
        </div>

        {/* Deadline */}
        <div className="w-[117px]">
          <label htmlFor="jcf-deadline" className={labelClass}>
            Deadline
          </label>
          <div className="relative">
            <input
              ref={deadlineInputRef}
              id="jcf-deadline"
              type="text"
              placeholder="jj/mm"
              value={deadlineDisplay}
              onChange={(e) => onDeadlineChange(e.target.value)}
              onBlur={handleDeadlineBlur}
              className={`${inputBaseClass} font-mono pr-[26px]`}
              data-testid="jcf-field-deadline"
            />
            <input
              type="date"
              aria-hidden="true"
              value={deadlineNativeValue}
              onChange={handleNativeDateChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
              tabIndex={-1}
            />
            <Calendar
              size={16}
              className="absolute right-[7px] top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
