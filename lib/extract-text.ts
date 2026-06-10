import * as XLSX from "xlsx";
import AdmZip from "adm-zip";

const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (name.endsWith(".pptx")) {
    return extractPptxText(buffer);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return extractXlsxText(buffer);
  }

  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error("Unsupported file type");
}

function extractPptxText(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const slides = zip
    .getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName));

  if (slides.length === 0) return "";

  return slides
    .map((entry) => {
      const xml = entry.getData().toString("utf-8");
      const texts: string[] = [];
      const regex = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        if (match[1].trim()) texts.push(match[1]);
      }
      return texts.join(" ");
    })
    .join("\n\n");
}

function extractXlsxText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return `[Sheet: ${name}]\n${XLSX.utils.sheet_to_csv(sheet)}`;
  }).join("\n\n");
}
