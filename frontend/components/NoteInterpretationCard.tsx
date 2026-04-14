import { NoteInterpretationResponse } from "@/lib/types";

function EmptyState({ message }: { message: string }) {
  return <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>;
}

export function NoteInterpretationCard({ result }: { result: NoteInterpretationResponse }) {
  return (
    <article className="frosted-panel animate-fade-up space-y-5 rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Interpreted Note</h2>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">1. Plain-English Summary</h3>
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          {result.plain_english_summary}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">2. Medicines / Treatment Mentioned</h3>
        {result.medicines_treatments.length === 0 ? (
          <EmptyState message="No medicines or treatments were clearly mentioned in this note." />
        ) : (
          <ul className="mt-2 space-y-2">
            {result.medicines_treatments.map((entry) => (
              <li key={entry.item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.item}</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{entry.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">3. Medical Terms Explained</h3>
        {result.medical_terms_explained.length === 0 ? (
          <EmptyState message="No key medical terms needed extra explanation." />
        ) : (
          <ul className="mt-2 space-y-2">
            {result.medical_terms_explained.map((entry) => (
              <li key={entry.term} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.term}</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{entry.plain_english}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">4. What You May Need To Do</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          {result.next_steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">5. Questions You May Want To Ask</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          {result.follow_up_questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
