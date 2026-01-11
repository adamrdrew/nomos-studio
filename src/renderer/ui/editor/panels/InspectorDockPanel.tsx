import React from 'react';
import { Button, Card, Collapse, H5 } from '@blueprintjs/core';

import { AssetBrowser } from '../inspector/AssetBrowser';
import { useNomosStore } from '../../../store/nomosStore';
import { decodeMapViewModel } from '../map/mapDecoder';

function CollapsibleSection(props: {
  title: string;
  defaultIsOpen?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  const [isOpen, setIsOpen] = React.useState<boolean>(props.defaultIsOpen ?? true);

  return (
    <Card style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px'
        }}
      >
        <H5 style={{ margin: 0 }}>{props.title}</H5>
        <Button
          minimal={true}
          icon={isOpen ? 'chevron-down' : 'chevron-right'}
          onClick={() => setIsOpen((current) => !current)}
        />
      </div>
      <Collapse isOpen={isOpen} keepChildrenMounted={true}>
        <div style={{ padding: 10 }}>{props.children}</div>
      </Collapse>
    </Card>
  );
}

export function InspectorDockPanel(): JSX.Element {
  const openAsset = React.useCallback((relativePath: string) => {
    void (async () => {
      const result = await window.nomos.assets.open({ relativePath });
      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.error('[nomos] open asset failed', result.error);
      }
    })();
  }, []);

  const mapDocument = useNomosStore((state) => state.mapDocument);
  const selection = useNomosStore((state) => state.mapSelection);

  const decodedMap = React.useMemo(() => {
    if (mapDocument === null) {
      return null;
    }
    return decodeMapViewModel(mapDocument.json);
  }, [mapDocument]);

  const selectedObject = React.useMemo(() => {
    if (selection === null || decodedMap === null || !decodedMap.ok) {
      return null;
    }

    const map = decodedMap.value;

    switch (selection.kind) {
      case 'light': {
        const light = map.lights.find((candidate) => candidate.index === selection.index);
        return light ? { title: `Light #${selection.index}`, value: light } : null;
      }
      case 'particle': {
        const particle = map.particles.find((candidate) => candidate.index === selection.index);
        return particle ? { title: `Particle Emitter #${selection.index}`, value: particle } : null;
      }
      case 'entity': {
        const entity = map.entities.find((candidate) => candidate.index === selection.index);
        return entity ? { title: `Entity #${selection.index}`, value: entity } : null;
      }
      case 'door': {
        const door = map.doors.find((candidate) => candidate.id === selection.id);
        return door ? { title: `Door ${selection.id}`, value: door } : null;
      }
      case 'wall': {
        const wall = map.walls.find((candidate) => candidate.index === selection.index);
        return wall ? { title: `Wall #${selection.index}`, value: wall } : null;
      }
      case 'sector': {
        const sector = map.sectors.find((candidate) => candidate.id === selection.id);
        return sector ? { title: `Sector ${selection.id}`, value: sector } : null;
      }
      default: {
        // Exhaustive check.
        const neverSelection: never = selection;
        return neverSelection;
      }
    }
  }, [decodedMap, selection]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        padding: 10,
        boxSizing: 'border-box',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}
    >
      <CollapsibleSection title="Asset Browser" defaultIsOpen={true}>
        <AssetBrowser onOpenFile={openAsset} />
      </CollapsibleSection>

      <CollapsibleSection title="Properties" defaultIsOpen={true}>
        {selectedObject === null ? (
          <div style={{ opacity: 0.7 }}>Nothing selected</div>
        ) : (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedObject.title}</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selectedObject.value, null, 2)}</pre>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
