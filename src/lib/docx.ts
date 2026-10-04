import "server-only";
import { strFromU8, unzipSync } from "fflate";

// Reads the text out of a Word (.docx) file without storing the file.
// A .docx is a zip; the body text lives in word/document.xml.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m);
}

export function docxText(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  } catch {
    throw new Error("That Word file could not be opened.");
  }
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("That file is not a Word document.");

  const paragraphs = strFromU8(xml).split(/<\/w:p>/);
  const lines = paragraphs.map((p) => {
    const isListItem = p.includes("<w:numPr>");
    const text = decodeXml(
      p
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<[^>]+>/g, ""),
    ).trim();
    return text && isListItem ? `- ${text}` : text;
  });
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
