"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { RequireAuth } from "@/components/RequireAuth";
import { analyzeNoteFile, analyzeNotes, getUserErrorMessage } from "@/lib/api";
import { AnalysisResponse, NoteFileAnalysisResponse } from "@/lib/types";

export default function NoteInterpreterPage() {
  const [noteText, setNoteText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [parsingMethod, setParsingMethod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => noteText.trim().length >= 5 || Boolean(selectedFileName), [noteText, selectedFileName]);

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

  return (
    <RequireAuth>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Note Interpreter</h1>
        <DisclaimerBanner />

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">Use one input method: upload a clinical note file or paste note text directly.</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>Upload supports PDF and image files and uses built-in file parsing/OCR when needed.</li>
            <li>Pasted text avoids extraction errors and is usually the clearest option for MVP interpretation quality.</li>
          </ul>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Option A: Upload note file</legend>
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
              <p className="text-xs text-slate-600">
                Selected file: <span className="font-medium">{selectedFileName}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500">No file selected.</p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Option B: Paste note text</legend>
            <textarea
              className="min-h-52 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-800"
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
          <div className="space-y-3">
            {parsingMethod ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Analysis source: <span className="font-medium capitalize">{parsingMethod.replaceAll("_", " ")}</span>
              </p>
            ) : null}

            {extractedText ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">Extracted text preview</h2>
                <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {extractedText.slice(0, 1200)}
                </p>
              </div>
            ) : null}

            <p className="text-sm text-slate-600">Interpretation is generated from the current input and should always be clinically reviewed.</p>
            <AnalysisResultCard result={result} />
          </div>
        ) : null}
      </section>
    </RequireAuth>
  );
}
