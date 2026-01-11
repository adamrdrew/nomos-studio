export type MapSelection =
  | Readonly<{ kind: 'light'; index: number }>
  | Readonly<{ kind: 'particle'; index: number }>
  | Readonly<{ kind: 'entity'; index: number }>
  | Readonly<{ kind: 'door'; id: string }>
  | Readonly<{ kind: 'wall'; index: number }>
  | Readonly<{ kind: 'sector'; id: number }>;
