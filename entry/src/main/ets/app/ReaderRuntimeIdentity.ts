let getCurrentOwnerFn: (() => object) | undefined;
let isCurrentOwnerFn: ((candidate: object) => boolean) | undefined;

export function registerRuntimeOwnerAccessors(
  getCurrent: () => object,
  isCurrent: (candidate: object) => boolean,
): void {
  getCurrentOwnerFn = getCurrent;
  isCurrentOwnerFn = isCurrent;
}

export function getCurrentRuntimeOwner(): object {
  if (getCurrentOwnerFn === undefined) {
    throw new Error('ReaderRuntimeOwner must be installed by EntryAbility');
  }
  return getCurrentOwnerFn();
}

export function isCurrentRuntimeOwner(candidate: object): boolean {
  return isCurrentOwnerFn !== undefined && isCurrentOwnerFn(candidate);
}
