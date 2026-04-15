"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";
import { NoteInterpretationCard } from "@/components/NoteInterpretationCard";
import { analyzeNoteFile, analyzeNoteFollowUp, analyzeNotes, getUserErrorMessage } from "@/lib/api";
import { NoteFileAnalysisResponse, NoteInterpretationResponse } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_SUGGESTED_QUESTIONS = [
  "What matters most right now?",
  "What symptoms should worry me?",
  "What does this medicine do?",
  "What should I ask my doctor?"
];

export default function NoteInterpreterPage() {
  const [noteText, setNoteText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<NoteInterpretationResponse | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [parsingMethod, setParsingMethod] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const followUpInputRef = useRef<HTMLTextAreaElement | null>(null);

  const canSubmit = useMemo(() => noteText.trim().length >= 5 || Boolean(selectedFileName), [noteText, selectedFileName]);
  const canAskFollowUp = useMemo(() => Boolean(result) && followUpQuestion.trim().length >= 3, [result, followUpQuestion]);

  const suggestedQuestions = useMemo(() => {
    const reportQuestions = result?.follow_up_questions ?? [];
    return [...new Set([...reportQuestions, ...DEFAULT_SUGGESTED_QUESTIONS])].slice(0, 6);
  }, [result]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, followUpLoading]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setSelectedFileName(file?.name ?? null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setFollowUpQuestion("");
    setChatMessages([]);
    setExtractedText(null);
    setParsingMethod(null);

    if (!noteText.trim() && !selectedFile) {
      setError("Add note text or upload a file to continue.");
      setLoading(false);
      return;
    }

    try {
      if (selectedFile) {
        const response: NoteFileAnalysisResponse = await analyzeNoteFile(selectedFile);
        setExtractedText(response.extracted_text);
        setParsingMethod(response.file_parse_method ?? "file extraction");
        setResult(response);
      } else {
        const response = await analyzeNotes({ note_text: noteText.trim() });
        setExtractedText(null);
        setParsingMethod("direct pasted text");
        setResult(response);
      }
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to interpret this note right now."));
    } finally {
      setLoading(false);
    }
  }

  async function askFollowUp(question: string) {
    if (!result || !question.trim()) return;

    const normalizedQuestion = question.trim();
    const messageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setFollowUpLoading(true);
    setError(null);
    setFollowUpQuestion("");
    setChatMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: "user",
        content: normalizedQuestion
      }
    ]);

    try {
      const response = await analyzeNoteFollowUp({
        original_note_text: (extractedText ?? noteText).trim(),
        interpreted_note: JSON.stringify(result),
        question: normalizedQuestion
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `${messageId}-assistant`,
          role: "assistant",
          content: response.answer
        }
      ]);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to answer your follow-up question right now."));
      setChatMessages((prev) => prev.filter((message) => message.id !== messageId));
    } finally {
      setFollowUpLoading(false);
    }
  }

  async function onAskFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAskFollowUp || followUpLoading) return;
    await askFollowUp(followUpQuestion);
  }

  return (
    <RequireAuth>
      <section className="space-y-6">
        <header className="section-shell p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 md:text-3xl">Note Interpreter</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            Turn clinical notes into an easy-to-understand report, then ask focused follow-up questions in a dedicated assistant chat.
          </p>
          <div className="mt-4">
            <DisclaimerBanner />
          </div>
        </header>

        <form className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/75" onSubmit={onSubmit}>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Note Input</h2>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Use one input method: upload a clinical note file or paste note text directly.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
              <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Upload note file</legend>
              <label className="block">
                <span className="sr-only">Upload note image or PDF</span>
                <input
                  type="file"
                  onChange={onFileChange}
                  accept="image/*,.pdf,application/pdf"
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200 dark:focus:border-brand-400"
                />
              </label>
              {selectedFileName ? (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Selected file: <span className="font-medium">{selectedFileName}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">No file selected.</p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">Supports PDF and image files with built-in parsing/OCR.</p>
            </fieldset>

            <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
              <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Paste note text</legend>
              <textarea
                className="min-h-52 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-800 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400"
                placeholder="Paste doctor note text, discharge summary, or encounter highlights"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                minLength={5}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Pasted text avoids extraction errors and is usually clearest.</p>
            </fieldset>
          </div>

          <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" disabled={loading || !canSubmit}>
            {loading ? "Interpreting..." : "Interpret Note"}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Starting a new interpretation will clear this note&apos;s current follow-up conversation.
          </p>
        </form>

        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}

        {result ? (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {parsingMethod ? (
                  <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                    Source: <span className="font-medium capitalize">{parsingMethod.replaceAll("_", " ")}</span>
                  </p>
                ) : null}
              </div>

              {extractedText ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Extracted text preview</h2>
                  <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                    {extractedText.slice(0, 1200)}
                  </p>
                </div>
              ) : null}

              <NoteInterpretationCard result={result} />
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/75">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Suggested Follow-up Questions</h2>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => {
                      setFollowUpQuestion(question);
                      followUpInputRef.current?.focus();
                    }}
                    disabled={followUpLoading}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-300"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </section>

            <section className="frosted-panel space-y-4 rounded-2xl p-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Follow-up Assistant</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ask anything about this interpreted note. The conversation stays available for continued context.</p>
              </div>

              <div className="max-h-[26rem] space-y-3 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                {chatMessages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    No follow-up questions yet. Ask your first question or tap a suggested prompt to begin.
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                          message.role === "user"
                            ? "rounded-br-md bg-brand-700 text-white"
                            : "rounded-bl-md border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))
                )}

                {followUpLoading ? (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:140ms]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:280ms]" />
                      <span className="ml-1 text-xs">Assistant is typing...</span>
                    </div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={onAskFollowUp} className="space-y-3">
                <textarea
                  ref={followUpInputRef}
                  value={followUpQuestion}
                  onChange={(event) => setFollowUpQuestion(event.target.value)}
                  minLength={3}
                  placeholder="Ask a specific follow-up question about your interpreted note..."
                  className="min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="flex justify-end">
                  <button type="submit" disabled={!canAskFollowUp || followUpLoading} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900">
                    {followUpLoading ? "Answering..." : "Send question"}
                  </button>
                </div>
              </form>
            </section>
          </>
        ) : null}
      </section>
    </RequireAuth>
  );
}
