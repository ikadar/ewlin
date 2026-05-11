import { useState, type ReactElement } from 'react';

export interface BlockedModeProps {
  onBlockPrerequisite?: () => Promise<void>;
  onBlockMachine?: () => Promise<void>;
  onBlockAbsence?: () => Promise<void>;
  onBack: () => void;
  onReasonSelected: (reason: string | null) => void;
}

const REASONS = [
  {
    key: "prerequis",
    label: "Une tâche prérequise n'est pas terminée",
    effect: "Le démarrage sera repoussé d'1h dans le planning",
  },
  {
    key: "machine",
    label: "Ma machine a un souci",
    effect: "Un créneau de maintenance d'1h sera ajouté sur cette machine",
  },
  {
    key: "absence",
    label: "Je dois m'absenter",
    effect: "Une absence d'1h sera enregistrée à mon nom",
  },
] as const;

export function BlockedMode({
  onBlockPrerequisite,
  onBlockMachine,
  onBlockAbsence,
  onBack,
  onReasonSelected,
}: BlockedModeProps): ReactElement {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (key: string) => {
    const next = selected === key ? null : key;
    setSelected(next);
    onReasonSelected(next);
  };

  return (
    <div className="flex flex-col items-center gap-2.5 py-[18px] px-5 border-b border-flux-border" data-testid="pm-blocked-mode">
      <div className="text-[12px] font-semibold text-flux-text-tertiary uppercase tracking-wide">
        Motif du blocage :
      </div>

      {REASONS.map(({ key, label, effect }) => {
        const isDisabled = key === "prerequis" && !onBlockPrerequisite;
        return (
          <button
            key={key}
            type="button"
            disabled={isDisabled}
            onClick={() => handleSelect(key)}
            className={`
              w-full flex flex-col items-start gap-0.5 px-3.5 py-2.5 rounded-[6px]
              border text-left transition-colors
              ${selected === key
                ? "border-amber-300 bg-amber-500/10 text-amber-300"
                : "border-flux-border-light bg-[rgb(45,45,45)] text-flux-text-secondary hover:bg-[rgb(55,55,55)] hover:text-flux-text-primary"}
              ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
            data-testid={`pm-reason-${key}`}
          >
            <span className="text-[12px] font-semibold">{label}</span>
            <span className={`text-[10px] font-medium ${selected === key ? "text-amber-300/60" : "text-flux-text-muted"}`}>
              {isDisabled ? "Bientôt disponible" : effect}
            </span>
          </button>
        );
      })}

      <div className="text-[10.5px] text-flux-text-muted italic text-center mt-1">
        {"Pensez à prévenir le chef d'atelier dès que possible."}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-1 flex items-center justify-center gap-1.5 px-3.5 py-[7px] rounded border border-flux-border-light text-[11.5px] font-semibold text-flux-text-muted hover:text-flux-text-primary hover:bg-flux-hover transition-colors"
        data-testid="pm-blocked-back"
      >
        Retour
      </button>
    </div>
  );
}

export { REASONS };
