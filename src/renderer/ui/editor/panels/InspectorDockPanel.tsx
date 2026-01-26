import React from 'react';
import { Button, Card, Collapse, Colors, H5 } from '@blueprintjs/core';

import { AssetBrowser } from '../inspector/AssetBrowser';
import { PropertiesEditor, type InspectorSelectionModel } from '../inspector/PropertiesEditor';
import { MapPropertiesSection } from '../inspector/MapPropertiesSection';
import { useNomosStore } from '../../../store/nomosStore';
import { decodeMapViewModel } from '../map/mapDecoder';
import { routeAssetDoubleClick } from '../inspector/assetActionRouter';

function CollapsibleSection(props: {
  title: string;
  defaultIsOpen?: boolean;
  cardStyle?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  children: React.ReactNode;
}): JSX.Element {
  const [isOpen, setIsOpen] = React.useState<boolean>(props.defaultIsOpen ?? true);

  return (
    <Card style={{ padding: 0, ...props.cardStyle }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          ...props.headerStyle
        }}
      >
        <H5 style={{ margin: 0, color: 'inherit' }}>{props.title}</H5>
        <Button
          minimal={true}
          icon={isOpen ? 'chevron-down' : 'chevron-right'}
          style={{ color: 'inherit' }}
          onClick={() => setIsOpen((current) => !current)}
        />
      </div>
      <Collapse isOpen={isOpen} keepChildrenMounted={true}>
        <div style={{ padding: 10, ...props.bodyStyle }}>{props.children}</div>
      </Collapse>
    </Card>
  );
}

export function InspectorDockPanel(): JSX.Element {
  const openJsonEditorTab = useNomosStore((state) => state.openJsonEditorTab);

  const openAsset = React.useCallback((relativePath: string) => {
    void (async () => {
      const action = routeAssetDoubleClick(relativePath);
      if (action.kind === 'open-map-in-editor') {
        const result = await window.nomos.map.openFromAssets({ relativePath: action.relativePath });
        if (!result.ok) {
          // eslint-disable-next-line no-console
          console.error('[nomos] open map from assets failed', result.error);
        }
        return;
      }

      if (action.kind === 'open-json-in-editor') {
        await openJsonEditorTab(action.relativePath);
        return;
      }

      const result = await window.nomos.assets.open({ relativePath: action.relativePath });
      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.error('[nomos] open asset failed', result.error);
      }
    })();
  }, [openJsonEditorTab]);

  const mapDocument = useNomosStore((state) => state.mapDocument);
  const selection = useNomosStore((state) => state.mapSelection);
  const assetIndex = useNomosStore((state) => state.assetIndex);

  const decodedMap = React.useMemo(() => {
    if (mapDocument === null) {
      return null;
    }
    return decodeMapViewModel(mapDocument.json);
  }, [mapDocument]);

  const selectionModel: InspectorSelectionModel | null = React.useMemo(() => {
    if (selection === null || decodedMap === null || !decodedMap.ok) {
      return null;
    }

    const map = decodedMap.value;

    switch (selection.kind) {
      case 'map': {
        return null;
      }
      case 'light': {
        const light = map.lights.find((candidate) => candidate.index === selection.index);
        return light
          ? {
              kind: 'light',
              title: `Light #${selection.index}`,
              value: light,
              target: { kind: 'light', index: selection.index }
            }
          : null;
      }
      case 'particle': {
        const particle = map.particles.find((candidate) => candidate.index === selection.index);
        return particle
          ? {
              kind: 'particle',
              title: `Particle Emitter #${selection.index}`,
              value: particle,
              target: { kind: 'particle', index: selection.index }
            }
          : null;
      }
      case 'entity': {
        const entity = map.entities.find((candidate) => candidate.index === selection.index);
        return entity
          ? {
              kind: 'entity',
              title: `Entity #${selection.index}`,
              value: entity,
              target: { kind: 'entity', index: selection.index }
            }
          : null;
      }
      case 'door': {
        const door = map.doors.find((candidate) => candidate.id === selection.id);
        return door
          ? {
              kind: 'door',
              title: `Door ${selection.id}`,
              value: door,
              target: { kind: 'door', id: selection.id }
            }
          : null;
      }
      case 'wall': {
        const wall = map.walls.find((candidate) => candidate.index === selection.index);
        return wall
          ? {
              kind: 'wall',
              title: `Wall #${selection.index}`,
              value: wall,
              target: { kind: 'wall', index: selection.index }
            }
          : null;
      }
      case 'sector': {
        const sector = map.sectors.find((candidate) => candidate.id === selection.id);
        return sector
          ? {
              kind: 'sector',
              title: `Sector ${selection.id}`,
              value: sector,
              target: { kind: 'sector', id: selection.id }
            }
          : null;
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
      <CollapsibleSection
        title="Asset Browser"
        defaultIsOpen={true}
        cardStyle={{ backgroundColor: Colors.DARK_GRAY3 }}
        headerStyle={{ backgroundColor: Colors.DARK_GRAY2, color: Colors.WHITE }}
        bodyStyle={{ backgroundColor: Colors.DARK_GRAY3, color: Colors.LIGHT_GRAY5 }}
      >
        <AssetBrowser onOpenFile={openAsset} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Object Properties"
        defaultIsOpen={true}
        cardStyle={{ backgroundColor: Colors.DARK_GRAY3 }}
        headerStyle={{ backgroundColor: Colors.DARK_GRAY2, color: Colors.WHITE }}
        bodyStyle={{ backgroundColor: Colors.DARK_GRAY3, color: Colors.LIGHT_GRAY5 }}
      >
        <PropertiesEditor
          mapDocument={mapDocument}
          assetIndex={assetIndex}
          selection={selectionModel}
          availableSectorIds={decodedMap && decodedMap.ok ? decodedMap.value.sectors.map((sector) => sector.id) : []}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Map Properties"
        defaultIsOpen={true}
        cardStyle={{ backgroundColor: Colors.DARK_GRAY3 }}
        headerStyle={{ backgroundColor: Colors.DARK_GRAY2, color: Colors.WHITE }}
        bodyStyle={{ backgroundColor: Colors.DARK_GRAY3, color: Colors.LIGHT_GRAY5 }}
      >
        <MapPropertiesSection />
      </CollapsibleSection>
    </div>
  );
}
