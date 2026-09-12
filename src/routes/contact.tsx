import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { restaurant } from "@/data/restaurant";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Flamio — Kishoreganj Sadar" },
      {
        name: "description",
        content:
          "Find Flamio at Kishoreganj Sadar, Gurudayal College. Location and opening hours for our flame-grilled kitchen.",
      },
      { property: "og:title", content: "Contact Flamio — Kishoreganj Sadar" },
      {
        property: "og:description",
        content: "Find Flamio at Kishoreganj Sadar, Gurudayal College, Bangladesh.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const hoursProvided = restaurant.openingHours.some((h) => h.opensAt && h.closesAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-black sm:text-4xl">Contact</h1>
      <p className="mt-3 text-muted-foreground">{restaurant.about}</p>

      <section className="mt-8 rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-extrabold">Where to find us</h2>
        <p className="mt-3 flex items-start gap-2 text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 text-primary" />
          <span>
            {restaurant.addressLine}
            <br />
            {restaurant.city}, {restaurant.country}
          </span>
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-extrabold">Phone &amp; social</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Phone: {restaurant.phone ?? "Not added yet"}</li>
          <li>Email: {restaurant.email ?? "Not added yet"}</li>
          <li>Facebook: {restaurant.facebookUrl ?? "Not added yet"}</li>
          <li>Instagram: {restaurant.instagramUrl ?? "Not added yet"}</li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-extrabold">Opening hours</h2>
        {hoursProvided ? (
          <dl className="mt-3 space-y-1.5 text-sm">
            {restaurant.openingHours.map((h) => (
              <div key={h.day} className="flex justify-between">
                <dt className="text-muted-foreground">{h.day}</dt>
                <dd>{h.opensAt && h.closesAt ? `${h.opensAt} – ${h.closesAt}` : "Closed"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Opening hours not added yet.</p>
        )}
      </section>
    </div>
  );
}
