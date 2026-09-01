/**
 * Viewport presets for later Pedilo QA (mobile / tablet / desktop).
 * Foundation smokes may use these; they are not a full responsive audit.
 */
export const E2E_VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1366, height: 768 },
} as const;

export type E2eViewportName = keyof typeof E2E_VIEWPORTS;
