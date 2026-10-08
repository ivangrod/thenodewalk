/** Preserves page positions: blank pages become empty strings, not shifted page numbers. */
export function cleanBookText(pages: string[]): string[] {
  const linesByPage = pages.map((page) =>
    page
      .normalize('NFKC')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const occurrences = new Map<string, number>();
  for (const lines of linesByPage) {
    if (lines.length < 3) continue;
    const boundary = new Set([...lines.slice(0, 2), ...lines.slice(-2)].map(headerKey));
    for (const key of boundary) occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  const repeated = new Set(
    [...occurrences]
      .filter(([, count]) => count >= 3 && count >= Math.ceil(pages.length * 0.6))
      .map(([key]) => key),
  );

  return linesByPage.map((lines) =>
    lines
      .filter((line, index) => {
        if (/^\d+$/.test(line) || /^(?=[ivxlcdm]+$)[ivxlcdm]{2,}$/i.test(line)) return false;
        if (/\.{3,}\s*(?:\d+|[ivxlcdm]+)\s*$/i.test(line)) return false;
        const boundary = index < 2 || index >= lines.length - 2;
        return !(boundary && lines.length >= 3 && repeated.has(headerKey(line)));
      })
      .join('\n')
      .replace(
        /(\p{L})-\n(\p{L})/gu,
        (_match: string, before: string, after: string): string =>
          `${before}${after === after.toUpperCase() ? '-' : ''}${after}`,
      )
      .trim(),
  );
}

function headerKey(line: string): string {
  return line.replace(/\d+/g, '#').replace(/\s+/g, ' ').toLowerCase();
}
