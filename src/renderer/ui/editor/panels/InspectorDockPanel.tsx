import React from 'react';
import { Button, Card, Collapse, H5 } from '@blueprintjs/core';

import { AssetBrowser } from '../inspector/AssetBrowser';

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
        <div />
      </CollapsibleSection>
    </div>
  );
}
