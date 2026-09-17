import {bboxMovedSignificantly, roundBbox} from '../geo';

// A 0.10° x 0.10° viewport.
const BASE = [-87.7, 41.85, -87.6, 41.95] as const;

describe('bboxMovedSignificantly', () => {
  it('ignores a small pan (5% of the width)', () => {
    expect(bboxMovedSignificantly(BASE, [-87.695, 41.85, -87.595, 41.95])).toBe(false);
  });

  it('refetches after a pan of more than 10% sideways', () => {
    expect(bboxMovedSignificantly(BASE, [-87.685, 41.85, -87.585, 41.95])).toBe(true);
  });

  it('refetches after a pan of more than 10% up or down', () => {
    expect(bboxMovedSignificantly(BASE, [-87.7, 41.865, -87.6, 41.965])).toBe(true);
  });

  it('refetches on a zoom that changes the box size by more than 10%', () => {
    // Same centre, box 20% narrower and shorter: zoomed in.
    expect(bboxMovedSignificantly(BASE, [-87.69, 41.86, -87.61, 41.94])).toBe(true);
  });

  it('treats exactly 10% as not significant', () => {
    expect(bboxMovedSignificantly(BASE, [-87.69, 41.85, -87.59, 41.95])).toBe(false);
  });

  it('refetches when the previous box is degenerate', () => {
    expect(bboxMovedSignificantly([-87.7, 41.9, -87.7, 41.9], BASE)).toBe(true);
  });
});

describe('roundBbox', () => {
  it('rounds float noise away so equal viewports share a query key', () => {
    expect(roundBbox([-87.700000001, 41.849999999, -87.6, 41.95])).toEqual([-87.7, 41.85, -87.6, 41.95]);
  });
});
