"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { RequireAuth } from "@/components/RequireAuth";
import { analyzeNotes, getUserErrorMessage } from "@/lib/api";
import { AnalysisResponse } from "@/lib/types";

function buildPayloadText(noteText: string, selectedFileName: string | null) {
  const trimmedNote = noteText.trim();

  if (trimmedNote) {
    return trimmedNote;
  }

  if (selectedFileName) {
    return `Uploaded file: ${selectedFileName}. File parsing is not enabled yet; please paste note text when available.`;
  }

  return "";
}

export default function NoteInterpreterPage() {
  const [noteText, setNoteText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => noteText.trim().length >= 5 || Boolean(selectedFileName), [noteText, selectedFileName]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFileName(file?.name ?? null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payloadText = buildPayloadText(noteText, selectedFileName);

    if (!payloadText) {
      setError("Upload a note file or paste note text to continue.");
      setLoading(false);
      return;
    }

    try {
      const response = await analyzeNotes({ note_text: payloadText });
      setResult(response);
    } catch (err) {
      setError(getUserErrorMessage(err, "Unable to interpret this note right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Note Interpreter</h1>
        <DisclaimerBanner />

        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Upload a note image or PDF, or paste the text manually.</p>
          <p className="text-xs text-slate-500">Tip: pasted text provides the most accurate interpretation in this MVP release.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">1) Upload file (optional)</legend>
            <label className="block">
              <span className="sr-only">Upload note image or PDF</span>
              <input
                type="file"
                onChange={onFileChange}
                accept="image/*,.pdf,application/pdf"
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
              />
            </label>
            {selectedFileName ? (
              <p className="text-xs text-slate-600">Selected file: <span className="font-medium">{selectedFileName}</span></p>
            ) : (
              <p className="text-xs text-slate-500">No file selected.</p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">2) Paste note text</legend>
            <textarea
              className="min-h-52 w-full rounded-xl border border-slate-300 bg-white p-3"
              placeholder="Paste doctor note text, discharge summary, or visit highlights"
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
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Interpretation is generated from the current input and should be clinically reviewed.</p>
            <AnalysisResultCard result={result} />
          </div>
        ) : null}
      </section>
    </RequireAuth>
  );
}
