// Minimal, valid EPUB 3 built in the browser with jszip (loaded lazily).
// One truthful content document: the creator's actual draft — no generated
// filler chapters.

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function buildEpub({ bookTitle, chapterTitle, author, draft }: { bookTitle: string; chapterTitle: string; author: string; draft: string }): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const uuid = crypto.randomUUID();
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const paragraphs = draft.split(/\n\s*\n/).filter(Boolean).map(paragraph => `    <p>${escapeXml(paragraph.trim())}</p>`).join("\n") || "    <p>(This manuscript is empty.)</p>";

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="chapter1"/></spine>
</package>`);
  zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head><title>${escapeXml(bookTitle)}</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter1.xhtml">${escapeXml(chapterTitle)}</a></li></ol></nav></body>
</html>`);
  zip.file("OEBPS/chapter1.xhtml", `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head><title>${escapeXml(chapterTitle)}</title></head>
<body>
  <h1>${escapeXml(chapterTitle)}</h1>
${paragraphs}
</body>
</html>`);

  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
}
