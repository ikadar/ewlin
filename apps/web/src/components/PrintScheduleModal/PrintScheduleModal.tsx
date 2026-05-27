import { useState, useCallback } from 'react';
import { Printer, Loader2, Check } from 'lucide-react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCancelButton,
  ModalPrimaryButton,
} from '../Modal/Modal';
import { useGetSnapshotQuery, useGetProdSnapshotQuery } from '../../store';
import { useScenarioMode } from '../../contexts/ScenarioContext';
import { generateSchedulePdf } from './generateSchedulePdf';

type Horizon = 12 | 24 | 48;
const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PrintScheduleModal({ isOpen, onClose }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(24);
  const [includeStations, setIncludeStations] = useState(true);
  const [includeOperators, setIncludeOperators] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const { mode } = useScenarioMode();
  const preprod = useGetSnapshotQuery(undefined, { skip: mode === 'prod' || !isOpen });
  const prod = useGetProdSnapshotQuery(undefined, { skip: mode !== 'prod' || !isOpen });
  const snapshot = mode === 'prod' ? prod.data : preprod.data;
  const isLoading = mode === 'prod' ? prod.isLoading : preprod.isLoading;

  const canGenerate = !isLoading && snapshot && (includeStations || includeOperators);

  const handleGenerate = useCallback(async () => {
    if (!snapshot || !canGenerate) return;
    setGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      const now = new Date();
      const to = new Date(now.getTime() + horizon * 3600_000);
      generateSchedulePdf({
        snapshot,
        from: now,
        to,
        includeStations,
        includeOperators,
      });
      setDownloaded(true);
    } finally {
      setGenerating(false);
    }
  }, [snapshot, canGenerate, horizon, includeStations, includeOperators]);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => setDownloaded(false), 200);
  }, [onClose]);

  const labelStyle = 'text-[11px] font-medium text-zinc-400 mb-[4px]';

  return (
    <Modal open={isOpen} onClose={handleClose} width="26rem">
      <ModalHeader
        title="Imprimer le planning"
        icon={<Printer size={14} />}
        iconTone="blue"
        onClose={handleClose}
      />

      {downloaded ? (
        <>
          <ModalBody gap={14}>
            <div className="flex flex-col items-center gap-[10px] py-[16px]">
              <div className="w-10 h-10 rounded-full bg-emerald-600/15 border border-emerald-600/30 flex items-center justify-center">
                <Check size={20} className="text-emerald-400" />
              </div>
              <p className="text-[13px] text-zinc-200 text-center">
                Le PDF a été téléchargé.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalPrimaryButton onClick={handleClose}>Fermer</ModalPrimaryButton>
          </ModalFooter>
        </>
      ) : (
        <>
          <ModalBody gap={14}>
            <div>
              <div className={labelStyle}>Horizon</div>
              <div className="flex gap-[6px]">
                {HORIZONS.map(h => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => setHorizon(h.value)}
                    className={`flex-1 py-[6px] text-[13px] font-medium rounded-[3px] transition-colors ${
                      horizon === h.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className={labelStyle}>Contenu</div>
              <div className="flex flex-col gap-[6px]">
                <label className="flex items-center gap-[8px] cursor-pointer text-[13px] text-zinc-200">
                  <input
                    type="checkbox"
                    checked={includeStations}
                    onChange={e => setIncludeStations(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Stations (1 page par station)
                </label>
                <label className="flex items-center gap-[8px] cursor-pointer text-[13px] text-zinc-200">
                  <input
                    type="checkbox"
                    checked={includeOperators}
                    onChange={e => setIncludeOperators(e.target.checked)}
                    className="accent-blue-500"
                  />
                  Opérateurs (1 page par opérateur)
                </label>
              </div>
            </div>
          </ModalBody>
          <ModalFooter hint="PDF paysage A4, optimisé pour l'impression papier">
            <ModalCancelButton onClick={handleClose}>Annuler</ModalCancelButton>
            <ModalPrimaryButton
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
            >
              {generating ? (
                <span className="flex items-center gap-[6px]">
                  <Loader2 size={14} className="animate-spin" />
                  Génération…
                </span>
              ) : (
                'Télécharger'
              )}
            </ModalPrimaryButton>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
