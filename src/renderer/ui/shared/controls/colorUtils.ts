export type RgbColor = Readonly<{ r: number; g: number; b: number }>; // 0..255

export type HsvColor = Readonly<{ h: number; s: number; v: number }>; // h: 0..360, s/v: 0..1

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function clampRgb(color: RgbColor): RgbColor {
  return {
    r: Math.round(clamp(color.r, 0, 255)),
    g: Math.round(clamp(color.g, 0, 255)),
    b: Math.round(clamp(color.b, 0, 255))
  };
}

export function toHexByte(value: number): string {
  const rounded = Math.round(clamp(value, 0, 255));
  return rounded.toString(16).padStart(2, '0');
}

export function rgbToHex(color: RgbColor): string {
  const clamped = clampRgb(color);
  return `#${toHexByte(clamped.r)}${toHexByte(clamped.g)}${toHexByte(clamped.b)}`;
}

export function tryParseHexColor(input: string): RgbColor | null {
  const trimmed = input.trim();
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return null;
  }

  return clampRgb({ r, g, b });
}

export function rgbToHsv(color: RgbColor): HsvColor {
  const c = clampRgb(color);
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }

  if (h < 0) {
    h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h: clamp(h, 0, 360), s: clamp(s, 0, 1), v: clamp(v, 0, 1) };
}

export function hsvToRgb(color: HsvColor): RgbColor {
  const h = clamp(color.h, 0, 360);
  const s = clamp(color.s, 0, 1);
  const v = clamp(color.v, 0, 1);

  if (s === 0) {
    const gray = Math.round(v * 255);
    return { r: gray, g: gray, b: gray };
  }

  const sector = (h % 360) / 60;
  const index = Math.floor(sector);
  const fraction = sector - index;

  const p = v * (1 - s);
  const q = v * (1 - s * fraction);
  const t = v * (1 - s * (1 - fraction));

  const toByte = (value: number): number => Math.round(clamp(value * 255, 0, 255));

  switch (index) {
    case 0:
      return { r: toByte(v), g: toByte(t), b: toByte(p) };
    case 1:
      return { r: toByte(q), g: toByte(v), b: toByte(p) };
    case 2:
      return { r: toByte(p), g: toByte(v), b: toByte(t) };
    case 3:
      return { r: toByte(p), g: toByte(q), b: toByte(v) };
    case 4:
      return { r: toByte(t), g: toByte(p), b: toByte(v) };
    default:
      return { r: toByte(v), g: toByte(p), b: toByte(q) };
  }
}
