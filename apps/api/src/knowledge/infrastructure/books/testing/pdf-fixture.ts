/** Minimal original PDF generator for reader behaviour tests, with byte-correct xref offsets. */
export function pdfFixture(
  pages: string[][],
  options: {
    title?: string;
    author?: string;
    bookmarks?: { title: string; page: number; named?: boolean }[];
  } = {},
): Buffer {
  const objects: string[] = [];
  const add = (value: string): number => {
    objects.push(value);
    return objects.length;
  };
  const catalog = add('');
  const tree = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];
  const escape = (value: string): string => value.replace(/([\\()])/g, '\\$1');
  for (const lines of pages) {
    const stream = `BT /F1 12 Tf 16 TL 72 720 Td\n${lines.map((line, index) => `${index > 0 ? 'T* ' : ''}(${escape(line)}) Tj`).join('\n')}\nET\n`;
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[tree - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  let outlineRef = '';
  let namesRef = '';
  const bookmarks = options.bookmarks ?? [];
  if (bookmarks.length > 0) {
    const outline = add('');
    const first = objects.length + 1;
    const names: string[] = [];
    for (const [index, bookmark] of bookmarks.entries()) {
      const destination = `[${pageIds[bookmark.page - 1]} 0 R /Fit]`;
      const name = `chapter${index}`;
      if (bookmark.named) names.push(`(${name}) ${destination}`);
      add(
        `<< /Title (${escape(bookmark.title)}) /Parent ${outline} 0 R ${index > 0 ? `/Prev ${first + index - 1} 0 R` : ''} ${index < bookmarks.length - 1 ? `/Next ${first + index + 1} 0 R` : ''} /Dest ${bookmark.named ? `(${name})` : destination} >>`,
      );
    }
    objects[outline - 1] =
      `<< /Type /Outlines /First ${first} 0 R /Last ${first + bookmarks.length - 1} 0 R /Count ${bookmarks.length} >>`;
    outlineRef = `/Outlines ${outline} 0 R`;
    if (names.length > 0) {
      const destinations = add(`<< /Names [${names.join(' ')}] >>`);
      namesRef = `/Names << /Dests ${destinations} 0 R >>`;
    }
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R ${outlineRef} ${namesRef} >>`;
  const info = add(
    `<< ${options.title ? `/Title (${escape(options.title)})` : ''} ${options.author ? `/Author (${escape(options.author)})` : ''} >>`,
  );
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
