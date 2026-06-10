import { NextRequest } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { extractText } from "@/lib/extract-text";

export const maxDuration = 60;

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
