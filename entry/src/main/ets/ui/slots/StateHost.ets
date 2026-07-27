// The former generic StateHost was a local visual fallback for loading/empty/
// error/offline. It had no exact Figma master and used width(0) placeholders
// when unadmitted. A3 removes the slot entirely from every shell: dedicated
// Figma stateful pages own their state in their generated body, while an
// unbound state emits no node and cannot swallow interaction.
//
// This module stays as a named retirement marker so historical imports fail at
// review time instead of silently restoring the generic fallback.
export const STATE_HOST_RETIRED: string = 'no-generic-figma-state-host';
