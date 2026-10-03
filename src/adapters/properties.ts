/** Small persistent key-value store for script state (not for settings). */
export interface StateStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export function createGasStateStore(): StateStore {
  const properties = PropertiesService.getScriptProperties();
  return {
    get: (key) => properties.getProperty(key) ?? undefined,
    set: (key, value) => {
      properties.setProperty(key, value);
    },
  };
}
