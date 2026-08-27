import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function LegalPage({ eyebrow, title, summary, sections }: { eyebrow: string; title: string; summary: string; sections: Array<{ title: string; body: React.ReactNode }> }) {
  return <div className="min-h-screen"><SiteHeader /><main className="content-grid grid gap-12 py-16 lg:grid-cols-[0.55fr_1fr]"><header className="flex flex-col gap-4"><p className="eyebrow">{eyebrow}</p><h1 className="text-6xl leading-none font-medium text-primary">{title}</h1><p className="text-lg leading-8 text-muted-foreground">{summary}</p><p className="text-xs text-muted-foreground">Pilot notice · Updated 26 August 2026</p></header><article className="flex max-w-3xl flex-col gap-10">{sections.map((section) => <section key={section.title} className="flex flex-col gap-3"><h2 className="text-3xl font-medium text-primary">{section.title}</h2><div className="flex flex-col gap-3 text-sm leading-7 text-muted-foreground">{section.body}</div></section>)}</article></main><SiteFooter /></div>;
}
