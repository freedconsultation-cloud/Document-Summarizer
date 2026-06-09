import { NextRequest } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// CJS-only packages — kept external via serverExternalPackages in next.config.ts
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { data: Buffer }) => { load: () => Promise<void>; getText: () => Promise<{ text: string }> };
};
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

export const maxDuration = 60;

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    return result.text;
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return new Response("No file provided", { status: 400 });
  }

  let text: string;
  try {
    text = await extractText(file);
  } catch (e: any) {
    return new Response(e.message ?? "Failed to extract text", { status: 422 });
  }

  if (!text.trim()) {
    return new Response("Could not extract any text from the file", { status: 422 });
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system:
      "You are a concise document summarizer. Provide a clear, structured summary covering the main points, key findings, and important details. Use plain prose — no bullet lists unless the document itself is a list.",
    prompt: `Summarize the following document:\n\n${text.slice(0, 50000)}`,
  });

  return result.toTextStreamResponse();
}
