import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Loader2, Check, ChevronDown } from 'lucide-react';
import JSZip from 'jszip';
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
const HORIZON_OPTIONS: { value: Horizon; label: string }[] = [
  { value: 12, label: '12 heures' },
  { value: 24, label: '24 heures' },
  { value: 48, label: '48 heures' },
];

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ---------------------------------------------------------------------------
// Custom dropdown (button + portal popover, keyboard nav)
// ---------------------------------------------------------------------------
function HorizonSelect({ value, onChange }: { value: Horizon; onChange: (v: Horizon) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 });

  const selected = HORIZON_OPTIONS.find(o => o.value === value)!;

  const open = useCallback(() => {
    if (isOpen) { setIsOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 2, left: rect.left, minWidth: Math.max(rect.width, 140) });
    setActiveIndex(HORIZON_OPTIONS.findIndex(o => o.value === value));
    setIsOpen(true);
  }, [isOpen, value]);

  const select = useCallback((v: Horizon) => {
    onChange(v);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('[role=dialog]') && e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }
      switch (e.key) {
        case 'Escape':
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(i => Math.min(i + 1, HORIZON_OPTIONS.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0) select(HORIZON_OPTIONS[activeIndex].value);
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, activeIndex, select]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[10px] py-[6px] text-[13px] text-zinc-100 flex items-center justify-between cursor-pointer hover:border-zinc-600 transition-colors"
      >
        <span>{selected.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg py-1"
          style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
        >
          {HORIZON_OPTIONS.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-700 ${
                idx === activeIndex ? 'bg-zinc-700/50' : ''
              } ${value === opt.value ? 'text-blue-400 font-medium' : 'text-zinc-100'}`}
              onClick={() => select(opt.value)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
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
      const baseOpts = { snapshot, from: now, to };

      const day = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace(/\.\s?/g, '').replace(' ', '');
      const env = mode === 'prod' ? 'prod' : 'preprod';
      const tag = `${env}-${day}-${horizon}h`;

      if (includeStations && includeOperators) {
        const stationsBuf = generateSchedulePdf({ ...baseOpts, includeStations: true, includeOperators: false });
        const operatorsBuf = generateSchedulePdf({ ...baseOpts, includeStations: false, includeOperators: true });
        const zip = new JSZip();
        zip.file(`planning-stations-${tag}.pdf`, stationsBuf);
        zip.file(`planning-operateurs-${tag}.pdf`, operatorsBuf);
        const blob = await zip.generateAsync({ type: 'blob' });
        saveBlob(blob, `planning-${tag}.zip`);
      } else {
        const buf = generateSchedulePdf({ ...baseOpts, includeStations, includeOperators });
        const blob = new Blob([buf], { type: 'application/pdf' });
        const kind = includeStations ? 'stations' : 'operateurs';
        saveBlob(blob, `planning-${kind}-${tag}.pdf`);
      }
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
                {includeStations && includeOperators
                  ? 'L\'archive ZIP a été téléchargée.'
                  : 'Le PDF a été téléchargé.'}
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
              <HorizonSelect value={horizon} onChange={setHorizon} />
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
          <ModalFooter
            hint={includeStations && includeOperators
              ? 'Archive ZIP contenant 2 PDF (stations + opérateurs)'
              : 'PDF paysage A4, optimisé pour l\'impression papier'}
          >
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
