/*
  App shell layout (CLAUDE.md §10): top bar, then [tool rail | canvas | right panel],
  then status bar. The canvas is the hero; the chrome (quiet "drafting desk", §2)
  frames it.
*/
import { TopBar } from './TopBar';
import { ToolRail } from './ToolRail';
import { RightPanel } from './RightPanel';
import { StatusBar } from './StatusBar';
import { MapCanvas } from './MapCanvas';

export function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-desk-950 text-ink-200">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <main className="relative min-w-0 flex-1">
          <MapCanvas />
        </main>
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  );
}
