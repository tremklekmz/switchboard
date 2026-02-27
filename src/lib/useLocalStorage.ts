"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

function getServerSnapshot() {
  return true;
}

function subscribe(callback: () => void) {
  // We only need this to trigger once on mount
  // Using a microtask to avoid synchronous issues
  const id = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(id);
}

/**
 * Hook to detect client-side hydration.
 * Returns false on the server and during initial hydration, true after mount.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

function readFromStorage<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") return initialValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const hydrated = useHydrated();

  const [storedValue, setStoredValue] = useState<T>(() =>
    readFromStorage(key, initialValue)
  );

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch (error) {
          console.warn(`Error setting localStorage key "${key}":`, error);
        }
        return nextValue;
      });
    },
    [key]
  );

  // Return initial value during SSR to avoid hydration mismatch
  return [hydrated ? storedValue : initialValue, setValue];
}
