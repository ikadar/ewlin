import { Plus, Move } from 'lucide-react';

interface ModeBannerProps {
  mode: 'quickPlacement' | 'picking' | null;
}

const MODE_CONFIGS = {
  quickPlacement: {
    gradient: 'from-emerald-500/35 to-transparent',
    label: 'Placement rapide',
    hint: 'Cliquez pour placer · Esc pour quitter',
    labelClass: 'text-emerald-400',
    hintClass: 'text-emerald-500/60',
    iconClass: 'text-emerald-400',
    escBorderClass: 'border-emerald-500/30',
    escTextClass: 'text-emerald-500/70',
    escBgClass: 'bg-emerald-500/8',
    Icon: Plus,
  },
  picking: {
    gradient: 'from-amber-500/35 to-transparent',
    label: 'Pick & Place',
    hint: 'Cliquez pour placer · Esc pour annuler',
    labelClass: 'text-amber-400',
    hintClass: 'text-amber-500/60',
    iconClass: 'text-amber-400',
    escBorderClass: 'border-amber-500/30',
    escTextClass: 'text-amber-500/70',
    escBgClass: 'bg-amber-500/8',
    Icon: Move,
  },
} as const;

export function ModeBanner({ mode }: ModeBannerProps) {
  if (!mode) return null;
  const config = MODE_CONFIGS[mode];
  const { Icon } = config;

  return (
    <div
      className={`h-8 flex items-center gap-2 px-4 bg-gradient-to-r ${config.gradient} animate-[banner-pulse_2s_ease-in-out_infinite]`}
      data-testid="mode-banner"
    >
      <Icon size={14} className={config.iconClass} />
      <span className={`text-xs font-bold tracking-wide ${config.labelClass}`}>
        {config.label}
      </span>
      <span className={`text-xs ${config.hintClass}`}>
        {config.hint}
      </span>
      <kbd className={`ml-auto text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${config.escBorderClass} ${config.escTextClass} ${config.escBgClass}`}>
        ESC
      </kbd>
    </div>
  );
}
