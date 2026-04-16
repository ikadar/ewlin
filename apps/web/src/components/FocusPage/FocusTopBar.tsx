import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  FocusSelector,
  type FocusKind,
  type FocusSelectorItem,
} from '../FocusSelector';

export interface FocusTopBarProps {
  operators: FocusSelectorItem[];
  stations: FocusSelectorItem[];
  currentKind: FocusKind;
  currentId: string;
  onSelect: (kind: FocusKind, id: string) => void;
}

export function FocusTopBar({
  operators,
  stations,
  currentKind,
  currentId,
  onSelect,
}: FocusTopBarProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
      <div className="px-3 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 shrink-0"
          aria-label="Retour"
          title="Retour"
          data-testid="focus-back-button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <FocusSelector
            operators={operators}
            stations={stations}
            currentKind={currentKind}
            currentId={currentId}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
}
