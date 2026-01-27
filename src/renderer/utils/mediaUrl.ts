export function toMediaUrl(filePath: string): string {
  if (!filePath) {
    return '';
  }

  const normalized = filePath.replace(/\\/g, '/');
  return `media:///${encodeURI(normalized)}`;
}
