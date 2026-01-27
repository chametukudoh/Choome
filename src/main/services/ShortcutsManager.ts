import { ShortcutsService } from './ShortcutsService';

let shortcutsService: ShortcutsService | null = null;

export function setShortcutsService(service: ShortcutsService): void {
  shortcutsService = service;
}

export function getShortcutsService(): ShortcutsService | null {
  return shortcutsService;
}
