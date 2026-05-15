// Mirrors ReaderCoreFoundation JSONValue
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | Record<string, JSONValue>;
