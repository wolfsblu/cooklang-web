/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

// Svelte Testing Library only registers its own cleanup when the test runner
// globals are enabled, which they are not here.
afterEach(() => cleanup());

// jsdom does not implement scrolling; the combobox scrolls the highlighted
// item into view while navigating by keyboard.
if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = () => {};
}
