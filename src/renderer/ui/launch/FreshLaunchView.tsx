import React from 'react';

import { Card, H2, H3 } from '@blueprintjs/core';

import type { EditorSettings } from '../../../shared/domain/models';

export type FreshLaunchViewProps = Readonly<{
  settings: EditorSettings;
  recentMapPaths: readonly string[];
  onCreateNew: () => void;
  onOpenExisting: () => void;
  onOpenRecentMap: (mapPath: string) => void;
}>;

export function FreshLaunchView(props: FreshLaunchViewProps): JSX.Element {
  const isConfigured = props.settings.assetsDirPath !== null && props.settings.gameExecutablePath !== null;

  return (
    <div className="nomos-fresh-launch">
      <div className="nomos-fresh-launch__top">
        <div className="nomos-fresh-launch__brand">Nomos Studio</div>
      </div>

      <div className="nomos-fresh-launch__center">
        <div className="nomos-fresh-launch__content">
          {!isConfigured ? (
            <div className="nomos-fresh-launch__warning">
              Editor not configured yet. Set your Assets directory and Game executable in Settings (CommandOrControl+,).
            </div>
          ) : null}

          <div className="nomos-fresh-launch__tiles">
            <Card
              interactive={true}
              className="nomos-fresh-launch__tile"
              onClick={() => props.onCreateNew()}
            >
              <H2 style={{ marginTop: 0, marginBottom: 6 }}>Create New</H2>
              <div className="nomos-fresh-launch__tileSubtitle">Create a new map backed by a file</div>
            </Card>

            <Card
              interactive={true}
              className="nomos-fresh-launch__tile"
              onClick={() => props.onOpenExisting()}
            >
              <H2 style={{ marginTop: 0, marginBottom: 6 }}>Open Existing</H2>
              <div className="nomos-fresh-launch__tileSubtitle">Open an existing map JSON file</div>
            </Card>
          </div>

          <div className="nomos-fresh-launch__recent">
            <H3 style={{ margin: '0 0 10px 0' }}>Recent Maps</H3>

            {props.recentMapPaths.length === 0 ? (
              <div className="nomos-fresh-launch__recentEmpty">No recent maps</div>
            ) : (
              <div className="nomos-fresh-launch__recentList">
                {props.recentMapPaths.map((mapPath) => (
                  <button
                    key={mapPath}
                    className="nomos-fresh-launch__recentItem"
                    type="button"
                    onClick={() => props.onOpenRecentMap(mapPath)}
                    title={mapPath}
                  >
                    {mapPath}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
