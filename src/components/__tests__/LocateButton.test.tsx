import React from 'react';
import {Linking} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {
  getCurrentPosition,
  requestLocationPermission,
} from '../../lib/device/location';
import type {RecenterMode} from '../../lib/recenter';
import {LocateButton} from '../LocateButton';

jest.mock('../../lib/device/location', () => ({
  requestLocationPermission: jest.fn(),
  getCurrentPosition: jest.fn(),
}));

const mockRequest = requestLocationPermission as jest.Mock;
const mockPosition = getCurrentPosition as jest.Mock;

const FIX = {latitude: 41.88, longitude: -87.63, accuracy: 5, timestamp: 1};

async function render(mode: RecenterMode) {
  const onLocated = jest.fn();
  const onModeChange = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <LocateButton mode={mode} onLocated={onLocated} onModeChange={onModeChange} />,
    );
  });
  const press = () =>
    ReactTestRenderer.act(async () => {
      renderer.root.findByProps({testID: 'recenter-button'}).props.onPress();
    });
  const text = () =>
    renderer.root
      .findAllByType('Text' as any)
      .map(t => [].concat(t.props.children).join(''))
      .join(' ');
  return {renderer, onLocated, onModeChange, press, text};
}

beforeEach(() => {
  mockRequest.mockReset();
  mockPosition.mockReset();
});

describe('LocateButton', () => {
  it.each([
    ['off', 'icon-off'],
    ['follow', 'icon-follow'],
    ['heading', 'icon-heading'],
  ] as const)('shows the %s icon', async (mode, testID) => {
    const {renderer} = await render(mode);

    expect(renderer.root.findAllByProps({testID})).not.toHaveLength(0);
  });

  it('marks the button selected only while following', async () => {
    const off = await render('off');
    const follow = await render('follow');
    const button = (r: ReactTestRenderer.ReactTestRenderer) =>
      r.root.findByProps({testID: 'recenter-button'});

    expect(button(off.renderer).props.accessibilityState.selected).toBe(false);
    expect(button(follow.renderer).props.accessibilityState.selected).toBe(true);
  });

  it('locates the user when tapped from off', async () => {
    mockRequest.mockResolvedValue('granted');
    mockPosition.mockResolvedValue(FIX);
    const {press, onLocated, onModeChange} = await render('off');

    await press();

    expect(onLocated).toHaveBeenCalledWith(FIX);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it('switches follow to heading without asking for location again', async () => {
    const {press, onModeChange} = await render('follow');

    await press();

    expect(onModeChange).toHaveBeenCalledWith('heading');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('switches heading back to follow', async () => {
    const {press, onModeChange} = await render('heading');

    await press();

    expect(onModeChange).toHaveBeenCalledWith('follow');
  });

  it('explains a denied permission and does not locate', async () => {
    mockRequest.mockResolvedValue('denied');
    const {press, onLocated, text} = await render('off');

    await press();

    expect(onLocated).not.toHaveBeenCalled();
    expect(text()).toContain('Location permission was not granted.');
  });

  it('offers Settings when permission is blocked', async () => {
    mockRequest.mockResolvedValue('blocked');
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined);
    const {press, renderer, text} = await render('off');

    await press();
    expect(text()).toContain('Open Settings');

    await ReactTestRenderer.act(async () => {
      renderer.root
        .findAll(n => typeof n.props.onPress === 'function')
        .find(n => n.props.testID !== 'recenter-button')!
        .props.onPress();
    });
    expect(openSettings).toHaveBeenCalled();
    openSettings.mockRestore();
  });

  it('shows the error when a fix cannot be obtained', async () => {
    mockRequest.mockResolvedValue('granted');
    mockPosition.mockRejectedValue(new Error('Location unavailable (3): timeout'));
    const {press, onLocated, text} = await render('off');

    await press();

    expect(onLocated).not.toHaveBeenCalled();
    expect(text()).toContain('timeout');
  });
});
