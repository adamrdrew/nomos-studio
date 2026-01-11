import React from 'react';
import { Icon } from '@blueprintjs/core';
import type { IconName } from '@blueprintjs/icons';

import { useNomosStore } from '../../../store/nomosStore';

type AssetTreeDirectoryNode = {
  readonly kind: 'directory';
  readonly name: string;
  readonly children: readonly AssetTreeNode[];
};

type AssetTreeFileNode = {
  readonly kind: 'file';
  readonly name: string;
  readonly relativePath: string;
};

type AssetTreeNode = AssetTreeDirectoryNode | AssetTreeFileNode;

type MutableDirectory = {
  readonly kind: 'directory';
  readonly name: string;
  readonly childrenByName: Map<string, MutableNode>;
};

type MutableFile = {
  readonly kind: 'file';
  readonly name: string;
  readonly relativePath: string;
};

type MutableNode = MutableDirectory | MutableFile;

function getFileIconName(fileName: string): IconName {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.json')) {
    return 'code';
  }

  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif')) {
    return 'media';
  }

  if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
    return 'music';
  }

  if (lower.endsWith('.sf2')) {
    return 'music';
  }

  return 'document';
}

function compareNamesCaseInsensitive(first: string, second: string): number {
  return first.localeCompare(second, undefined, { sensitivity: 'base' });
}

function sortNodes(nodes: readonly AssetTreeNode[]): readonly AssetTreeNode[] {
  const copy = [...nodes];
  copy.sort((first, second) => {
    if (first.kind !== second.kind) {
      return first.kind === 'directory' ? -1 : 1;
    }
    return compareNamesCaseInsensitive(first.name, second.name);
  });
  return copy;
}

function freezeTree(node: MutableNode): AssetTreeNode {
  if (node.kind === 'file') {
    return { kind: 'file', name: node.name, relativePath: node.relativePath };
  }

  const children = sortNodes([...node.childrenByName.values()].map(freezeTree));
  return { kind: 'directory', name: node.name, children };
}

function buildTree(entries: readonly string[]): AssetTreeDirectoryNode {
  const root: MutableDirectory = {
    kind: 'directory',
    name: '',
    childrenByName: new Map()
  };

  for (const relativePath of entries) {
    const cleaned = relativePath.replaceAll('\\', '/');
    const parts = cleaned.split('/').filter((segment) => segment.trim().length > 0);
    if (parts.length === 0) {
      continue;
    }

    let current = root;
    for (const [partIndex, segment] of parts.entries()) {
      const isLast = partIndex === parts.length - 1;

      if (isLast) {
        current.childrenByName.set(segment, {
          kind: 'file',
          name: segment,
          relativePath: cleaned
        });
      } else {
        const existing = current.childrenByName.get(segment);
        if (existing !== undefined && existing.kind === 'directory') {
          current = existing;
        } else {
          const created: MutableDirectory = {
            kind: 'directory',
            name: segment,
            childrenByName: new Map()
          };
          current.childrenByName.set(segment, created);
          current = created;
        }
      }
    }
  }

  const frozen = freezeTree(root);
  if (frozen.kind !== 'directory') {
    throw new Error('Expected asset tree root to be a directory');
  }

  return frozen;
}

function NodeRow(props: {
  node: AssetTreeNode;
  depth: number;
  isExpanded?: boolean;
  onToggleDirectory?: () => void;
  onOpenFile?: (relativePath: string) => void;
}): JSX.Element {
  const paddingLeft = 8 + props.depth * 14;

  if (props.node.kind === 'directory') {
    const iconName: IconName = props.isExpanded ? 'folder-open' : 'folder-close';
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={props.onToggleDirectory}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            props.onToggleDirectory?.();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 6px',
          paddingLeft,
          userSelect: 'none',
          cursor: 'default'
        }}
      >
        <Icon icon={iconName} size={14} />
        <span>{props.node.name}</span>
      </div>
    );
  }

  const iconName = getFileIconName(props.node.name);
  const relativePath = props.node.relativePath;
  return (
    <div
      role="button"
      tabIndex={0}
      onDoubleClick={() => props.onOpenFile?.(relativePath)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 6px',
        paddingLeft,
        userSelect: 'none',
        cursor: 'default'
      }}
    >
      <Icon icon={iconName} size={14} />
      <span>{props.node.name}</span>
    </div>
  );
}

export function AssetBrowser(props: { onOpenFile: (relativePath: string) => void }): JSX.Element {
  const settings = useNomosStore((state) => state.settings);
  const assetIndex = useNomosStore((state) => state.assetIndex);

  const [expandedDirs, setExpandedDirs] = React.useState<ReadonlySet<string>>(() => new Set(['']));

  const assetsDirPath = settings.assetsDirPath;
  const isAssetsConfigured = assetsDirPath !== null && assetsDirPath.trim().length > 0;

  const refreshFromMain = useNomosStore((state) => state.refreshFromMain);
  const [hasRequestedIndexRefresh, setHasRequestedIndexRefresh] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isAssetsConfigured) {
      return;
    }

    if (assetIndex !== null) {
      return;
    }

    if (hasRequestedIndexRefresh) {
      return;
    }

    setHasRequestedIndexRefresh(true);

    void (async () => {
      await window.nomos.assets.refreshIndex();
      await refreshFromMain();
    })();
  }, [assetIndex, hasRequestedIndexRefresh, isAssetsConfigured, refreshFromMain]);

  if (!isAssetsConfigured) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 0' }}>
        <div style={{ textAlign: 'center' }}>Configure Assets in Settings</div>
      </div>
    );
  }

  if (assetIndex === null) {
    return <div>Loading…</div>;
  }

  const tree = buildTree(assetIndex.entries);

  const toggleDir = (pathKey: string): void => {
    setExpandedDirs((current) => {
      const next = new Set(current);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  const rows: JSX.Element[] = [];

  const walk = (node: AssetTreeDirectoryNode, pathKey: string, depth: number): void => {
    const children = node.children;
    for (const child of children) {
      if (child.kind === 'directory') {
        const childKey = pathKey.length === 0 ? child.name : `${pathKey}/${child.name}`;
        const isExpanded = expandedDirs.has(childKey);

        rows.push(
          <NodeRow
            key={`dir-${childKey}`}
            node={child}
            depth={depth}
            isExpanded={isExpanded}
            onToggleDirectory={() => toggleDir(childKey)}
          />
        );

        if (isExpanded) {
          walk(child, childKey, depth + 1);
        }
      } else {
        rows.push(
          <NodeRow
            key={`file-${child.relativePath}`}
            node={child}
            depth={depth}
            onOpenFile={props.onOpenFile}
          />
        );
      }
    }
  };

  walk(tree, '', 0);

  return <div>{rows}</div>;
}
