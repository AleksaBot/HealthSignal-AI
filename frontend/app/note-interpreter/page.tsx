"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { RequireAuth } from "@/components/RequireAuth";
import { NoteInterpretationCard } from "@/components/NoteInterpretationCard";
import { analyzeNoteFile, analyzeNoteFollowUp, analyzeNotes, getUserErrorMessage } from "@/lib/api";
import { NoteFileAnalysisResponse, NoteInterpretationResponse } from "@/lib/types";

export default function NoteInterpreterPage() {
  const [noteText, setNoteText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<NoteInterpretationResponse | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [parsingMethod, setParsingMethod] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const canSubmit = useMemo(() => noteText.trim().length >= 5 || Boolean(selectedFileName), [noteText, selectedFileName]);
  const canAskFollowUp = useMemo(() => Boolean(result) && followUpQuestion.trim().length >= 3, [result, followUpQuestion]);

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
    setFollowUpAnswer(null);
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

  async function onAskFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || !followUpQuestion.trim()) return;

    setFollowUpLoading(true);
    setFollowUpAnswer(null);
    setError(null);

    try {
      const response = await analyzeNoteFollowUp({
        interpreted_note: JSON.stringify(result),
        question: followUpQuestion.trim()
      });
      setFollowUpAnswer(response.answer);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to answer your follow-up question right now."));
    } finally {
      setFollowUpLoading(false);
    }
  }

  return (
    <RequireAuth>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Note Interpreter</h1>
        <DisclaimerBanner />

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
          <p className="text-sm text-slate-700 dark:text-slate-200">Use one input method: upload a clinical note file or paste note text directly.</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            <li>Upload supports PDF and image files and uses built-in file parsing/OCR when needed.</li>
            <li>Pasted text avoids extraction errors and is usually the clearest option.</li>
          </ul>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Option A: Upload note file</legend>
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
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Option B: Paste note text</legend>
            <textarea
              className="min-h-52 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-800 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-brand-400"
              placeholder="Paste doctor note text, discharge summary, or encounter highlights"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              minLength={5}
            />
          </fieldset>

          <button className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-60" disabled={loading || !canSubmit}>
            {loading ? "Interpreting..." : "Interpret Note"}
          </button>
        </form>

        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {result ? (
          <div className="space-y-4">
            {parsingMethod ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                Analysis source: <span className="font-medium capitalize">{parsingMethod.replaceAll("_", " ")}</span>
              </p>
            ) : null}

            {extractedText ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Extracted text preview</h2>
                <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                  {extractedText.slice(0, 1200)}
                </p>
              </div>
            ) : null}

            <NoteInterpretationCard result={result} />

            <form onSubmit={onAskFollowUp} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/75">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ask a follow-up about this interpreted note</h2>
              <textarea
                value={followUpQuestion}
                onChange={(event) => setFollowUpQuestion(event.target.value)}
                minLength={3}
                placeholder="Example: Should I ask when to repeat these blood tests?"
                className="min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <button type="submit" disabled={!canAskFollowUp || followUpLoading} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900">
                {followUpLoading ? "Answering..." : "Ask follow-up"}
              </button>
              {followUpAnswer ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{followUpAnswer}</p> : null}
            </form>
          </div>
        ) : null}
      </section>
    </RequireAuth>
  );
}
