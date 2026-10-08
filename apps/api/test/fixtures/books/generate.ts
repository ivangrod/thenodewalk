import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import JSZip from 'jszip';

/** Original synthetic content. Re-run with pnpm exec ts-node test/fixtures/books/generate.ts. */
async function generate(): Promise<void> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  zip.file(
    'EPUB/content.opf',
    `<?xml version="1.0"?>
<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:thenodewalk:sample</dc:identifier>
    <dc:title>Sample Engineering Book</dc:title><dc:creator>The Node Walk</dc:creator>
    <dc:language>en</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="chapter"/></spine>
</package>`,
  );
  zip.file(
    'EPUB/nav.xhtml',
    `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>Contents</title></head><body><nav epub:type="toc">
    <ol><li><a href="chapter.xhtml">Small feedback loops</a></li></ol>
  </nav></body>
</html>`,
  );
  zip.file(
    'EPUB/chapter.xhtml',
    `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>Small feedback loops</title></head>
  <body><h1>Small feedback loops</h1><p>Small feedback loops make engineering changes easier to review.</p></body>
</html>`,
  );
  zip.forEach((_path, entry): void => {
    entry.date = new Date('2026-01-01T00:00:00Z');
  });
  await writeFile(
    join(__dirname, 'sample.epub'),
    await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
  );

  const texts = [
    'Small feedback loops make changes easier to review.',
    'Tests preserve useful behaviour across changes.',
  ];
  const streams = texts.map((text) => `BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n`);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Outlines 8 0 R /PageMode /UseOutlines >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...streams.map(
      (stream) => `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    ),
    '<< /Type /Outlines /First 9 0 R /Last 10 0 R /Count 2 >>',
    '<< /Title (Small feedback loops) /Parent 8 0 R /Next 10 0 R /Dest [3 0 R /Fit] >>',
    '<< /Title (Tests) /Parent 8 0 R /Prev 9 0 R /Dest [4 0 R /Fit] >>',
    '<< /Title (Sample Engineering Book) /Author (The Node Walk) >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 11 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  await writeFile(join(__dirname, 'sample.pdf'), pdf);
}

void generate();
