import { useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { Calendar } from 'lucide-react';
import { parseFrenchDate, formatToFrench } from './frenchDate';
import { JcfAutocomplete } from '../JcfAutocomplete';
import { JcfTransporteurSelect } from './JcfTransporteurSelect';
import { JcfJobPrecedencesAutocomplete } from '../JcfJobPrecedencesAutocomplete';
import type { Suggestion } from '../JcfAutocomplete';
import type { JcfTemplate } from '@flux/types';
import { useGetClientSuggestionsQuery, useGetReferentSuggestionsQuery, useLazyLookupByReferenceQuery, useGetTemplatesQuery, useGetShippersQuery } from '../../store';
import { useCreateClientMutation } from '../../store';
import { useCreateReferentMutation } from '../../store';
import { useDebouncedValue } from '../../hooks';

export interface JcfJobHeaderProps {
  jobId: string;
  /** Called when job ID/reference is changed (v0.5.6) */
  onJobIdChange?: (value: string) => void;
  client: string;
  onClientChange: (value: string) => void;
  referent: string;
  onReferentChange: (value: string) => void;
  template: string;
  onTemplateChange: (value: string) => void;
  /** Called when user selects a template to apply (v0.4.34) - receives full template data for both element application and workflow extraction */
  onTemplateSelect?: (template: JcfTemplate | null) => void;
  intitule: string;
  onIntituleChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  shipperId?: string;
  onShipperIdChange?: (value: string) => void;
  deadline: string;
  onDeadlineChange: (value: string) => void;
  /** BAT deadline (ISO or French format) */
  batDeadline?: string;
  onBatDeadlineChange?: (value: string) => void;
  /** Required job references (comma-separated) */
  requiredJobs?: string;
  onRequiredJobsChange?: (value: string) => void;
  /** Available job suggestions for the required jobs autocomplete */
  jobSuggestions?: Array<{ reference: string; client: string }>;
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
  referent,
  onReferentChange,
  template,
  onTemplateChange,
  onTemplateSelect,
  intitule,
  onIntituleChange,
  quantity,
  onQuantityChange,
  shipperId,
  onShipperIdChange,
  deadline,
  onDeadlineChange,
  batDeadline,
  onBatDeadlineChange,
  requiredJobs,
  onRequiredJobsChange,
  jobSuggestions,
}: JcfJobHeaderProps) {
  const deadlineInputRef = useRef<HTMLInputElement>(null);
  const nativeDateRef = useRef<HTMLInputElement>(null);
  const batDeadlineInputRef = useRef<HTMLInputElement>(null);
  const nativeBatDateRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = () => {
    nativeDateRef.current?.showPicker();
  };

  const handleOpenBatPicker = () => {
    nativeBatDateRef.current?.showPicker();
  };

  // Auto-persist new client names to the clients table
  const [createClient] = useCreateClientMutation();
  // Auto-persist new referent names to the referents table
  const [createReferent] = useCreateReferentMutation();

  // Load shippers for transporteur dropdown
  const { data: shippers = [] } = useGetShippersQuery();

  // Load templates from real API via RTK Query (same source as /templates page)
  const { data: templateData } = useGetTemplatesQuery();
  const templates = useMemo(() => templateData?.items ?? [], [templateData]);

  // Keep a ref to always access latest templates in callbacks (avoids stale closure)
  const templatesRef = useRef<JcfTemplate[]>(templates);
  useLayoutEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

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
    () => apiClients.map((name) => ({ label: name, value: name })),
    [apiClients]
  );

  const handleClientBlur = useCallback(() => {
    const trimmed = client.trim();
    if (!trimmed) return;

    const existsInApi = apiClients.some(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    );

    if (!existsInApi) {
      // Auto-persist new client name to the database
      createClient({ name: trimmed }).catch(() => {
        // Silently ignore errors (e.g. duplicate on race condition)
      });
    }
  }, [client, apiClients, createClient]);

  const handleClientSelect = () => {
    setTimeout(() => {
      document.getElementById('jcf-referent')?.focus();
    }, 0);
  };

  // --- Referent autocomplete ---

  const debouncedReferent = useDebouncedValue(referent, 300);
  const { data: apiReferents = [] } = useGetReferentSuggestionsQuery(debouncedReferent, {
    skip: debouncedReferent.length === 1,
  });

  const referentSuggestions: Suggestion[] = useMemo(
    () => apiReferents.map((name) => ({ label: name, value: name })),
    [apiReferents]
  );

  const handleReferentBlur = useCallback(() => {
    const trimmed = referent.trim();
    if (!trimmed) return;

    const existsInApi = apiReferents.some(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    );

    if (!existsInApi) {
      createReferent({ name: trimmed }).catch(() => {
        // Silently ignore errors (e.g. duplicate on race condition)
      });
    }
  }, [referent, apiReferents, createReferent]);

  const handleReferentSelect = () => {
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
      const selectedTemplate = templatesRef.current.find((t) => t.id === selectedValue);
      if (selectedTemplate) {
        onTemplateChange(selectedTemplate.name);
        onTemplateSelect?.(selectedTemplate);
      }
      setTimeout(() => {
        document.getElementById('jcf-intitule')?.focus();
      }, 0);
    },
    [onTemplateChange, onTemplateSelect]
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

  // --- Required Jobs autocomplete ---

  const requiredJobSuggestions: Suggestion[] = useMemo(() => {
    if (!jobSuggestions) return [];
    // Parse already-selected references
    const selected = (requiredJobs ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return jobSuggestions
      .filter((j) => j.reference !== jobId && !selected.includes(j.reference))
      .map((j) => ({ label: `${j.reference} - ${j.client}`, value: j.reference }));
  }, [jobSuggestions, requiredJobs, jobId]);

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
  // Native datetime-local expects YYYY-MM-DDTHH:mm
  const parsedDeadline = deadline.includes('-') ? deadline : parseFrenchDate(deadline);
  // Ensure date-only values get a time for datetime-local
  const deadlineNativeValue = parsedDeadline && !parsedDeadline.includes('T')
    ? `${parsedDeadline}T14:00`
    : parsedDeadline || `${new Date().toISOString().slice(0, 10)}T14:00`;

  // --- BAT Deadline ---
  const handleBatDeadlineBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseFrenchDate(e.target.value);
    if (parsed) {
      onBatDeadlineChange?.(parsed);
    }
  };

  const handleNativeBatDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBatDeadlineChange?.(e.target.value);
  };

  const batDeadlineVal = batDeadline ?? '';
  const batDeadlineDisplay = batDeadlineVal.includes('-') ? formatToFrench(batDeadlineVal) : batDeadlineVal;
  const parsedBatDeadline = batDeadlineVal.includes('-') ? batDeadlineVal : parseFrenchDate(batDeadlineVal);
  const batDeadlineNativeValue = parsedBatDeadline && !parsedBatDeadline.includes('T')
    ? `${parsedBatDeadline}T14:00`
    : parsedBatDeadline || `${new Date().toISOString().slice(0, 10)}T14:00`;

  return (
    <div
      className="bg-zinc-900/50 rounded-[3px] border border-zinc-800 p-[10px]"
      data-testid="jcf-job-header"
    >
      {/* Row 1: Identity */}
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
            autoComplete="off"
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

        {/* Referent — autocomplete */}
        <div className="w-[182px]">
          <label htmlFor="jcf-referent" className={labelClass}>
            Référent
          </label>
          <JcfAutocomplete
            id="jcf-referent"
            value={referent}
            onChange={onReferentChange}
            suggestions={referentSuggestions}
            inputClassName={inputBaseClass}
            onSelect={handleReferentSelect}
            onBlur={handleReferentBlur}
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
            autoComplete="off"
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
            autoComplete="off"
            data-testid="jcf-field-quantite"
          />
        </div>

        {/* Required Jobs (prerequisites) */}
        {onRequiredJobsChange && (
          <div className="w-[234px]">
            <label htmlFor="jcf-required-jobs" className={labelClass}>
              Prérequis
            </label>
            <JcfJobPrecedencesAutocomplete
              id="jcf-required-jobs"
              value={requiredJobs ?? ''}
              onChange={onRequiredJobsChange}
              suggestions={requiredJobSuggestions}
              inputClassName={inputBaseClass}
              placeholder="ex: JOB-001,JOB-002"
            />
          </div>
        )}
      </div>

      {/* Row 2: Details */}
      <div className="flex gap-[10px] flex-wrap mt-2">
        {/* Deadline */}
        <div className="w-[182px]">
          <label htmlFor="jcf-deadline" className={labelClass}>
            Départ atelier
          </label>
          <input
            id="jcf-deadline"
            type="datetime-local"
            value={deadlineNativeValue}
            onChange={handleNativeDateChange}
            className={`${inputBaseClass} font-mono [color-scheme:dark]`}
            data-testid="jcf-field-deadline"
          />
        </div>

        {/* D.L. BAT */}
        {onBatDeadlineChange && (
          <div className="w-[182px]">
            <label htmlFor="jcf-bat-deadline" className={labelClass}>
              Date limite BAT
            </label>
            <input
              id="jcf-bat-deadline"
              type="datetime-local"
              value={batDeadlineNativeValue}
              onChange={handleNativeBatDateChange}
              className={`${inputBaseClass} font-mono [color-scheme:dark]`}
              data-testid="jcf-field-bat-deadline"
            />
          </div>
        )}

        {/* Transporteur */}
        {onShipperIdChange && (
          <div className="w-[156px]">
            <label className={labelClass}>Transporteur</label>
            <JcfTransporteurSelect
              shippers={shippers}
              value={shipperId ?? ''}
              onChange={onShipperIdChange}
              inputBaseClass={inputBaseClass}
            />
          </div>
        )}

      </div>
    </div>
  );
}
