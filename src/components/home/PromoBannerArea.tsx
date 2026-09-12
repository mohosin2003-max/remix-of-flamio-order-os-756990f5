import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import type { PromoBanner } from "@/types/menu";

/**
 * Promotional banner area. Content comes from data (future Owner Dashboard).
 * When no promotions exist, nothing is invented — the slot stays empty.
 */
export function PromoBannerArea({ banners }: { banners: PromoBanner[] }) {
  if (banners.length === 0) return null;

  return (
    <section aria-label="Promotions" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="grid gap-4 md:grid-cols-2">
        {banners.map((banner) => (
          <article
            key={banner.id}
            className="rounded-2xl border border-primary/30 bg-gradient-ember p-6 text-primary-foreground shadow-ember"
          >
            <h3 className="font-display text-xl font-extrabold">{banner.title}</h3>
            {banner.subtitle ? <p className="mt-2 text-sm">{banner.subtitle}</p> : null}
            {banner.ctaLabel && banner.ctaHref ? (
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link to={banner.ctaHref}>{banner.ctaLabel}</Link>
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
