import { useState, useRef, useMemo, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { parseFrenchDate, formatToFrench } from './frenchDate';
import { JcfAutocomplete } from '../JcfAutocomplete';
import type { Suggestion } from '../JcfAutocomplete';
import { getTemplates } from '../../mock/templateApi';
import type { JcfTemplate } from '@flux/types';
import { useGetClientSuggestionsQuery, useLazyLookupByReferenceQuery } from '../../store';
import { useDebouncedValue } from '../../hooks';

export interface JcfJobHeaderProps {
  jobId: string;
  /** Called when job ID/reference is changed (v0.5.6) */
  onJobIdChange?: (value: string) => void;
  client: string;
  onClientChange: (value: string) => void;
  template: string;
  onTemplateChange: (value: string) => void;
  /** Called when user selects a template to apply (v0.4.34) - receives full template data for both element application and workflow extraction */
  onTemplateSelect?: (template: JcfTemplate | null) => void;
  intitule: string;
  onIntituleChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  deadline: string;
  onDeadlineChange: (value: string) => void;
}

/**
 * JCF Job Header — horizontal form row with all job fields.
 *
 * Fields: ID (readonly), Client (autocomplete), Template (autocomplete),
 * Intitulé, Quantité, Deadline.
 *
 * All rem-based Tailwind classes are converted to px equivalents
 * for the 13px base used by the reference JCF app.
 */
export function JcfJobHeader({
  jobId,
  onJobIdChange,
  client,
  onClientChange,
  template,
  onTemplateChange,
  onTemplateSelect,
  intitule,
  onIntituleChange,
  quantity,
  onQuantityChange,
  deadline,
  onDeadlineChange,
}: JcfJobHeaderProps) {
  const deadlineInputRef = useRef<HTMLInputElement>(null);

  // Session learning: new client names added on blur
  const [sessionClients, setSessionClients] = useState<string[]>([]);

  // v0.4.34: Load templates from API (synchronous localStorage API)
  // Note: setTemplates unused - templates are refreshed on component mount
  const [templates, _setTemplates] = useState<JcfTemplate[]>(() => getTemplates());

  // v0.5.5: Client autocomplete via RTK Query with debounce
  // Skip only for single character (too vague); empty string fetches all, 2+ chars filters
  const debouncedClient = useDebouncedValue(client, 300);
  const { data: apiClients = [] } = useGetClientSuggestionsQuery(debouncedClient, {
    skip: debouncedClient.length === 1,
  });

  // v0.5.6: Lazy reference lookup for auto-filling client on blur
  const [triggerLookup] = useLazyLookupByReferenceQuery();

  // v0.5.6: Handle job ID blur - trigger lookup if client is empty
  const handleJobIdBlur = useCallback(async () => {
    const trimmedJobId = jobId.trim();
    const trimmedClient = client.trim();

    // Only lookup if jobId has value and client is empty
    if (trimmedJobId && !trimmedClient) {
      try {
        const result = await triggerLookup(trimmedJobId).unwrap();
        if (result.client) {
          onClientChange(result.client);
        }
      } catch {
        // Silently ignore lookup errors - just don't auto-fill
      }
    }
  }, [jobId, client, triggerLookup, onClientChange]);

  const labelClass = 'block text-xs leading-[13px] text-zinc-500 mb-[3px]';
  const inputBaseClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

  // --- Client autocomplete ---

  const clientSuggestions: Suggestion[] = useMemo(
    () => [
      ...apiClients.map((name) => ({ label: name, value: name })),
      ...sessionClients
        .filter((s) => !apiClients.includes(s)) // Avoid duplicates
        .map((s) => ({ label: s, value: s, category: 'nouveau' })),
    ],
    [apiClients, sessionClients]
  );

  const handleClientBlur = () => {
    const trimmed = client.trim();
    if (!trimmed) return;

    const existsInApi = apiClients.some(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    );
    const existsInSession = sessionClients.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );

    if (!existsInApi && !existsInSession) {
      setSessionClients((prev) => [...prev, trimmed]);
    }
  };

  const handleClientSelect = () => {
    setTimeout(() => {
      document.getElementById('jcf-template')?.focus();
    }, 0);
  };

  // --- Template autocomplete ---

  const templateSuggestions: Suggestion[] = useMemo(() => {
    const clientTemplates = client
      ? templates.filter(
          (t) => t.clientName?.toLowerCase() === client.toLowerCase()
        )
      : [];
    const universalTemplates = templates.filter((t) => !t.clientName);

    return [
      ...clientTemplates.map((t) => ({ label: t.name, value: t.id, category: client })),
      ...universalTemplates.map((t) => ({ label: t.name, value: t.id, category: 'universel' })),
    ];
  }, [client, templates]);

  // v0.4.34: Handle template selection - find template and call callback
  const handleTemplateSelectInternal = useCallback(
    (selectedValue: string) => {
      const selectedTemplate = templates.find((t) => t.id === selectedValue);
      if (selectedTemplate) {
        onTemplateChange(selectedTemplate.name);
        onTemplateSelect?.(selectedTemplate);
      }
      setTimeout(() => {
        document.getElementById('jcf-intitule')?.focus();
      }, 0);
    },
    [templates, onTemplateChange, onTemplateSelect]
  );

  // v0.4.31: Handle template clear (empty value)
  const handleTemplateChange = useCallback(
    (value: string) => {
      onTemplateChange(value);
      // If cleared, notify parent to reset workflow
      if (!value.trim()) {
        onTemplateSelect?.(null);
      }
    },
    [onTemplateChange, onTemplateSelect]
  );

  // --- Deadline ---

  const handleDeadlineBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseFrenchDate(e.target.value);
    if (parsed) {
      onDeadlineChange(parsed);
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDeadlineChange(e.target.value);
  };

  const deadlineDisplay = deadline.includes('-') ? formatToFrench(deadline) : deadline;
  const deadlineNativeValue = deadline.includes('-') ? deadline : parseFrenchDate(deadline);

  return (
    <div
      className="bg-zinc-900/50 rounded-[3px] border border-zinc-800 p-[10px]"
      data-testid="jcf-job-header"
    >
      <div className="flex gap-[10px] flex-wrap">
        {/* ID — editable for reference lookup (v0.5.6) */}
        <div className="w-[91px]">
          <label htmlFor="jcf-job-id" className={labelClass}>
            ID
          </label>
          <input
            id="jcf-job-id"
            type="text"
            value={jobId}
            onChange={onJobIdChange ? (e) => onJobIdChange(e.target.value) : undefined}
            onBlur={handleJobIdBlur}
            readOnly={!onJobIdChange}
            className={`w-full border border-zinc-700 rounded-[3px] px-[7px] py-[5px] font-mono ${
              onJobIdChange
                ? 'bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500'
                : 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
            }`}
            tabIndex={onJobIdChange ? 0 : -1}
            data-testid="jcf-field-id"
          />
        </div>

        {/* Client — autocomplete */}
        <div className="w-[234px]">
          <label htmlFor="jcf-client" className={labelClass}>
            Client
          </label>
          <JcfAutocomplete
            id="jcf-client"
            value={client}
            onChange={onClientChange}
            suggestions={clientSuggestions}
            inputClassName={inputBaseClass}
            onSelect={handleClientSelect}
            onBlur={handleClientBlur}
          />
        </div>

        {/* Template — autocomplete */}
        <div className="w-[234px]">
          <label htmlFor="jcf-template" className={labelClass}>
            Template
          </label>
          <JcfAutocomplete
            id="jcf-template"
            value={template}
            onChange={handleTemplateChange}
            suggestions={templateSuggestions}
            inputClassName={inputBaseClass}
            placeholder="Aucun"
            onSelect={handleTemplateSelectInternal}
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
