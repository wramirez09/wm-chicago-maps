import {
  PAN_THRESHOLD,
  RECENTER_ZOOM,
  fromTrackUserLocation,
  isPanGesture,
  nextRecenterMode,
  reconcileTrackingChange,
  recenterZoom,
  toTrackUserLocation,
} from '../recenter';

describe('nextRecenterMode', () => {
  it('cycles off → follow → heading → follow', () => {
    expect(nextRecenterMode('off')).toBe('follow');
    expect(nextRecenterMode('follow')).toBe('heading');
    expect(nextRecenterMode('heading')).toBe('follow');
  });
});

describe('recenterZoom', () => {
  it('zooms in to street level from further out', () => {
    expect(recenterZoom(11)).toBe(RECENTER_ZOOM);
  });

  it('keeps the zoom when already closer in', () => {
    expect(recenterZoom(18)).toBe(18);
  });
});

describe('tracking mode mapping', () => {
  it('maps modes to the native camera tracking value', () => {
    expect(toTrackUserLocation('off')).toBeUndefined();
    expect(toTrackUserLocation('follow')).toBe('default');
    expect(toTrackUserLocation('heading')).toBe('heading');
  });

  it('maps native tracking changes back, with null meaning the user panned away', () => {
    expect(fromTrackUserLocation(null)).toBe('off');
    expect(fromTrackUserLocation(undefined)).toBe('off');
    expect(fromTrackUserLocation('default')).toBe('follow');
    expect(fromTrackUserLocation('heading')).toBe('heading');
    expect(fromTrackUserLocation('course')).toBe('heading');
  });

  it('round-trips every mode', () => {
    for (const mode of ['off', 'follow', 'heading'] as const) {
      expect(fromTrackUserLocation(toTrackUserLocation(mode))).toBe(mode);
    }
  });
});

describe('reconcileTrackingChange', () => {
  it('lets native turn tracking off when the user pans away', () => {
    expect(reconcileTrackingChange('follow', null)).toBe('off');
    expect(reconcileTrackingChange('heading', null)).toBe('off');
  });

  it('lets native step compass mode down to follow', () => {
    expect(reconcileTrackingChange('heading', 'default')).toBe('follow');
  });

  // The bug: a late "default" event after a pan turned following back on,
  // and the camera kept snapping back so the map could not be scrolled.
  it('never lets a late native event turn tracking back on', () => {
    expect(reconcileTrackingChange('off', 'default')).toBe('off');
    expect(reconcileTrackingChange('off', 'heading')).toBe('off');
    expect(reconcileTrackingChange('follow', 'heading')).toBe('follow');
  });

  it('keeps the mode when native echoes it back', () => {
    expect(reconcileTrackingChange('follow', 'default')).toBe('follow');
    expect(reconcileTrackingChange('heading', 'heading')).toBe('heading');
  });
});

describe('isPanGesture', () => {
  const start = {x: 100, y: 100};

  it('treats a one-finger drag past the threshold as a pan', () => {
    expect(isPanGesture(start, {x: 100, y: 100 + PAN_THRESHOLD + 1}, 1)).toBe(true);
    expect(isPanGesture(start, {x: 108, y: 108}, 1)).toBe(true);
  });

  it('ignores the small jitter of a tap', () => {
    expect(isPanGesture(start, {x: 104, y: 103}, 1)).toBe(false);
    expect(isPanGesture(start, {x: 100 + PAN_THRESHOLD, y: 100}, 1)).toBe(false);
  });

  it('ignores pinches and rotations, which keep following', () => {
    expect(isPanGesture(start, {x: 300, y: 300}, 2)).toBe(false);
  });
});
