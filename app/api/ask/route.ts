import { NextRequest } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

export const maxDuration = 60;

async function extractText(file: File): Promise<string> {
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

  throw new Error("Unsupported file type");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const question = form.get("question") as string | null;

  if (!file) return new Response("No file provided", { status: 400 });
  if (!question?.trim()) return new Response("No question provided", { status: 400 });

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
      "You are a precise document analyst. Answer questions about the provided document accurately and concisely. Cite relevant sections when helpful. If the answer isn't in the document, say so.",
    prompt: `Document content:\n\n${text.slice(0, 50000)}\n\n---\n\nQuestion: ${question.trim()}`,
  });

  return result.toTextStreamResponse();
}
