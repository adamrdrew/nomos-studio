import { parseEntityManifestFiles } from './entityManifestParser';

describe('parseEntityManifestFiles', () => {
  it('parses the primary supported shape: { files: string[] }', () => {
    const result = parseEntityManifestFiles({
      files: ['defs/shambler.json', ' defs/imp.json ', '', 'defs/shambler.json']
    });

    expect(result).toEqual(['defs/imp.json', 'defs/shambler.json']);
  });

  it('parses a raw array of strings as a back-compat shape', () => {
    const result = parseEntityManifestFiles(['b.json', ' a.json ', '']);
    expect(result).toEqual(['a.json', 'b.json']);
  });

  it('parses { entities: [...] } back-compat shape', () => {
    const result = parseEntityManifestFiles({ entities: ['defs/z.json', 'defs/a.json'] });
    expect(result).toEqual(['defs/a.json', 'defs/z.json']);
  });

  it('parses { defs: [...] } back-compat shape including object entries', () => {
    const result = parseEntityManifestFiles({
      defs: [
        { def: 'defs/aaa.json' },
        { name: 'defs/bbb.json' },
        { id: 'defs/ccc.json' },
        { def: '  ' },
        123
      ]
    });

    expect(result).toEqual(['defs/aaa.json', 'defs/bbb.json', 'defs/ccc.json']);
  });

  it('returns an empty list for unsupported shapes', () => {
    expect(parseEntityManifestFiles(null)).toEqual([]);
    expect(parseEntityManifestFiles('nope')).toEqual([]);
    expect(parseEntityManifestFiles({ files: 'not-an-array' })).toEqual([]);
  });
});
