import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { Command } from './useCommands';

export interface JobSearchEntry {
  id: string;
  reference: string;
  client: string;
  description: string;
}

interface CommandCenterContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  pageCommands: Command[];
  registerPageCommands: (commands: Command[]) => void;
  unregisterPageCommands: () => void;
  jobs: JobSearchEntry[];
  onSelectJob: ((jobId: string) => void) | null;
  registerJobs: (jobs: JobSearchEntry[], onSelectJob: (jobId: string) => void) => void;
  unregisterJobs: () => void;
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

export function CommandCenterProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageCommands, setPageCommands] = useState<Command[]>([]);
  const [jobs, setJobs] = useState<JobSearchEntry[]>([]);
  const onSelectJobRef = useRef<((jobId: string) => void) | null>(null);

  const registerPageCommands = useCallback((commands: Command[]) => {
    setPageCommands(commands);
  }, []);

  const unregisterPageCommands = useCallback(() => {
    setPageCommands([]);
  }, []);

  const registerJobs = useCallback((newJobs: JobSearchEntry[], onSelect: (jobId: string) => void) => {
    setJobs(newJobs);
    onSelectJobRef.current = onSelect;
  }, []);

  const unregisterJobs = useCallback(() => {
    setJobs([]);
    onSelectJobRef.current = null;
  }, []);

  return (
    <CommandCenterContext.Provider value={{
      isOpen, setIsOpen,
      pageCommands, registerPageCommands, unregisterPageCommands,
      jobs, onSelectJob: onSelectJobRef.current, registerJobs, unregisterJobs,
    }}>
      {children}
    </CommandCenterContext.Provider>
  );
}

export function useCommandCenter(): CommandCenterContextValue {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) throw new Error('useCommandCenter must be used within CommandCenterProvider');
  return ctx;
}
