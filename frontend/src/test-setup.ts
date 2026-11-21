import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest runs with globals: false, so @testing-library/react does not
// auto-register its cleanup hook; unmount after every test explicitly.
afterEach(() => {
  cleanup();
});
