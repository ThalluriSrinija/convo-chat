import { useState, useEffect } from 'react';

/**
 * useDebounce — delays updating a value until after a pause in changes.
 *
 * Useful for search inputs: prevents firing API/filter calls on every keystroke.
 *
 * @param {any}    value   The value to debounce (typically a search string)
 * @param {number} delay   Delay in milliseconds (default: 300ms)
 * @returns {any}          The debounced value
 *
 * @example
 *   const debouncedQuery = useDebounce(searchQuery, 300);
 *   // debouncedQuery only updates 300ms after the user stops typing
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timer if value changes before the delay elapses
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
