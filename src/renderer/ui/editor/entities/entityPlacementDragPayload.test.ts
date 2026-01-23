import {
  encodeEntityPlacementDragPayload,
  tryDecodeEntityPlacementDragPayload,
  type EntityPlacementDragPayload
} from './entityPlacementDragPayload';

describe('entityPlacementDragPayload', () => {
  describe('encodeEntityPlacementDragPayload', () => {
    it('encodes JSON with a trimmed defName', () => {
      const payload: EntityPlacementDragPayload = { defName: '  Imp  ' };
      expect(encodeEntityPlacementDragPayload(payload)).toBe('{"defName":"Imp"}');
    });
  });

  describe('tryDecodeEntityPlacementDragPayload', () => {
    it('returns null for empty strings', () => {
      expect(tryDecodeEntityPlacementDragPayload('')).toBeNull();
      expect(tryDecodeEntityPlacementDragPayload('   ')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(tryDecodeEntityPlacementDragPayload('{')).toBeNull();
    });

    it('returns null for non-object JSON', () => {
      expect(tryDecodeEntityPlacementDragPayload('[]')).toBeNull();
      expect(tryDecodeEntityPlacementDragPayload('123')).toBeNull();
      expect(tryDecodeEntityPlacementDragPayload('"hi"')).toBeNull();
    });

    it('returns null when defName is missing or not a string', () => {
      expect(tryDecodeEntityPlacementDragPayload('{"nope":1}')).toBeNull();
      expect(tryDecodeEntityPlacementDragPayload('{"defName":123}')).toBeNull();
    });

    it('returns null when defName is empty after trimming', () => {
      expect(tryDecodeEntityPlacementDragPayload('{"defName":"   "}')).toBeNull();
    });

    it('returns payload when valid', () => {
      expect(tryDecodeEntityPlacementDragPayload('{"defName":"Imp"}')).toEqual({ defName: 'Imp' });
    });
  });
});
