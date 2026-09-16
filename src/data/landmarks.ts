export type LandmarkProperties = {
  id: string;
  name: string;
  neighborhood: string;
};

export type LandmarkCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  LandmarkProperties
>;

type LandmarkSeed = LandmarkProperties & {lng: number; lat: number};

/** Placeholder data — replace with whatever this app is actually mapping. */
const SEEDS: LandmarkSeed[] = [
  {id: 'cloud-gate', name: 'Cloud Gate', neighborhood: 'Loop', lng: -87.6233, lat: 41.8827},
  {id: 'willis-tower', name: 'Willis Tower', neighborhood: 'Loop', lng: -87.6359, lat: 41.8789},
  {id: 'navy-pier', name: 'Navy Pier', neighborhood: 'Streeterville', lng: -87.6051, lat: 41.8919},
  {id: 'wrigley-field', name: 'Wrigley Field', neighborhood: 'Lakeview', lng: -87.6553, lat: 41.9484},
  {id: 'msi', name: 'Museum of Science and Industry', neighborhood: 'Hyde Park', lng: -87.5831, lat: 41.7906},
  {id: 'conservatory', name: 'Garfield Park Conservatory', neighborhood: 'East Garfield Park', lng: -87.7173, lat: 41.8864},
  {id: 'the-606', name: 'The 606', neighborhood: 'Logan Square', lng: -87.6987, lat: 41.9136},
  {id: 'pullman', name: 'Pullman National Historical Park', neighborhood: 'Pullman', lng: -87.6093, lat: 41.6893},
];

export const LANDMARKS: LandmarkCollection = {
  type: 'FeatureCollection',
  // No top-level `id` — MapLibre's native renderer only handles integer feature
  // ids and drops features with non-numeric string ids. `properties.id` is the
  // identifier the app reads.
  features: SEEDS.map(({lng, lat, ...properties}) => ({
    type: 'Feature',
    properties,
    geometry: {type: 'Point', coordinates: [lng, lat]},
  })),
};
