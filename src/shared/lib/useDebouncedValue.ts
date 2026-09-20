import { useEffect, useState } from 'react';

/**
 * The value, held back until it has stopped changing for `delay` ms.
 *
 * For search inputs whose value reaches the server. Typing a plate is eight
 * or nine keystrokes, and a request per keystroke is eight or nine queries to
 * answer a question nobody finished asking — with the replies free to arrive
 * out of order, so the list settles on whichever was slowest rather than on
 * whatever was typed last.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
