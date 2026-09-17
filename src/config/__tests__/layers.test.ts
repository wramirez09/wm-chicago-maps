import {
  FOCUS_ZOOM,
  LAYER_ACCENT,
  LAYER_LABEL,
  LAYER_ORDER,
  LIVE_LAYERS,
} from '../layers';

describe('layer config', () => {
  it('lists every layer exactly once in draw order', () => {
    expect(new Set(LAYER_ORDER).size).toBe(LAYER_ORDER.length);
  });

  it.each([
    ['LAYER_ACCENT', LAYER_ACCENT],
    ['LAYER_LABEL', LAYER_LABEL],
    ['FOCUS_ZOOM', FOCUS_ZOOM],
  ])('%s has an entry for every ordered layer and nothing else', (_, map) => {
    expect(Object.keys(map).sort()).toEqual([...LAYER_ORDER].sort());
  });

  it('uses 6-digit hex accents', () => {
    for (const color of Object.values(LAYER_ACCENT)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('gives every layer a non-empty label', () => {
    for (const label of Object.values(LAYER_LABEL)) {
      expect(label.trim()).not.toBe('');
    }
  });

  it('keeps focus zooms within the MapLibre range', () => {
    for (const zoom of Object.values(FOCUS_ZOOM)) {
      expect(zoom).toBeGreaterThanOrEqual(0);
      expect(zoom).toBeLessThanOrEqual(22);
    }
  });

  it('marks the API-backed layers as live, all of them known', () => {
    expect(LIVE_LAYERS).toEqual(expect.arrayContaining(['divvy', 'events', 'neighborhoods']));
    for (const key of LIVE_LAYERS) {
      expect(LAYER_ORDER).toContain(key);
    }
  });
});
