import type {PressEventWithFeatures} from '@maplibre/maplibre-react-native';
import type {NativeSyntheticEvent} from 'react-native';

export type OverlayPressHandler = (
  event: NativeSyntheticEvent<PressEventWithFeatures>,
) => void;
