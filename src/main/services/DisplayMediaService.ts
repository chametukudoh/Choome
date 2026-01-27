let preferredDisplaySourceId: string | null = null;

export function setPreferredDisplaySourceId(sourceId: string | null): void {
  preferredDisplaySourceId = sourceId;
}

export function getPreferredDisplaySourceId(): string | null {
  return preferredDisplaySourceId;
}
