import type { Result } from '../../../../shared/domain/results';

import type {
  MapDecodeError,
  MapDecodeResult,
  MapDoor,
  MapEntityPlacement,
  MapLight,
  MapParticleEmitter,
  MapSector,
  MapVertex,
  MapViewModel,
  MapWall,
  RgbColor
} from './mapViewModel';

function err(message: string): Result<never, MapDecodeError> {
  return { ok: false, error: { kind: 'map-decode-error', message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown, context: string): Result<readonly unknown[], MapDecodeError> {
  if (!Array.isArray(value)) {
    return err(`${context} must be an array`);
  }
  return { ok: true, value };
}

function asNumber(value: unknown, context: string): Result<number, MapDecodeError> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return err(`${context} must be a finite number`);
  }
  return { ok: true, value };
}

function asInt(value: unknown, context: string): Result<number, MapDecodeError> {
  const num = asNumber(value, context);
  if (!num.ok) {
    return num;
  }
  if (!Number.isInteger(num.value)) {
    return err(`${context} must be an integer`);
  }
  return num;
}

function asOptionalInt(value: unknown, context: string): Result<number | null, MapDecodeError> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  return asInt(value, context);
}

function asString(value: unknown, context: string): Result<string, MapDecodeError> {
  if (typeof value !== 'string') {
    return err(`${context} must be a string`);
  }
  if (value.trim().length === 0) {
    return err(`${context} must be a non-empty string`);
  }
  return { ok: true, value };
}

function asOptionalString(value: unknown, context: string): Result<string | null, MapDecodeError> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return err(`${context} must be a string when present`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  return { ok: true, value: trimmed };
}

function asOptionalBoolean(value: unknown, defaultValue: boolean, context: string): Result<boolean, MapDecodeError> {
  if (value === undefined || value === null) {
    return { ok: true, value: defaultValue };
  }
  if (typeof value !== 'boolean') {
    return err(`${context} must be a boolean when present`);
  }
  return { ok: true, value };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function colorFromHexString(raw: string): Result<RgbColor, MapDecodeError> {
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return err(`lights[].color must be a hex string like RRGGBB or #RRGGBB`);
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { ok: true, value: { r, g, b } };
}

function colorFromLegacyObject(value: Record<string, unknown>): Result<RgbColor, MapDecodeError> {
  const r = asNumber(value['r'], 'lights[].color.r');
  if (!r.ok) {
    return r;
  }
  const g = asNumber(value['g'], 'lights[].color.g');
  if (!g.ok) {
    return g;
  }
  const b = asNumber(value['b'], 'lights[].color.b');
  if (!b.ok) {
    return b;
  }

  const maxComponent = Math.max(r.value, g.value, b.value);
  const scale = maxComponent <= 1 ? 255 : 1;

  return {
    ok: true,
    value: {
      r: clamp(r.value * scale, 0, 255),
      g: clamp(g.value * scale, 0, 255),
      b: clamp(b.value * scale, 0, 255)
    }
  };
}

function decodeVertex(value: unknown, index: number): Result<MapVertex, MapDecodeError> {
  if (!isRecord(value)) {
    return err(`vertices[${index}] must be an object`);
  }

  const x = asNumber(value['x'], `vertices[${index}].x`);
  if (!x.ok) {
    return x;
  }
  const y = asNumber(value['y'], `vertices[${index}].y`);
  if (!y.ok) {
    return y;
  }

  return { ok: true, value: { x: x.value, y: y.value } };
}

function decodeSector(value: unknown, index: number): Result<MapSector, MapDecodeError> {
  if (!isRecord(value)) {
    return err(`sectors[${index}] must be an object`);
  }

  const id = asInt(value['id'], `sectors[${index}].id`);
  if (!id.ok) {
    return id;
  }

  const floorZ = asNumber(value['floor_z'], `sectors[${index}].floor_z`);
  if (!floorZ.ok) {
    return floorZ;
  }

  const floorZToggledPos = asOptionalInt(value['floor_z_toggled_pos'], `sectors[${index}].floor_z_toggled_pos`);
  if (!floorZToggledPos.ok) {
    return floorZToggledPos;
  }

  const ceilZ = asNumber(value['ceil_z'], `sectors[${index}].ceil_z`);
  if (!ceilZ.ok) {
    return ceilZ;
  }

  const floorTex = asString(value['floor_tex'], `sectors[${index}].floor_tex`);
  if (!floorTex.ok) {
    return floorTex;
  }

  const ceilTex = asString(value['ceil_tex'], `sectors[${index}].ceil_tex`);
  if (!ceilTex.ok) {
    return ceilTex;
  }

  const light = asNumber(value['light'], `sectors[${index}].light`);
  if (!light.ok) {
    return light;
  }

  return {
    ok: true,
    value: {
      id: id.value,
      floorZ: floorZ.value,
      floorZToggledPos: floorZToggledPos.value,
      ceilZ: ceilZ.value,
      floorTex: floorTex.value,
      ceilTex: ceilTex.value,
      light: light.value
    }
  };
}

function decodeWall(value: unknown, index: number): Result<MapWall, MapDecodeError> {
  if (!isRecord(value)) {
    return err(`walls[${index}] must be an object`);
  }

  const v0 = asInt(value['v0'], `walls[${index}].v0`);
  if (!v0.ok) {
    return v0;
  }

  const v1 = asInt(value['v1'], `walls[${index}].v1`);
  if (!v1.ok) {
    return v1;
  }

  const frontSector = asInt(value['front_sector'], `walls[${index}].front_sector`);
  if (!frontSector.ok) {
    return frontSector;
  }

  const backSector = asInt(value['back_sector'], `walls[${index}].back_sector`);
  if (!backSector.ok) {
    return backSector;
  }

  const tex = asString(value['tex'], `walls[${index}].tex`);
  if (!tex.ok) {
    return tex;
  }

  const endLevel = asOptionalBoolean(value['end_level'], false, `walls[${index}].end_level`);
  if (!endLevel.ok) {
    return endLevel;
  }

  const toggleSector = asOptionalBoolean(value['toggle_sector'], false, `walls[${index}].toggle_sector`);
  if (!toggleSector.ok) {
    return toggleSector;
  }

  const toggleSectorId = asOptionalInt(value['toggle_sector_id'], `walls[${index}].toggle_sector_id`);
  if (!toggleSectorId.ok) {
    return toggleSectorId;
  }

  const toggleSectorOneshot = asOptionalBoolean(
    value['toggle_sector_oneshot'],
    false,
    `walls[${index}].toggle_sector_oneshot`
  );
  if (!toggleSectorOneshot.ok) {
    return toggleSectorOneshot;
  }

  const toggleSound = asOptionalString(value['toggle_sound'], `walls[${index}].toggle_sound`);
  if (!toggleSound.ok) {
    return toggleSound;
  }

  const toggleSoundFinish = asOptionalString(value['toggle_sound_finish'], `walls[${index}].toggle_sound_finish`);
  if (!toggleSoundFinish.ok) {
    return toggleSoundFinish;
  }

  return {
    ok: true,
    value: {
      index,
      v0: v0.value,
      v1: v1.value,
      frontSector: frontSector.value,
      backSector: backSector.value,
      tex: tex.value,
      endLevel: endLevel.value,
      toggleSector: toggleSector.value,
      toggleSectorId: toggleSectorId.value,
      toggleSectorOneshot: toggleSectorOneshot.value,
      toggleSound: toggleSound.value,
      toggleSoundFinish: toggleSoundFinish.value
    }
  };
}

function decodeDoor(value: unknown, index: number): Result<MapDoor, MapDecodeError> {
  if (!isRecord(value)) {
    return err(`doors[${index}] must be an object`);
  }

  const id = asString(value['id'], `doors[${index}].id`);
  if (!id.ok) {
    return id;
  }

  const wallIndex = asInt(value['wall_index'], `doors[${index}].wall_index`);
  if (!wallIndex.ok) {
    return wallIndex;
  }

  const tex = asString(value['tex'], `doors[${index}].tex`);
  if (!tex.ok) {
    return tex;
  }

  const startsClosed = asOptionalBoolean(value['starts_closed'], true, `doors[${index}].starts_closed`);
  if (!startsClosed.ok) {
    return startsClosed;
  }

  const requiredItem = asOptionalString(value['required_item'], `doors[${index}].required_item`);
  if (!requiredItem.ok) {
    return requiredItem;
  }

  const requiredItemMissingMessage = asOptionalString(
    value['required_item_missing_message'],
    `doors[${index}].required_item_missing_message`
  );
  if (!requiredItemMissingMessage.ok) {
    return requiredItemMissingMessage;
  }

  return {
    ok: true,
    value: {
      id: id.value,
      wallIndex: wallIndex.value,
      tex: tex.value,
      startsClosed: startsClosed.value,
      requiredItem: requiredItem.value,
      requiredItemMissingMessage: requiredItemMissingMessage.value
    }
  };
}

function decodeLight(value: unknown, index: number): Result<MapLight, MapDecodeError> {
  if (!isRecord(value)) {
    return err(`lights[${index}] must be an object`);
  }

  const x = asNumber(value['x'], `lights[${index}].x`);
  if (!x.ok) {
    return x;
  }

  const y = asNumber(value['y'], `lights[${index}].y`);
  if (!y.ok) {
    return y;
  }

  const radius = asNumber(value['radius'], `lights[${index}].radius`);
  if (!radius.ok) {
    return radius;
  }

  const intensityRaw = value['intensity'] ?? value['brightness'];
  const intensity = asNumber(intensityRaw, `lights[${index}].intensity|brightness`);
  if (!intensity.ok) {
    return intensity;
  }

  let color: RgbColor = { r: 255, g: 255, b: 255 };
  if (value['color'] !== undefined) {
    const colorValue = value['color'];
    if (typeof colorValue === 'string') {
      const parsed = colorFromHexString(colorValue);
      if (!parsed.ok) {
        return parsed;
      }
      color = parsed.value;
    } else if (isRecord(colorValue)) {
      const parsed = colorFromLegacyObject(colorValue);
      if (!parsed.ok) {
        return parsed;
      }
      color = parsed.value;
    } else {
      return err(`lights[${index}].color must be a hex string or legacy {r,g,b} object`);
    }
  }

  return {
    ok: true,
    value: {
      index,
      x: x.value,
      y: y.value,
      radius: radius.value,
      intensity: intensity.value,
      color
    }
  };
}

function decodeParticle(value: unknown, index: number): Result<MapParticleEmitter, MapDecodeError> {
  if (!isRecord(value)) {
    return err(`particles[${index}] must be an object`);
  }

  const x = asNumber(value['x'], `particles[${index}].x`);
  if (!x.ok) {
    return x;
  }

  const y = asNumber(value['y'], `particles[${index}].y`);
  if (!y.ok) {
    return y;
  }

  return { ok: true, value: { index, x: x.value, y: y.value } };
}

function decodeEntity(value: unknown, index: number): Result<MapEntityPlacement, MapDecodeError> {
  if (!isRecord(value)) {
    return err(`entities[${index}] must be an object`);
  }

  const x = asNumber(value['x'], `entities[${index}].x`);
  if (!x.ok) {
    return x;
  }

  const y = asNumber(value['y'], `entities[${index}].y`);
  if (!y.ok) {
    return y;
  }

  const yawDeg =
    value['yaw_deg'] === undefined ? { ok: true as const, value: 0 } : asNumber(value['yaw_deg'], `entities[${index}].yaw_deg`);
  if (!yawDeg.ok) {
    return yawDeg;
  }

  const defName = asOptionalString(value['def'], `entities[${index}].def`);
  if (!defName.ok) {
    return defName;
  }

  return {
    ok: true,
    value: {
      index,
      x: x.value,
      y: y.value,
      defName: defName.value,
      yawDeg: yawDeg.value
    }
  };
}

export function decodeMapViewModel(json: unknown): MapDecodeResult {
  if (!isRecord(json)) {
    return err('Map JSON must be an object');
  }

  const sky = asOptionalString(json['sky'], 'sky');
  if (!sky.ok) {
    return sky;
  }

  const verticesRaw = asArray(json['vertices'], 'vertices');
  if (!verticesRaw.ok) {
    return verticesRaw;
  }

  const sectorsRaw = asArray(json['sectors'], 'sectors');
  if (!sectorsRaw.ok) {
    return sectorsRaw;
  }

  const wallsRaw = asArray(json['walls'], 'walls');
  if (!wallsRaw.ok) {
    return wallsRaw;
  }

  const vertices: MapVertex[] = [];
  for (let index = 0; index < verticesRaw.value.length; index += 1) {
    const decoded = decodeVertex(verticesRaw.value[index], index);
    if (!decoded.ok) {
      return decoded;
    }
    vertices.push(decoded.value);
  }

  const sectors: MapSector[] = [];
  for (let index = 0; index < sectorsRaw.value.length; index += 1) {
    const decoded = decodeSector(sectorsRaw.value[index], index);
    if (!decoded.ok) {
      return decoded;
    }
    sectors.push(decoded.value);
  }

  const walls: MapWall[] = [];
  for (let index = 0; index < wallsRaw.value.length; index += 1) {
    const decoded = decodeWall(wallsRaw.value[index], index);
    if (!decoded.ok) {
      return decoded;
    }
    walls.push(decoded.value);
  }

  const doorsRaw =
    json['doors'] === undefined
      ? ({ ok: true as const, value: [] as readonly unknown[] })
      : asArray(json['doors'], 'doors');
  if (!doorsRaw.ok) {
    return doorsRaw;
  }

  const doors: MapDoor[] = [];
  for (let index = 0; index < doorsRaw.value.length; index += 1) {
    const decoded = decodeDoor(doorsRaw.value[index], index);
    if (!decoded.ok) {
      return decoded;
    }
    doors.push(decoded.value);
  }

  const lightsRaw =
    json['lights'] === undefined
      ? ({ ok: true as const, value: [] as readonly unknown[] })
      : asArray(json['lights'], 'lights');
  if (!lightsRaw.ok) {
    return lightsRaw;
  }

  const lights: MapLight[] = [];
  for (let index = 0; index < lightsRaw.value.length; index += 1) {
    const decoded = decodeLight(lightsRaw.value[index], index);
    if (!decoded.ok) {
      return decoded;
    }
    lights.push(decoded.value);
  }

  const particlesRaw =
    json['particles'] === undefined
      ? ({ ok: true as const, value: [] as readonly unknown[] })
      : asArray(json['particles'], 'particles');
  if (!particlesRaw.ok) {
    return particlesRaw;
  }

  const particles: MapParticleEmitter[] = [];
  for (let index = 0; index < particlesRaw.value.length; index += 1) {
    const decoded = decodeParticle(particlesRaw.value[index], index);
    if (!decoded.ok) {
      return decoded;
    }
    particles.push(decoded.value);
  }

  const entitiesRaw =
    json['entities'] === undefined
      ? ({ ok: true as const, value: [] as readonly unknown[] })
      : asArray(json['entities'], 'entities');
  if (!entitiesRaw.ok) {
    return entitiesRaw;
  }

  const entities: MapEntityPlacement[] = [];
  for (let index = 0; index < entitiesRaw.value.length; index += 1) {
    const decoded = decodeEntity(entitiesRaw.value[index], index);
    if (!decoded.ok) {
      return decoded;
    }
    entities.push(decoded.value);
  }

  const viewModel: MapViewModel = {
    sky: sky.value,
    vertices,
    sectors,
    walls,
    doors,
    lights,
    particles,
    entities
  };

  return { ok: true, value: viewModel };
}
