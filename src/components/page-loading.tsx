import { Leaf } from "lucide-react";

export function PageLoading({ title }: { title: string }) {
  return (
    <section className="loading-content" role="status" aria-label={`${title} wird geladen`}>
      <div className="loading-skeleton" aria-hidden="true">
        <i className="loading-bar short" />
        <i className="loading-bar title" />
        <div className="loading-cards">
          <i /><i /><i /><i />
        </div>
        <i className="loading-panel" />
      </div>
      <p><Leaf size={14} /> {title} wird geladen …</p>
    </section>
  );
}
