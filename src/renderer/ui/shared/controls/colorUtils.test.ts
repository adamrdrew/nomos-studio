import { clampRgb, hsvToRgb, rgbToHex, rgbToHsv, toHexByte, tryParseHexColor } from './colorUtils';

describe('colorUtils', () => {
  describe('clampRgb', () => {
    it('clamps and rounds channel values to 0..255', () => {
      expect(clampRgb({ r: -1, g: 256, b: 12.4 })).toEqual({ r: 0, g: 255, b: 12 });
      expect(clampRgb({ r: 12.5, g: 12.6, b: 12.49 })).toEqual({ r: 13, g: 13, b: 12 });
    });

    it('treats non-finite channel values as 0', () => {
      expect(clampRgb({ r: Number.NaN, g: Number.POSITIVE_INFINITY, b: Number.NEGATIVE_INFINITY })).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('toHexByte', () => {
    it('formats a byte as a two-digit lowercase hex string', () => {
      expect(toHexByte(0)).toBe('00');
      expect(toHexByte(1)).toBe('01');
      expect(toHexByte(15)).toBe('0f');
      expect(toHexByte(255)).toBe('ff');
    });

    it('clamps and rounds inputs into the 0..255 range', () => {
      expect(toHexByte(-1)).toBe('00');
      expect(toHexByte(256)).toBe('ff');
      expect(toHexByte(12.4)).toBe('0c');
      expect(toHexByte(12.6)).toBe('0d');
    });

    it('treats non-finite inputs as 0', () => {
      expect(toHexByte(Number.NaN)).toBe('00');
      expect(toHexByte(Number.POSITIVE_INFINITY)).toBe('00');
    });
  });

  describe('rgbToHex', () => {
    it('returns a #RRGGBB string after clamping', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe('#ff0080');
      expect(rgbToHex({ r: -1, g: 999, b: 1 })).toBe('#00ff01');
    });

    it('treats non-finite channels as 0', () => {
      expect(rgbToHex({ r: Number.NaN, g: 1, b: 2 })).toBe('#000102');
    });
  });

  describe('tryParseHexColor', () => {
    it('parses 6-digit hex with or without a leading #', () => {
      expect(tryParseHexColor('#ff0080')).toEqual({ r: 255, g: 0, b: 128 });
      expect(tryParseHexColor('ff0080')).toEqual({ r: 255, g: 0, b: 128 });
      expect(tryParseHexColor('  ff0080  ')).toEqual({ r: 255, g: 0, b: 128 });
      expect(tryParseHexColor('#FF0080')).toEqual({ r: 255, g: 0, b: 128 });
    });

    it('returns null for invalid inputs', () => {
      expect(tryParseHexColor('')).toBeNull();
      expect(tryParseHexColor('#fff')).toBeNull();
      expect(tryParseHexColor('#ff008')).toBeNull();
      expect(tryParseHexColor('#ff00800')).toBeNull();
      expect(tryParseHexColor('#gg0080')).toBeNull();
    });
  });

  describe('rgbToHsv', () => {
    it('converts primary colors to expected HSV values', () => {
      expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
      expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 1, v: 1 });
      expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 1, v: 1 });
    });

    it('produces s=0 for grays', () => {
      const hsv = rgbToHsv({ r: 128, g: 128, b: 128 });
      expect(hsv.s).toBe(0);
      expect(hsv.v).toBeCloseTo(128 / 255, 8);
      expect(hsv.h).toBe(0);
    });

    it('treats non-finite channels as 0', () => {
      expect(rgbToHsv({ r: Number.NaN, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
    });
  });

  describe('hsvToRgb', () => {
    it('converts known HSV values to expected RGB values', () => {
      expect(hsvToRgb({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
      expect(hsvToRgb({ h: 120, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 0 });
      expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('covers remaining hsv sectors (switch branches)', () => {
      // index 1
      expect(hsvToRgb({ h: 60, s: 1, v: 1 })).toEqual({ r: 255, g: 255, b: 0 });
      // index 3
      expect(hsvToRgb({ h: 180, s: 1, v: 1 })).toEqual({ r: 0, g: 255, b: 255 });
      // index 5 (default branch)
      expect(hsvToRgb({ h: 300, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 255 });
    });

    it('returns grayscale when s is 0', () => {
      expect(hsvToRgb({ h: 123, s: 0, v: 0.5 })).toEqual({ r: 128, g: 128, b: 128 });
    });

    it('clamps non-finite inputs to a safe range', () => {
      expect(hsvToRgb({ h: Number.NaN, s: Number.NaN, v: Number.NaN })).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('rgbToHsv -> hsvToRgb roundtrip', () => {
    it('roundtrips approximately for typical colors', () => {
      const input = { r: 12, g: 200, b: 180 };
      const roundTrip = hsvToRgb(rgbToHsv(input));
      expect(roundTrip.r).toBeCloseTo(input.r, 0);
      expect(roundTrip.g).toBeCloseTo(input.g, 0);
      expect(roundTrip.b).toBeCloseTo(input.b, 0);
    });
  });

  describe('rgbToHsv hue wrapping', () => {
    it('wraps negative hue values into [0,360)', () => {
      // For max=r with g<b, the raw hue is negative and should wrap up near 360.
      const hsv = rgbToHsv({ r: 255, g: 0, b: 1 });
      expect(hsv.h).toBeGreaterThan(359);
      expect(hsv.h).toBeLessThanOrEqual(360);
      expect(hsv.s).toBeGreaterThan(0.99);
      expect(hsv.v).toBe(1);
    });
  });
});
