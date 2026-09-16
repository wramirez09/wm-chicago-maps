import type {PressEventWithFeatures} from '@maplibre/maplibre-react-native';
import type {NativeSyntheticEvent} from 'react-native';

export type OverlayPressHandler = (
  event: NativeSyntheticEvent<PressEventWithFeatures>,
) => void;

export type LayerKey = 'expressways' | 'arterials' | 'transit' | 'landmarks';

export type LayerVisibility = Record<LayerKey, boolean>;
