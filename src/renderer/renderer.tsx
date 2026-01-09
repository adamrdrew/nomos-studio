import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Card, H1 } from '@blueprintjs/core';
import { DockviewReact, type DockviewReadyEvent } from 'dockview';
import { create } from 'zustand';
import { Layer, Rect, Stage } from 'react-konva';

import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import 'dockview/dist/styles/dockview.css';

type AppStoreState = {
  title: string;
  incrementClickCount: () => void;
  clickCount: number;
};

const useAppStore = create<AppStoreState>((set) => ({
  title: 'Nomos Studio',
  clickCount: 0,
  incrementClickCount: () => {
    set((currentState) => ({ clickCount: currentState.clickCount + 1 }));
  }
}));

function DockPanel(): JSX.Element {
  return (
    <div style={{ padding: 12 }}>
      <p>DockView panel (bootstrap only)</p>
      <Stage width={260} height={140}>
        <Layer>
          <Rect x={20} y={20} width={120} height={80} fill="#d9822b" cornerRadius={6} />
        </Layer>
      </Stage>
    </div>
  );
}

function App(): JSX.Element {
  const title = useAppStore((state) => state.title);
  const clickCount = useAppStore((state) => state.clickCount);
  const incrementClickCount = useAppStore((state) => state.incrementClickCount);

  const onDockReady = (event: DockviewReadyEvent): void => {
    event.api.addPanel({
      id: 'bootstrap-panel',
      title: 'Bootstrap Panel',
      component: 'dockPanel'
    });
  };

  return (
    <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box' }}>
      <H1>{title}</H1>
      <Card style={{ marginBottom: 12 }}>
        <p>Bootstrap phase: window + UI shell only.</p>
        <Button onClick={incrementClickCount}>Clicks: {clickCount}</Button>
      </Card>

      <div style={{ height: 'calc(100% - 140px)' }}>
        <DockviewReact
          onReady={onDockReady}
          components={{ dockPanel: DockPanel }}
        />
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
