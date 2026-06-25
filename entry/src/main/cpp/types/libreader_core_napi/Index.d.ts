export const abiVersion: () => number;
export const pingSmoke: () => string;
// Send a JSON-encoded reader-command to Core and return the JSON of the first
// event Core emits back (result / error / host.request). Throws on C ABI
// failure or timeout. See protocol/reader-command.schema.json.
export const sendJsonCommand: (command: string) => string;
