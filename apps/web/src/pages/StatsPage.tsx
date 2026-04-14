import { useMemo } from 'react';
import { useGetSnapshotQuery } from '../store/api/scheduleApi';
import { deriveStatsData } from '../utils/statsData';
import {
  ChartCard,
  SlackUrgencyScatter,
  ScheduleOrderScatter,
  LatenessByPriorityBar,
  SlackDistributionHistogram,
  StationUtilizationHeatmap,
} from '../components/StatsCharts';
import { LATE_COLOR, ONTIME_COLOR, PRIORITY_COLORS, PRIORITY_LABELS, DIAG_COLOR } from '../components/StatsCharts/chartTheme';

function LegendDot({ color, size, label }: { color: string; size?: number; label: string }) {
  const s = size ?? 8;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-flux-text-tertiary">
      <div className="rounded-full shrink-0" style={{ width: s, height: s, background: color }} />
      {label}
    </div>
  );
}

function LegendRect({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-flux-text-tertiary">
      <div className="rounded-sm shrink-0" style={{ width: 12, height: 8, background: color }} />
      {label}
    </div>
  );
}

function LegendLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: DIAG_COLOR }}>
      --- {label}
    </div>
  );
}

export default function StatsPage() {
  const { data: snapshot, isLoading } = useGetSnapshotQuery();

  const stats = useMemo(() => {
    if (!snapshot) return null;
    return deriveStatsData(snapshot);
  }, [snapshot]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-flux-text-muted text-sm">
        Chargement du snapshot...
      </div>
    );
  }

  if (!stats || stats.slackUrgency.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-flux-text-muted text-sm">
        Aucun job planifié — lancez un calcul pour voir les statistiques.
      </div>
    );
  }

  // Summary metrics
  const total = stats.slackUrgency.length;
  const late = stats.slackUrgency.filter((j) => j.isLate).length;
  const onTimePct = Math.round(((total - late) / total) * 100);
  const avgLateness = late > 0
    ? (stats.slackUrgency.filter((j) => j.isLate).reduce((s, j) => s + j.delayDays, 0) / late).toFixed(1)
    : '0';
  const maxLateness = late > 0
    ? Math.max(...stats.slackUrgency.filter((j) => j.isLate).map((j) => j.delayDays)).toFixed(1)
    : '0';

  const pctColor = onTimePct >= 85 ? ONTIME_COLOR : onTimePct >= 60 ? '#fbbf24' : LATE_COLOR;
  const lateColor = late === 0 ? ONTIME_COLOR : late <= 3 ? '#fbbf24' : LATE_COLOR;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-flux-text-primary">Statistiques algorithme</h1>
          <p className="text-xs text-flux-text-muted mt-0.5">
            Analyse du comportement de priorisation du moteur FBI + LNS
          </p>
        </div>

        {/* Summary bar */}
        <div className="flex gap-6 px-4 py-3 bg-flux-surface border border-flux-border rounded-[10px] mb-4">
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums">{total}</span>
            <span className="text-[11px] text-flux-text-muted">Jobs planifiés</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums" style={{ color: pctColor }}>{onTimePct}%</span>
            <span className="text-[11px] text-flux-text-muted">À l'heure</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums" style={{ color: lateColor }}>{late}</span>
            <span className="text-[11px] text-flux-text-muted">En retard</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums">{avgLateness}j</span>
            <span className="text-[11px] text-flux-text-muted">Retard moyen</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums">{maxLateness}j</span>
            <span className="text-[11px] text-flux-text-muted">Retard max</span>
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <ChartCard
            title="Slack vs Urgence"
            description="Au-dessus de la diagonale = pas assez de temps"
            legend={<>
              <LegendDot color={ONTIME_COLOR} label="À l'heure" />
              <LegendDot color={LATE_COLOR} label="En retard" />
              <LegendDot color={LATE_COLOR} size={12} label="Impératif" />
              <LegendDot color={LATE_COLOR} size={6} label="Standard" />
              <LegendLine label="slack = 0" />
            </>}
          >
            <SlackUrgencyScatter data={stats.slackUrgency} />
          </ChartCard>

          <ChartCard
            title="Ordre de planification vs Deadline"
            description="Les jobs urgents devraient démarrer tôt"
            legend={<>
              {PRIORITY_LABELS.map((l, i) => (
                <LegendDot key={i} color={PRIORITY_COLORS[i]} label={l} />
              ))}
            </>}
          >
            <ScheduleOrderScatter data={stats.scheduleOrder} />
          </ChartCard>

          <ChartCard
            title="Retard par priorité"
            description="L'algo respecte-t-il la hiérarchie ?"
            legend={<>
              <LegendRect color={ONTIME_COLOR} label="À l'heure" />
              <LegendRect color={LATE_COLOR} label="En retard" />
            </>}
          >
            <LatenessByPriorityBar data={stats.latenessByPriority} />
          </ChartCard>

          <ChartCard
            title="Distribution du slack"
            description="À quel seuil de slack les jobs deviennent en retard ?"
            legend={<>
              <LegendRect color={ONTIME_COLOR} label="À l'heure" />
              <LegendRect color={LATE_COLOR} label="En retard" />
              <LegendLine label="slack = 0" />
            </>}
          >
            <SlackDistributionHistogram data={stats.slackDistribution} />
          </ChartCard>
        </div>

        {/* Full-width heatmap */}
        <div className="grid grid-cols-2 gap-4">
          <ChartCard
            fullWidth
            title="Utilisation des stations"
            description="Taux d'occupation par créneau horaire — identifier les goulots"
          >
            <StationUtilizationHeatmap data={stats.stationUtilization} horizonStart={stats.horizonStart} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
