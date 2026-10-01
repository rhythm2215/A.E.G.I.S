import { useRef, useCallback } from 'react';
import { SurveillanceNodesPanel } from './components/SurveillanceNodesPanel';
import { IdentitiesPanel } from './components/IdentitiesPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { CentralOperationsView } from './components/CentralOperationsView';
import { NotificationPanel } from './components/NotificationPanel';
import { DetailPanel } from './components/DetailPanel';
import { useUIStore } from '@/store/uiStore';
import { useLayoutStore } from '@/store/layoutStore';
import { GripVertical, GripHorizontal } from 'lucide-react';

export function DashboardPage() {
  const { panelVisibility } = useUIStore();
  const {
    leftSidebarWidth,
    rightSidebarWidth,
    leftRatios,
    rightRatios,
    setLeftSidebarWidth,
    setRightSidebarWidth,
    setLeftRatios,
    setRightRatios,
  } = useLayoutStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  // ── Horizontal Drag: Left Sidebar ──
  const startLeftResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = leftSidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        setLeftSidebarWidth(startWidth + delta);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [leftSidebarWidth, setLeftSidebarWidth]
  );

  // ── Horizontal Drag: Right Sidebar ──
  const startRightResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = rightSidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        setRightSidebarWidth(startWidth + delta);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [rightSidebarWidth, setRightSidebarWidth]
  );

  // ── Vertical Drag: Left Splitter 1 (Between Drone and Suspect) ──
  const startLeftSplitter1 = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!leftColRef.current) return;
      const totalH = leftColRef.current.getBoundingClientRect().height;
      const startY = e.clientY;
      const [r0, r1, r2] = leftRatios;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const deltaPct = (deltaY / totalH) * 100;
        let newR0 = Math.max(15, Math.min(r0 + deltaPct, 60));
        let newR1 = Math.max(15, Math.min(r1 - (newR0 - r0), 60));
        setLeftRatios([newR0, newR1, r2]);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [leftRatios, setLeftRatios]
  );

  // ── Vertical Drag: Left Splitter 2 (Between Suspect and Timeline) ──
  const startLeftSplitter2 = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!leftColRef.current) return;
      const totalH = leftColRef.current.getBoundingClientRect().height;
      const startY = e.clientY;
      const [r0, r1, r2] = leftRatios;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const deltaPct = (deltaY / totalH) * 100;
        let newR1 = Math.max(15, Math.min(r1 + deltaPct, 60));
        let newR2 = Math.max(20, Math.min(r2 - (newR1 - r1), 70));
        setLeftRatios([r0, newR1, newR2]);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [leftRatios, setLeftRatios]
  );

  // ── Vertical Drag: Right Splitter (Between Alerts and Detail) ──
  const startRightSplitter = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!rightColRef.current) return;
      const totalH = rightColRef.current.getBoundingClientRect().height;
      const startY = e.clientY;
      const [r0, r1] = rightRatios;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const deltaPct = (deltaY / totalH) * 100;
        let newR0 = Math.max(20, Math.min(r0 + deltaPct, 70));
        let newR1 = Math.max(20, Math.min(r1 - deltaPct, 70));
        setRightRatios([newR0, newR1]);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [rightRatios, setRightRatios]
  );

  const showLeft = panelVisibility.entityPanel || panelVisibility.timelinePanel;
  const showRight = panelVisibility.notificationPanel || panelVisibility.detailPanel;

  return (
    <div
      ref={containerRef}
      className="w-full h-full px-3 pb-3 flex gap-0 overflow-hidden select-none relative"
    >
      {/* ── LEFT SIDEBAR (Independent Floating Stacked Cards) ── */}
      {showLeft && (
        <>
          <aside
            ref={leftColRef}
            style={{ width: `${leftSidebarWidth}px` }}
            className="shrink-0 h-full flex flex-col gap-2.5 overflow-hidden transition-[width] duration-75"
          >
            {/* Surveillance Nodes Panel Card */}
            {panelVisibility.entityPanel && (
              <SurveillanceNodesPanel style={{ flex: `${leftRatios[0]} 1 0` }} />
            )}

            {/* Vertical Splitter 1 */}
            {panelVisibility.entityPanel && (
              <div
                onMouseDown={startLeftSplitter1}
                className="h-1.5 w-full flex items-center justify-center cursor-row-resize group hover:bg-primary-fixed-dim/30 rounded transition-colors shrink-0"
                title="Drag to resize vertically"
              >
                <div className="w-12 h-1 bg-white/20 group-hover:bg-primary-fixed-dim rounded-full transition-colors" />
              </div>
            )}

            {/* Identities Panel Card (Personnel & Watchlist) */}
            {panelVisibility.entityPanel && (
              <IdentitiesPanel style={{ flex: `${leftRatios[1]} 1 0` }} />
            )}

            {/* Vertical Splitter 2 */}
            {panelVisibility.entityPanel && panelVisibility.timelinePanel && (
              <div
                onMouseDown={startLeftSplitter2}
                className="h-1.5 w-full flex items-center justify-center cursor-row-resize group hover:bg-primary-fixed-dim/30 rounded transition-colors shrink-0"
                title="Drag to resize vertically"
              >
                <div className="w-12 h-1 bg-white/20 group-hover:bg-primary-fixed-dim rounded-full transition-colors" />
              </div>
            )}

            {/* Timeline Panel Card */}
            {panelVisibility.timelinePanel && (
              <TimelinePanel style={{ flex: `${leftRatios[2]} 1 0` }} />
            )}
          </aside>

          {/* ── Horizontal Drag Handle: Left Sidebar | Map Area ── */}
          <div
            onMouseDown={startLeftResize}
            className="w-3.5 h-full flex items-center justify-center cursor-col-resize group shrink-0 z-30 transition-all hover:bg-primary-fixed-dim/10 mx-0.5"
            title="Drag to resize left sidebar"
          >
            <div className="w-1 h-16 bg-white/20 group-hover:bg-primary-fixed-dim group-hover:shadow-ambient-cyan rounded-full transition-all flex items-center justify-center">
              <GripVertical size={10} className="text-white/40 group-hover:text-primary-fixed-dim hidden group-hover:block" />
            </div>
          </div>
        </>
      )}

      {/* ── CENTER WORKSPACE: Central Operations View (Expands Flexibly) ── */}
      <main className="flex-1 h-full min-w-0 flex flex-col overflow-hidden">
        <CentralOperationsView />
      </main>

      {/* ── RIGHT SIDEBAR (Independent Floating Stacked Cards) ── */}
      {showRight && (
        <>
          {/* ── Horizontal Drag Handle: Map Area | Right Sidebar ── */}
          <div
            onMouseDown={startRightResize}
            className="w-3.5 h-full flex items-center justify-center cursor-col-resize group shrink-0 z-30 transition-all hover:bg-primary-fixed-dim/10 mx-0.5"
            title="Drag to resize right sidebar"
          >
            <div className="w-1 h-16 bg-white/20 group-hover:bg-primary-fixed-dim group-hover:shadow-ambient-cyan rounded-full transition-all flex items-center justify-center">
              <GripVertical size={10} className="text-white/40 group-hover:text-primary-fixed-dim hidden group-hover:block" />
            </div>
          </div>

          <aside
            ref={rightColRef}
            style={{ width: `${rightSidebarWidth}px` }}
            className="shrink-0 h-full flex flex-col gap-2.5 overflow-hidden transition-[width] duration-75"
          >
            {/* Real-Time Alerts Card */}
            {panelVisibility.notificationPanel && (
              <NotificationPanel style={{ flex: `${rightRatios[0]} 1 0` }} />
            )}

            {/* Vertical Splitter */}
            {panelVisibility.notificationPanel && panelVisibility.detailPanel && (
              <div
                onMouseDown={startRightSplitter}
                className="h-1.5 w-full flex items-center justify-center cursor-row-resize group hover:bg-primary-fixed-dim/30 rounded transition-colors shrink-0"
                title="Drag to resize vertically"
              >
                <div className="w-12 h-1 bg-white/20 group-hover:bg-primary-fixed-dim rounded-full transition-colors" />
              </div>
            )}

            {/* Intelligence Detail Card */}
            {panelVisibility.detailPanel && (
              <DetailPanel style={{ flex: `${rightRatios[1]} 1 0` }} />
            )}
          </aside>
        </>
      )}
    </div>
  );
}
