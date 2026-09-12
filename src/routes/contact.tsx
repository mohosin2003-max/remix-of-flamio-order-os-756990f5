import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";

import { restaurant } from "@/data/restaurant";
import { getPublicRestaurantInfo } from "@/lib/restaurant.functions";

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
  const getInfo = useServerFn(getPublicRestaurantInfo);
  const infoQuery = useQuery({
    queryKey: ["public-restaurant-info"],
    queryFn: () => getInfo(),
    staleTime: 60_000,
  });
  const info = infoQuery.data ?? null;

  const phone = info?.phone ?? restaurant.phone;
  const email = info?.email ?? restaurant.email;
  const facebookUrl = info?.facebookUrl ?? restaurant.facebookUrl;
  const instagramUrl = info?.instagramUrl ?? restaurant.instagramUrl;
  const googleMapsUrl = info?.googleMapsUrl ?? restaurant.googleMapsUrl;
  const addressLine = info?.addressLine ?? restaurant.addressLine;
  const city = info?.city ?? restaurant.city;
  const country = info?.country ?? restaurant.country;
  const hoursText = info?.opensAt && info?.closesAt ? `${info.opensAt} – ${info.closesAt}` : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-black sm:text-4xl">Contact</h1>
      <p className="mt-3 text-muted-foreground">{restaurant.about}</p>

      <section className="mt-8 rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-extrabold">Where to find us</h2>
        <p className="mt-3 flex items-start gap-2 text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 text-primary" />
          <span>
            {addressLine}
            <br />
            {city}, {country}
          </span>
        </p>
        {googleMapsUrl ? (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open in Google Maps
          </a>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-extrabold">Phone &amp; social</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Phone: {phone ?? "Not added yet"}</li>
          <li>Email: {email ?? "Not added yet"}</li>
          <li>
            Facebook:{" "}
            {facebookUrl ? (
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Visit our page
              </a>
            ) : (
              "Not added yet"
            )}
          </li>
          <li>
            Instagram:{" "}
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Follow us
              </a>
            ) : (
              "Not added yet"
            )}
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-extrabold">Opening hours</h2>
        {hoursText ? (
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Every day</span>
              <span>{hoursText}</span>
            </div>
            {info && !info.isOpen ? (
              <p className="text-sm text-muted-foreground">
                We&apos;re not taking orders right now.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Opening hours not added yet.</p>
        )}
      </section>
    </div>
  );
}
