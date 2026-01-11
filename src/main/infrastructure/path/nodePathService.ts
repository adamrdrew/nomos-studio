import path from 'path';

import type { PathService } from '../../application/assets/OpenAssetService';

export const nodePathService: PathService = {
  isAbsolute: (value) => path.isAbsolute(value),
  resolve: (...segments) => path.resolve(...segments),
  relative: (from, to) => path.relative(from, to)
};
