# Move the menu into the database (Phase 2 foundation)

## Goal
Today categories, products, variants, and product images live as static seed
data in `src/data/menu.ts`. Move them into the Lovable Cloud database so the
future Owner Dashboard can add/edit/hide/reorder them without code changes.
Keep the customer-facing UI and the verified Home → Menu → Cart → Checkout
flow byte-for-byte identical.

## Scope (this phase)
- IN: `categories`, `products`, `product_variants`, `product_images`.
- OUT (stays static for now): `restaurant` info, `payment_methods`,
  `promo_banners` (the banner list is already empty). These move later with
  the Owner Dashboard. Limiting scope keeps the change safe.

## Schema (new migration, matches existing conventions)
Conventions taken from the live `orders` table: `id uuid default
gen_random_uuid()`, snake_case, `created_at/updated_at timestamptz default
now()`, `numeric` for money, RLS enabled.

```
categories(id, slug text unique, name, description text null,
  image_url text null, is_visible boolean default true,
  sort_order int default 0, created_at, updated_at)

products(id, category_id uuid -> categories(id) on delete cascade,
  slug text unique, name, description text null, base_price numeric not null,
  is_available boolean default true, is_featured boolean default false,
  is_popular boolean default false, badges text[] default '{}',
  sort_order int default 0, created_at, updated_at)

product_variants(id, product_id uuid -> products(id) on delete cascade,
  name, price numeric not null, is_available boolean default true,
  sort_order int default 0, created_at, updated_at)

product_images(id, product_id uuid -> products(id) on delete cascade,
  url text, alt text, is_primary boolean default false,
  sort_order int default 0, created_at, updated_at)
```

## Access (GRANT + RLS on every new table)
Menu is public read, owner-writes go through service_role later:
```
GRANT SELECT ON categories, products, product_variants, product_images TO anon, authenticated;
GRANT ALL    ON categories, products, product_variants, product_images TO service_role;
ALTER TABLE <each> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON <each> FOR SELECT TO anon, authenticated USING (true);
```
No INSERT/UPDATE/DELETE policies yet — only the Owner Dashboard (service_role)
will write. This keeps the menu read-only to the public, matching the README's
"don't add fake functionality" rule.

## Seed the real Flamio menu
Insert all 5 categories and the 24 real products with real prices from
`src/data/menu.ts`. `badges` as a text array (`{popular}`, `{spicy}`, etc.).
Variants left empty for every product (pizza rule: size is optional, owner
adds 6/8/10 inch later). One `product_images` row per product.

## Image handling (keeps current look + future-proof)
Real food photos aren't available yet (README: "use attractive placeholder food
images… easy to replace later"). So `image_url` is seeded as `null`. The
bundled placeholder assets (`cat-burger.jpg`, etc.) stay imported in the
client. In the repository, after fetching DB rows, any `null` image falls back
to the category placeholder asset (keyed by `category_id`). When the owner
later uploads real photos to storage and sets `image_url`, the fallback is
skipped automatically — no code change.

## Server functions — `src/lib/menu.functions.ts`
Thin wrappers (module scope = imports + exported fns only, per project rule):
- `getMenu()` GET, public — returns categories + products + variants + images
  rows, filtered to visible categories, ordered by `sort_order`.
- `getProductBySlug(slug)` GET, public — one product + its variants/images +
  category + 4 related products.
Read via `supabaseAdmin` (service_role) so the read isn't blocked by future
write-only policies; or via a publishable client with anon SELECT. Decision:
use a publishable client created in the handler (anon SELECT already granted)
so reads respect public RLS and stay cacheable.

## Repository rewire — `src/lib/menu-repository.ts`
- `menuQueryOptions().queryFn` calls `getMenu` server fn, then maps DB rows →
  existing `Category`/`Product` domain types, applying the placeholder-image
  fallback. Component-facing return shape is unchanged.
- `productQueryOptions(slug)` calls `getProductBySlug`, same mapping.
- Keep the `imageByCategory` map + asset imports here (client bundle) so
  placeholder URLs resolve.

## SSR / loading
Preserve server-rendered menu: add a `loader` on `menu.index` and the product
route that calls `queryClient.ensureQueryData(menuQueryOptions())` /
`productQueryOptions(slug)` (the server fn is callable server-side). Component
keeps `useSuspenseQuery`. Home-page featured/popular sections already use the
same query cache, so they hydrate from the prefetched menu.

## Verification
1. `bun run build` / typecheck clean (build-errors.log shows "build OK").
2. Re-run the Playwright end-to-end check: Home → Menu → Product → Add to
   Cart → Cart → Checkout, zero console errors, cart shows the added item.
3. Confirm menu page lists all 5 categories and 24 products with correct
   prices and the same placeholder images.

## Risk / rollback
- If the DB read fails, the menu breaks. Mitigation: the server fn returns a
  typed shape and the repository maps defensively; if needed, keep `src/data/
  menu.ts` as a fallback the repository can use on error (logged, not silent).
- Migration is additive (new tables only) — no change to existing
  orders/profiles/favorites/notifications tables.
