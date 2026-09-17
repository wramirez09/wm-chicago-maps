/**
 * On-disk key-value stores, backed by MMKV.
 *
 * Two stores on purpose: signing out clears `authStorage` without throwing
 * away hundreds of kilobytes of cached layers, and clearing the cache (or a
 * cache-busting schema change) never signs the user out.
 *
 * Under Jest this module is backed by __mocks__/react-native-mmkv.js: MMKV v4
 * loads its native Nitro module at import time, which throws outside an app.
 */
import {createMMKV} from 'react-native-mmkv';

export const authStorage = createMMKV({id: 'wm.auth'});
export const cacheStorage = createMMKV({id: 'wm.cache'});

/**
 * The async key-value shape @tanstack/query-async-storage-persister expects.
 * MMKV is synchronous; wrapping it in resolved promises is all that is needed.
 */
export const persisterStorage = {
  getItem: (key: string) => Promise.resolve(cacheStorage.getString(key) ?? null),
  setItem: (key: string, value: string) => {
    cacheStorage.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    cacheStorage.remove(key);
    return Promise.resolve();
  },
};
