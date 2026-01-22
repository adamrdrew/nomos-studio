import React from 'react';
import { Card, Colors, H5 } from '@blueprintjs/core';

import { MapPropertiesSection } from '../inspector/MapPropertiesSection';

export function MapPropertiesDockPanel(): JSX.Element {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        padding: 10,
        boxSizing: 'border-box',
        overflow: 'auto'
      }}
    >
      <Card style={{ padding: 10, backgroundColor: Colors.DARK_GRAY3, color: Colors.LIGHT_GRAY5 }}>
        <H5 style={{ marginTop: 0, color: Colors.WHITE }}>Map Properties</H5>
        <MapPropertiesSection />
      </Card>
    </div>
  );
}
