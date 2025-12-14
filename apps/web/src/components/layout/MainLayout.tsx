import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useAppDispatch } from '../../store/hooks';
import {
  setLeftPanelCollapsed,
  setRightPanelCollapsed,
} from '../../store/uiSlice';
import { Header } from './Header';
import { LeftPanel } from './LeftPanel';
import { CenterPanel } from './CenterPanel';
import { RightPanel } from './RightPanel';

interface MainLayoutProps {
  leftPanelContent?: ReactNode;
  centerContent?: ReactNode;
  rightPanelContent?: ReactNode;
  className?: string;
}

// Responsive breakpoints
const BREAKPOINTS = {
  sm: 768,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export function MainLayout({
  leftPanelContent,
  centerContent,
  rightPanelContent,
  className,
}: MainLayoutProps) {
  const dispatch = useAppDispatch();

  // Handle responsive panel collapse
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      if (width < BREAKPOINTS.lg) {
        // < 1024px: Both panels collapsed
        dispatch(setLeftPanelCollapsed(true));
        dispatch(setRightPanelCollapsed(true));
      } else if (width < BREAKPOINTS.xl) {
        // < 1280px: Right panel collapsed
        dispatch(setLeftPanelCollapsed(false));
        dispatch(setRightPanelCollapsed(true));
      } else {
        // >= 1280px: All panels visible
        dispatch(setLeftPanelCollapsed(false));
        dispatch(setRightPanelCollapsed(false));
      }
    };

    // Initial check
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  return (
    <div className={cn('h-screen flex flex-col', className)}>
      <Header />
      <div className="flex-1 flex min-h-0">
        <LeftPanel className="hidden md:flex">{leftPanelContent}</LeftPanel>
        <CenterPanel>{centerContent}</CenterPanel>
        <RightPanel className="hidden md:flex">{rightPanelContent}</RightPanel>
      </div>
    </div>
  );
}
