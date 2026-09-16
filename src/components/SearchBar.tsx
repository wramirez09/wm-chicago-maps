import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {searchLocations, type SearchResult} from '../search/searchIndex';

type Props = {
  onSelect: (result: SearchResult) => void;
};

export function SearchBar({onSelect}: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // `TextInput` as a type is the props type in RN 0.87; the instance type (the
  // one with .clear()/.blur()) is what the ref actually holds.
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // The index is a pure function of the query, and searching ~1k entries is
  // sub-millisecond, so there is nothing to debounce.
  const results = useMemo(() => searchLocations(query), [query]);

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

  const open = focused && results.length > 0;

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
          onSubmitEditing={() => results[0] && handleSelect(results[0])}
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
          </ScrollView>
        </View>
      ) : null}

      {focused && query.trim().length >= 2 && results.length === 0 ? (
        <View style={styles.results}>
          <Text style={styles.empty}>
            Nothing matching “{query.trim()}”. This searches the map's own
            streets, stations and landmarks — not street addresses.
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
    height: 44,
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
});
