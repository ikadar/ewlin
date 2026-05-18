import { Outlet } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { ScenarioProvider } from '../../contexts/ScenarioContext';
import { SaisieModalProvider } from '../../contexts/SaisieModalContext';
import { useMercureSubscription } from '../../hooks/useMercureSubscription';

function MobileLayoutInner() {
  useMercureSubscription();

  return (
    <div className="h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}

export function MobileLayout() {
  return (
    <ThemeProvider>
      <ScenarioProvider defaultMode="prod">
        <SaisieModalProvider>
          <MobileLayoutInner />
        </SaisieModalProvider>
      </ScenarioProvider>
    </ThemeProvider>
  );
}
