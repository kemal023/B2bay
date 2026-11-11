import type { LegalDoc } from "@/lib/legal";

export function LegalPage({ doc, updatedLabel }: { doc: LegalDoc; updatedLabel: string }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {updatedLabel} {doc.updated}
      </p>
      <p className="mt-6 leading-relaxed">{doc.intro}</p>
      <div className="mt-8 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="mt-2 leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
