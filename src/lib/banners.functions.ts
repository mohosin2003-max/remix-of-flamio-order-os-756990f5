import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { PromoBanner } from "@/types/menu";

/**
 * Promotional banners. The public read feeds the EXISTING customer rendering
 * (`HomeCarousel` / `PromoBannerArea` through `restaurantQueryOptions`); an
 * empty list keeps the existing fallback behaviour. Owner writes reuse the
 * same `assertOwner` + service-role pattern as coupons and delivery zones.
 */

type BannerRow = Database["public"]["Tables"]["promo_banners"]["Row"];

const COLUMNS = "id,title,subtitle,cta_label,cta_href,is_active,sort_order";

function toRecord(row: BannerRow): PromoBanner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function createPublicClient(url: string, key: string) {
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // New-format sb_ keys are opaque, not JWTs — send apikey only.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Public: active banners for the home carousel and offers page. Never throws —
 * an empty list means the existing fallback content is used. */
export const getPromoBanners = createServerFn({ method: "GET" }).handler(
  async (): Promise<PromoBanner[]> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) return [];

    const supabase = createPublicClient(url, key);
    const { data, error } = await supabase
      .from("promo_banners")
      .select(COLUMNS)
      .eq("is_active", true)
      .order("sort_order")
      .order("title");

    if (error) {
      console.error("Promo banner read failed", error);
      return [];
    }
    return (data ?? []).map((row) => toRecord(row as BannerRow));
  },
);

export const ownerListPromoBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoBanner[]> => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("promo_banners")
      .select(COLUMNS)
      .order("sort_order")
      .order("title");

    if (error) {
      console.error("Promo banner list failed", error);
      throw new Error("We couldn't load banners. Please try again.");
    }
    return (data ?? []).map((row) => toRecord(row as BannerRow));
  });

export const ownerSavePromoBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        title: z.string().trim().min(2).max(120),
        subtitle: z.string().trim().max(240).nullable(),
        ctaLabel: z.string().trim().max(40).nullable(),
        ctaHref: z.string().trim().max(200).nullable(),
        isActive: z.boolean(),
        sortOrder: z.number().int().min(0).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      title: data.title,
      subtitle: data.subtitle,
      cta_label: data.ctaLabel,
      cta_href: data.ctaHref,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    };

    const { error } = data.id
      ? await supabaseAdmin.from("promo_banners").update(payload).eq("id", data.id)
      : await supabaseAdmin.from("promo_banners").insert(payload);

    if (error) {
      console.error("Promo banner save failed", error);
      throw new Error("We couldn't save this banner. Please try again.");
    }
    return { ok: true };
  });

export const ownerDeletePromoBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner.server");
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("promo_banners").delete().eq("id", data.id);
    if (error) {
      console.error("Promo banner delete failed", error);
      throw new Error("We couldn't delete this banner. Please try again.");
    }
    return { ok: true };
  });
