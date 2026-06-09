"use client";

import { useState, useRef, useCallback } from "react";

const ACCEPTED = ".pdf,.doc,.docx";
const MAX_MB = 10;

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File) {
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large — max ${MAX_MB} MB`);
      return;
    }
    setFile(f);
    setSummary("");
    setError(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setSummary("");
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/summarize", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const msg = await res.text();
        setError(msg || "Something went wrong");
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
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <nav
        className="flex items-center px-8 py-4 sticky top-0 z-10"
        style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="font-bold font-mono text-sm" style={{ color: "var(--accent)" }}>{"</>"}</span>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Document Summarizer
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Upload a PDF, DOC, or DOCX and get an AI-generated summary instantly.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center gap-3 rounded-xl p-10 cursor-pointer transition-all"
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
                {(file.size / 1024).toFixed(0)} KB · click to change
              </p>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Drop your file here, or click to browse
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                PDF, DOC, DOCX · max {MAX_MB} MB
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

        <button
          onClick={handleSubmit}
          disabled={!file || loading}
          className="w-full py-3 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          {loading ? "Summarizing…" : "Summarize"}
        </button>

        {summary && (
          <div
            className="rounded-xl p-6 space-y-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                Summary
              </h2>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
              {summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
