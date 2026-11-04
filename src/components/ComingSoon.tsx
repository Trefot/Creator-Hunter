import { es } from "../i18n/es";

export function ComingSoon({ title }: { title: string }) {
  return (
    <section className="page">
      <header className="page-header">
        <h1>{title}</h1>
      </header>
      <div className="empty-state">
        <h2>{es.comingSoon.title}</h2>
        <p>{es.comingSoon.body}</p>
      </div>
    </section>
  );
}
