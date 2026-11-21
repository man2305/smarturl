import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest runs with globals: false, so @testing-library/react does not
// auto-register its cleanup hook; unmount after every test explicitly.
afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver; Radix primitives (Dialog, Select, ...) need
// one at mount. A no-op stub is enough — no test asserts on layout.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
