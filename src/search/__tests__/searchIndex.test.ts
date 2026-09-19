import type {PlaceCollection} from '@wm/shared';

import type {
  ArterialCollection,
  ExpresswayCollection,
  TransitLineCollection,
  TransitStationCollection,
} from '../../api/types';
import {buildSearchIndex, searchLocations} from '../searchIndex';

type Coord = [number, number];
const line = (a: Coord, b: Coord) => ({type: 'LineString' as const, coordinates: [a, b]});
const point = (c: Coord) => ({type: 'Point' as const, coordinates: c});

// stopId is what makes arrivals callable; the index does not read it, but the
// contract requires it, so the fixtures carry the null a station without one has.
const station = (name: string, lines: string, at: Coord, stopId: string | null = null) => ({
  type: 'Feature' as const,
  geometry: point(at),
  properties: {name, lines, stopId},
});

// Four 'L' stations share the name Western, as in the real system.
const STATIONS: TransitStationCollection = {
  type: 'FeatureCollection',
  features: [
    station('Western', 'Blue', [-87.6873, 41.9162]),
    station('Western', 'Brown', [-87.6885, 41.9661]),
    station('Western', 'Orange', [-87.6843, 41.8047]),
    station('Western', 'Pink', [-87.6856, 41.8540]),
    station("O'Hare", 'Blue', [-87.9048, 41.9772]),
    // One platform recorded twice in OSM: same name and lines.
    station('Clark/Lake', 'Blue, Brown, Green', [-87.6314, 41.8858]),
    station('Clark/Lake', 'Blue, Brown, Green', [-87.6327, 41.8857]),
  ],
};

const ARTERIALS: ArterialCollection = {
  type: 'FeatureCollection',
  features: [
    {type: 'Feature', geometry: line([-87.687, 41.80], [-87.687, 41.90]), properties: {name: 'Western Avenue', kind: 'primary'}},
    {type: 'Feature', geometry: line([-87.687, 41.90], [-87.688, 42.00]), properties: {name: 'Western Avenue', kind: 'primary'}},
  ],
};

const EXPRESSWAYS: ExpresswayCollection = {
  type: 'FeatureCollection',
  features: [
    {type: 'Feature', geometry: line([-87.65, 41.90], [-87.70, 41.93]), properties: {name: 'John F. Kennedy Expressway', ref: 'I 90;I 94', kind: 'motorway', localName: 'Kennedy'}},
    {type: 'Feature', geometry: line([-87.70, 41.93], [-87.75, 41.96]), properties: {name: 'John F. Kennedy Expressway', ref: 'I 90', kind: 'motorway', localName: 'Kennedy'}},
  ],
};

const LINES: TransitLineCollection = {
  type: 'FeatureCollection',
  features: [{type: 'Feature', geometry: line([-87.63, 41.88], [-87.63, 41.95]), properties: {line: 'Red', color: '#c60c30'}}],
};

const LANDMARKS: PlaceCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: point([-87.6553, 41.9484]),
      properties: {
        id: '5b1e2a3c-0000-4000-8000-000000000004',
        slug: 'wrigley-field',
        name: 'Wrigley Field',
        category: 'landmark',
        independence: 'excluded',
        communityArea: null,
        address: null,
        vouchCount: 0,
      },
    },
  ],
};

const index = buildSearchIndex({
  transitStations: STATIONS,
  arterials: ARTERIALS,
  expressways: EXPRESSWAYS,
  transitLines: LINES,
  landmarks: LANDMARKS,
});

const titles = (query: string) => searchLocations(index, query).map(r => r.title);

describe('searchLocations', () => {
  it('caps repeats of one name, so four Western stations do not bury Western Avenue', () => {
    const results = searchLocations(index, 'western');
    expect(results.filter(r => r.title === 'Western')).toHaveLength(2);
    expect(results.map(r => r.title)).toContain('Western Avenue');
  });

  it("matches across punctuation: 'o hare' and 'ohare' both find O'Hare", () => {
    expect(titles('o hare')).toContain("O'Hare");
    expect(titles('ohare')).toContain("O'Hare");
  });

  it('collapses a station recorded twice with the same lines', () => {
    expect(titles('clark lake').filter(t => t === 'Clark/Lake')).toHaveLength(1);
  });

  it('groups an expressway made of many segments into one result under its local name', () => {
    const kennedy = searchLocations(index, 'kennedy').filter(r => r.kind === 'expressway');
    expect(kennedy).toHaveLength(1);
    expect(kennedy[0].title).toBe('Kennedy');
  });

  it('finds landmarks from the places API, falling back to "Landmark" without a community area', () => {
    const [wrigley] = searchLocations(index, 'wrigley');
    expect(wrigley).toMatchObject({title: 'Wrigley Field', kind: 'landmark', subtitle: 'Landmark'});
  });

  it('ranks a transit line and returns nothing for one-character queries', () => {
    expect(titles('red')).toContain('Red Line');
    expect(searchLocations(index, 'w')).toEqual([]);
  });

  it('works with only some sources loaded (e.g. offline before arterials arrive)', () => {
    const partial = buildSearchIndex({transitStations: STATIONS});
    expect(searchLocations(partial, 'western').every(r => r.kind === 'station')).toBe(true);
    expect(searchLocations(buildSearchIndex({}), 'western')).toEqual([]);
  });
});
