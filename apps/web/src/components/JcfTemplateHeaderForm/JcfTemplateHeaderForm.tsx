/**
 * JcfTemplateHeaderForm - Template metadata form
 *
 * Fields: name (required), description, category (autocomplete), client (autocomplete)
 * Style harmonized with JcfJobHeader.
 *
 * @see v0.4.34 - JCF: Template CRUD & Apply
 */

import { useState, useMemo, useCallback } from 'react';
import { JcfAutocomplete } from '../JcfAutocomplete';
import type { Suggestion } from '../JcfAutocomplete';
import { MOCK_CLIENTS } from '../../mock/reference-data';
import { getTemplateCategories } from '../../mock/templateApi';

export interface TemplateHeaderData {
  name: string;
  description: string;
  category: string;
  clientName: string;
}

export interface JcfTemplateHeaderFormProps {
  value: TemplateHeaderData;
  onChange: (value: TemplateHeaderData) => void;
  disabled?: boolean;
}

/**
 * Form component for template metadata fields.
 * Includes session learning for new categories and clients.
 */
export function JcfTemplateHeaderForm({
  value,
  onChange,
  disabled,
}: JcfTemplateHeaderFormProps) {
  // Session learning: new categories/clients added during current session
  const [sessionCategories, setSessionCategories] = useState<string[]>([]);
  const [sessionClients, setSessionClients] = useState<string[]>([]);

  // Load existing categories from templates
  const existingCategories = useMemo(() => getTemplateCategories(), []);

  // Styles harmonized with JcfJobHeader (13px base)
  const labelClass = 'block text-xs leading-[13px] text-zinc-500 mb-[3px]';
  const inputBaseClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';

  // Handle field changes
  const handleChange = useCallback(
    (field: keyof TemplateHeaderData, fieldValue: string) => {
      onChange({ ...value, [field]: fieldValue });
    },
    [onChange, value]
  );

  // --- Category autocomplete ---

  const categorySuggestions: Suggestion[] = useMemo(
    () => [
      ...existingCategories.map((c) => ({ label: c, value: c })),
      ...sessionCategories.map((s) => ({ label: s, value: s, category: 'nouveau' })),
    ],
    [existingCategories, sessionCategories]
  );

  const handleCategoryBlur = useCallback(() => {
    const trimmed = value.category.trim();
    if (!trimmed) return;

    const existsInApi = existingCategories.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    const existsInSession = sessionCategories.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );

    if (!existsInApi && !existsInSession) {
      setSessionCategories((prev) => [...prev, trimmed]);
    }
  }, [value.category, existingCategories, sessionCategories]);

  // --- Client autocomplete ---

  const clientSuggestions: Suggestion[] = useMemo(
    () => [
      ...MOCK_CLIENTS.map((c) => ({ label: c.name, value: c.name })),
      ...sessionClients.map((s) => ({ label: s, value: s, category: 'nouveau' })),
    ],
    [sessionClients]
  );

  const handleClientBlur = useCallback(() => {
    const trimmed = value.clientName.trim();
    if (!trimmed) return;

    const existsInMock = MOCK_CLIENTS.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    const existsInSession = sessionClients.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );

    if (!existsInMock && !existsInSession) {
      setSessionClients((prev) => [...prev, trimmed]);
    }
  }, [value.clientName, sessionClients]);

  return (
    <div
      className="bg-zinc-900/50 rounded-[3px] border border-zinc-800 p-[10px]"
      data-testid="jcf-template-header-form"
    >
      <div className="flex gap-[10px] flex-wrap">
        {/* Name - required */}
        <div className="w-[260px]">
          <label htmlFor="template-name" className={labelClass}>
            Nom <span className="text-red-400">*</span>
          </label>
          <input
            id="template-name"
            type="text"
            value={value.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={disabled}
            className={inputBaseClass}
            placeholder="Ex: Brochure piquée"
            data-testid="template-field-name"
          />
        </div>

        {/* Category - autocomplete with session learning */}
        <div className="w-[180px]">
          <label htmlFor="template-category" className={labelClass}>
            Catégorie
          </label>
          <JcfAutocomplete
            id="template-category"
            value={value.category}
            onChange={(v) => handleChange('category', v)}
            suggestions={categorySuggestions}
            placeholder="Ex: Brochures"
            inputClassName={inputBaseClass}
            onBlur={handleCategoryBlur}
          />
        </div>

        {/* Client - autocomplete (null = universal template) */}
        <div className="w-[200px]">
          <label htmlFor="template-client" className={labelClass}>
            Client
          </label>
          <JcfAutocomplete
            id="template-client"
            value={value.clientName}
            onChange={(v) => handleChange('clientName', v)}
            suggestions={clientSuggestions}
            placeholder="Universel"
            inputClassName={inputBaseClass}
            onBlur={handleClientBlur}
          />
        </div>

        {/* Description - flexible width */}
        <div className="flex-1 min-w-[260px]">
          <label htmlFor="template-description" className={labelClass}>
            Description
          </label>
          <input
            id="template-description"
            type="text"
            value={value.description}
            onChange={(e) => handleChange('description', e.target.value)}
            disabled={disabled}
            className={inputBaseClass}
            placeholder="Ex: Brochure avec couverture et intérieur, reliure agrafes"
            data-testid="template-field-description"
          />
        </div>
      </div>
    </div>
  );
}
