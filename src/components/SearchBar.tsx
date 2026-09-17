import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {hasEnv} from '../lib/api/env';
import {useGeocode} from '../lib/api/places/hooks';
import type {GeocodeResult} from '../lib/api/places/photon';
import {searchLocations, type SearchResult} from '../search/searchIndex';

/**
 * Photon is a network round trip per request, so it waits for a pause in
 * typing. Local results are synchronous and stay instant.
 */
const GEOCODE_DEBOUNCE_MS = 300;

/** Height of the search field itself, excluding the results dropdown. */
export const SEARCH_FIELD_HEIGHT = 44;

/** Local results are capped lower when addresses are also showing. */
const LOCAL_LIMIT_WITH_ADDRESSES = 5;

type Props = {
  onSelect: (result: SearchResult) => void;
  onSelectAddress: (result: GeocodeResult) => void;
};

export function SearchBar({onSelect, onSelectAddress}: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // `TextInput` as a type is the props type in RN 0.87; the instance type (the
  // one with .clear()/.blur()) is what the ref actually holds.
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const geocodingEnabled = hasEnv('PHOTON_URL');

  // The local index is a pure function of the query, and searching ~1k entries
  // is sub-millisecond, so it is not debounced. Only the network source is.
  const results = useMemo(
    () => searchLocations(query, geocodingEnabled ? LOCAL_LIMIT_WITH_ADDRESSES : 8),
    [query, geocodingEnabled],
  );

  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), GEOCODE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const geocode = useGeocode(debouncedQuery, {
    enabled: geocodingEnabled && focused && debouncedQuery.length >= 3,
  });
  const addresses = geocode.data ?? [];

  const clear = useCallback(() => {
    setQuery('');
    inputRef.current?.clear();
  }, []);

  const dismiss = useCallback(() => {
    setFocused(false);
    Keyboard.dismiss();
    inputRef.current?.blur();
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelect(result);
      // Leave the text in place so the user can see what they picked, but get
      // the list and keyboard out of the way of the map.
      dismiss();
    },
    [dismiss, onSelect],
  );

  const handleSelectAddress = useCallback(
    (result: GeocodeResult) => {
      onSelectAddress(result);
      dismiss();
    },
    [dismiss, onSelectAddress],
  );

  const searching = geocode.isFetching && addresses.length === 0;
  const open = focused && (results.length > 0 || addresses.length > 0 || searching);

  return (
    <View style={styles.wrapper}>
      <View style={styles.field}>
        <Text style={styles.icon}>⌕</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          placeholder="Search streets, stations, landmarks"
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
          clearButtonMode="never"
          onSubmitEditing={() => {
            if (results[0]) {
              handleSelect(results[0]);
            } else if (addresses[0]) {
              handleSelectAddress(addresses[0]);
            }
          }}
          accessibilityLabel="Search the map"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={clear}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={styles.results}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            {results.map((result, index) => (
              <Pressable
                key={result.id}
                onPress={() => handleSelect(result)}
                style={[styles.row, index > 0 && styles.rowDivided]}
                accessibilityRole="button"
                accessibilityLabel={`${result.title}, ${result.subtitle}`}>
                <View style={[styles.swatch, {backgroundColor: result.accent}]} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {result.title}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {result.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
            {addresses.length > 0 ? (
              <Text style={styles.sectionLabel}>Addresses</Text>
            ) : null}
            {addresses.map((address, index) => (
              <Pressable
                key={`${address.properties.osm_type}-${address.properties.osm_id}-${index}`}
                onPress={() => handleSelectAddress(address)}
                style={[styles.row, styles.rowDivided]}
                accessibilityRole="button"
                accessibilityLabel={address.label}>
                <View style={[styles.swatch, styles.addressSwatch]} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {address.properties.name ??
                      [address.properties.housenumber, address.properties.street]
                        .filter(Boolean)
                        .join(' ')}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {address.label}
                  </Text>
                </View>
              </Pressable>
            ))}
            {searching ? (
              <View style={styles.searching}>
                <ActivityIndicator size="small" color="#9ca3af" />
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {focused &&
      query.trim().length >= 2 &&
      !open &&
      !geocode.isFetching &&
      query.trim() === debouncedQuery ? (
        <View style={styles.results}>
          <Text style={styles.empty}>
            {geocodingEnabled
              ? `Nothing matching “${query.trim()}”.`
              : `Nothing matching “${query.trim()}”. Address search needs PHOTON_URL in .env.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {gap: 8},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: SEARCH_FIELD_HEIGHT,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  icon: {fontSize: 19, color: '#6b7280'},
  input: {flex: 1, fontSize: 15, color: '#111827', padding: 0},
  clear: {fontSize: 15, color: '#9ca3af'},
  results: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    // Tall enough for a useful list, short enough to leave map visible.
    maxHeight: 264,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowDivided: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb'},
  swatch: {width: 4, height: 28, borderRadius: 2},
  rowText: {flex: 1},
  rowTitle: {fontSize: 15, color: '#111827', fontWeight: '500'},
  rowSubtitle: {marginTop: 1, fontSize: 12, color: '#6b7280'},
  empty: {padding: 14, fontSize: 13, color: '#6b7280', lineHeight: 18},
  sectionLabel: {
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  addressSwatch: {backgroundColor: '#6b7280'},
  searching: {paddingVertical: 10, alignItems: 'center'},
});
