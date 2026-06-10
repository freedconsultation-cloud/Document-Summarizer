"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const ACCEPTED = ".pdf,.doc,.docx,.pptx,.xlsx,.xls,.txt,.md,.csv";
const MAX_MB = 10;

interface QAEntry {
  question: string;
  answer: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="text-[11px] px-2 py-1 rounded transition-opacity hover:opacity-70 shrink-0"
      style={{
        background: "var(--surface)",
        color: copied ? "#3fb950" : "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<QAEntry[]>([]);
  const [askLoading, setAskLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const questionRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new Q&A entries appear
  useEffect(() => {
    if (qaHistory.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [qaHistory.length]);

  function pickFile(f: File) {
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large — max ${MAX_MB} MB`);
      return;
    }
    setFile(f);
    setSummary("");
    setQaHistory([]);
    setError(null);
    summarizeFile(f);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  async function summarizeFile(f: File) {
    setSummaryLoading(true);
    setSummary("");
    setError(null);

    const form = new FormData();
    form.append("file", f);

    try {
      const res = await fetch("/api/summarize", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        setError((await res.text()) || "Something went wrong");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setSummary((s) => s + decoder.decode(value, { stream: true }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleAsk() {
    if (!file || !question.trim() || askLoading) return;

    const q = question.trim();
    setQuestion("");
    setAskLoading(true);
    setError(null);

    setQaHistory((h) => [...h, { question: q, answer: "" }]);

    const form = new FormData();
    form.append("file", file);
    form.append("question", q);

    try {
      const res = await fetch("/api/ask", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const msg = await res.text();
        setQaHistory((h) =>
          h.map((e, i) => (i === h.length - 1 ? { ...e, answer: msg || "Something went wrong" } : e))
        );
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setQaHistory((h) =>
          h.map((e, i) => (i === h.length - 1 ? { ...e, answer: e.answer + chunk } : e))
        );
      }
    } catch (e: any) {
      setQaHistory((h) =>
        h.map((entry, i) => (i === h.length - 1 ? { ...entry, answer: e.message } : entry))
      );
    } finally {
      setAskLoading(false);
      setTimeout(() => questionRef.current?.focus(), 50);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: "var(--background)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-4 sm:px-8 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="font-bold font-mono text-sm" style={{ color: "var(--accent)" }}>{"</>"}</span>
        <a
          href="https://freedprojects.vercel.app"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          ← Portfolio
        </a>
      </nav>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
              Document Summarizer
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Upload a document and get an instant AI summary. Then ask follow-up questions.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="flex flex-col items-center justify-center gap-3 rounded-xl p-6 sm:p-10 cursor-pointer transition-all"
            style={{
              border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
              background: dragging ? "var(--accent-bg)" : "var(--surface)",
            }}
          >
            <span className="text-3xl">📄</span>
            {file ? (
              <div className="text-center space-y-1">
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{file.name}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {summaryLoading ? "Summarizing…" : `${(file.size / 1024).toFixed(0)} KB · tap to change`}
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  <span className="hidden sm:inline">Drop your file here, or click to browse</span>
                  <span className="sm:hidden">Tap to browse</span>
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  PDF, DOCX, PPTX, XLSX, TXT, MD, CSV · max {MAX_MB} MB
                </p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
            />
          </div>

          {error && (
            <p className="text-sm px-4 py-3 rounded-lg" style={{ background: "rgba(248,81,73,0.1)", color: "#f85149" }}>
              {error}
            </p>
          )}

          {/* Summary output */}
          {summary && (
            <div
              className="rounded-xl p-5 sm:p-6 space-y-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                  Summary
                </h2>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <CopyButton text={summary} />
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                {summary}
              </p>
            </div>
          )}

          {/* Q&A history */}
          {qaHistory.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                  Q&amp;A
                </h2>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>
              {qaHistory.map((entry, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <div
                    className="px-4 sm:px-5 py-3"
                    style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                      Question
                    </p>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {entry.question}
                    </p>
                  </div>
                  <div className="px-4 sm:px-5 py-4" style={{ background: "var(--surface)" }}>
                    {entry.answer ? (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                            {entry.answer}
                          </p>
                          <CopyButton text={entry.answer} />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border-2 animate-spin shrink-0"
                          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
                        />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Analyzing…</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom padding so last card isn't flush with the sticky bar */}
          <div className="h-2" />
        </div>
      </div>

      {/* Sticky Q&A input */}
      <div
        className="shrink-0 px-4 sm:px-6 py-3 sm:py-4"
        style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}
      >
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <input
            ref={questionRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
            placeholder={file ? "Ask a question about this document…" : "Upload a file to ask questions"}
            disabled={!file || askLoading || summaryLoading}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none disabled:opacity-40"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={handleAsk}
            disabled={!file || !question.trim() || askLoading || summaryLoading}
            className="px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 shrink-0"
            style={{ background: "var(--surface-2)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            {askLoading ? "…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}
