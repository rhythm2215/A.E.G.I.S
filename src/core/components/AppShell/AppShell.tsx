import { useEffect, type ReactNode } from 'react';
import { TopNavBar } from './TopNavBar';
import { useSuspectStore } from '@/store/suspectStore';

interface AppShellProps {
  children: ReactNode;
  /** When true, the shell has a full-bleed background (dashboard map mode) */
  fullBleed?: boolean;
}

export function AppShell({ children, fullBleed = false }: AppShellProps) {
  const fetchSuspects = useSuspectStore((s) => s.fetchSuspects);

  useEffect(() => {
    fetchSuspects();
  }, [fetchSuspects]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative flex flex-col">
      {/* Fixed navbar — h-14 (56px) + top-3 (12px) = 68px total clearance needed */}
      <TopNavBar />

      {fullBleed ? (
        // Dashboard: full bleed, but still needs to start below the fixed navbar
        // Navbar is fixed top-3 with h-14 = 68px from top of viewport
        <main className="flex-1 relative overflow-hidden pt-[74px]">
          {children}
        </main>
      ) : (
        // Standard pages: padded content area below the fixed navbar
        <main className="flex-1 overflow-hidden pt-[82px] px-panel-gap pb-panel-gap">
          <div className="h-full overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}
