import { useState, useMemo, useCallback } from 'react';
import { Printer, Loader2 } from 'lucide-react';
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

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  return d;
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr + 'T23:59:59');
  return d;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PrintScheduleModal({ isOpen, onClose }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    return toDateInputValue(d);
  }, []);

  const defaultTo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return toDateInputValue(d);
  }, []);

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(defaultTo);
  const [includeStations, setIncludeStations] = useState(true);
  const [includeOperators, setIncludeOperators] = useState(true);
  const [generating, setGenerating] = useState(false);

  const { mode } = useScenarioMode();
  const preprod = useGetSnapshotQuery(undefined, { skip: mode === 'prod' || !isOpen });
  const prod = useGetProdSnapshotQuery(undefined, { skip: mode !== 'prod' || !isOpen });
  const snapshot = mode === 'prod' ? prod.data : preprod.data;
  const isLoading = mode === 'prod' ? prod.isLoading : preprod.isLoading;

  const canGenerate = !isLoading && snapshot && (includeStations || includeOperators) && fromDate && toDate && fromDate <= toDate;

  const handleGenerate = useCallback(async () => {
    if (!snapshot || !canGenerate) return;
    setGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      generateSchedulePdf({
        snapshot,
        from: startOfDay(fromDate),
        to: endOfDay(toDate),
        includeStations,
        includeOperators,
      });
    } finally {
      setGenerating(false);
    }
  }, [snapshot, canGenerate, fromDate, toDate, includeStations, includeOperators]);

  const labelStyle = 'text-[11px] font-medium text-zinc-400 mb-[4px]';
  const inputStyle =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[10px] py-[6px] text-[13px] text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <Modal open={isOpen} onClose={onClose} width="26rem">
      <ModalHeader
        title="Imprimer le planning"
        icon={<Printer size={14} />}
        iconTone="blue"
        onClose={onClose}
      />
      <ModalBody gap={14}>
        <div className="flex gap-[10px]">
          <div className="flex-1">
            <div className={labelStyle}>Du</div>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className={inputStyle}
            />
          </div>
          <div className="flex-1">
            <div className={labelStyle}>Au</div>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className={inputStyle}
            />
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

        {fromDate > toDate && (
          <p className="text-[11px] text-red-400">
            La date de fin doit être postérieure à la date de début.
          </p>
        )}
      </ModalBody>
      <ModalFooter hint="PDF portrait, A4, optimisé pour l'impression papier">
        <ModalCancelButton onClick={onClose}>Annuler</ModalCancelButton>
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
    </Modal>
  );
}
