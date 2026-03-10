import { createContext, useCallback, useContext, useState } from 'react';
import type { Command } from './useCommands';

interface CommandCenterContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  pageCommands: Command[];
  registerPageCommands: (commands: Command[]) => void;
  unregisterPageCommands: () => void;
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

export function CommandCenterProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageCommands, setPageCommands] = useState<Command[]>([]);

  const registerPageCommands = useCallback((commands: Command[]) => {
    setPageCommands(commands);
  }, []);

  const unregisterPageCommands = useCallback(() => {
    setPageCommands([]);
  }, []);

  return (
    <CommandCenterContext.Provider value={{ isOpen, setIsOpen, pageCommands, registerPageCommands, unregisterPageCommands }}>
      {children}
    </CommandCenterContext.Provider>
  );
}

export function useCommandCenter(): CommandCenterContextValue {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) throw new Error('useCommandCenter must be used within CommandCenterProvider');
  return ctx;
}
