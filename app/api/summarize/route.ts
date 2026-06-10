import { NextRequest } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { extractText } from "@/lib/extract-text";

export const maxDuration = 60;

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
