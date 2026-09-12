import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  ownerDeletePromoBanner,
  ownerListPromoBanners,
  ownerSavePromoBanner,
} from "@/lib/banners.functions";
import type { PromoBanner } from "@/types/menu";

/**
 * Owner → Banners. Thin UI over the promo banner server functions; the
 * customer-side rendering (HomeCarousel / PromoBannerArea) is untouched.
 */
export const Route = createFileRoute("/_authenticated/owner/banners")({
  component: OwnerBanners,
});

type FormState = {
  id: string | null;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
  sortOrder: string;
};

const emptyForm = (): FormState => ({
  id: null,
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaHref: "",
  isActive: true,
  sortOrder: "0",
});

function toForm(b: PromoBanner): FormState {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle ?? "",
    ctaLabel: b.ctaLabel ?? "",
    ctaHref: b.ctaHref ?? "",
    isActive: b.isActive,
    sortOrder: String(b.sortOrder),
  };
}

function OwnerBanners() {
  const list = useServerFn(ownerListPromoBanners);
  const save = useServerFn(ownerSavePromoBanner);
  const remove = useServerFn(ownerDeletePromoBanner);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const banners = useQuery({
    queryKey: ["owner-banners"],
    queryFn: () => list(),
  });

  if (banners.isLoading) return <Skeleton className="h-96 w-full" />;

  if (banners.error) {
    return (
      <EmptyState
        title="Couldn't load banners"
        description="Something went wrong loading your banners."
        action={<Button onClick={() => void banners.refetch()}>Try again</Button>}
      />
    );
  }

  const rows = banners.data ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["owner-banners"] });
    // The customer carousel reads through the shared restaurant query.
    await queryClient.invalidateQueries({ queryKey: ["restaurant"] });
  };

  const persist = async (payload: {
    id: string | null;
    title: string;
    subtitle: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
    isActive: boolean;
    sortOrder: number;
  }) => {
    await save({ data: payload });
    await refresh();
  };

  const submit = async () => {
    setSaving(true);
    try {
      await persist({
        id: form.id,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        ctaLabel: form.ctaLabel.trim() || null,
        ctaHref: form.ctaHref.trim() || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      });
      setForm(emptyForm());
      toast.success("Banner saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this banner");
    } finally {
      setSaving(false);
    }
  };

  const move = async (banner: PromoBanner, direction: -1 | 1) => {
    const index = rows.findIndex((r) => r.id === banner.id);
    const swap = rows[index + direction];
    if (!swap) return;
    try {
      await save({
        data: {
          id: banner.id,
          title: banner.title,
          subtitle: banner.subtitle,
          ctaLabel: banner.ctaLabel,
          ctaHref: banner.ctaHref,
          isActive: banner.isActive,
          sortOrder: swap.sortOrder === banner.sortOrder ? index + direction : swap.sortOrder,
        },
      });
      await save({
        data: {
          id: swap.id,
          title: swap.title,
          subtitle: swap.subtitle,
          ctaLabel: swap.ctaLabel,
          ctaHref: swap.ctaHref,
          isActive: swap.isActive,
          sortOrder: swap.sortOrder === banner.sortOrder ? index : banner.sortOrder,
        },
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reorder banners");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4">
          <h2 className="font-display text-base font-bold">
            {form.id ? "Edit banner" : "New banner"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bn-title">Title</Label>
              <Input
                id="bn-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bn-sub">Subtitle (optional)</Label>
              <Input
                id="bn-sub"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bn-cta">Button label (optional)</Label>
              <Input
                id="bn-cta"
                value={form.ctaLabel}
                onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bn-href">Button link (optional)</Label>
              <Input
                id="bn-href"
                value={form.ctaHref}
                placeholder="/menu"
                onChange={(e) => setForm({ ...form, ctaHref: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bn-sort">Display order</Label>
              <Input
                id="bn-sort"
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <Label htmlFor="bn-active">Active</Label>
              <Switch
                id="bn-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={() => void submit()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? "Save changes" : "Create banner"}
            </Button>
            {form.id ? (
              <Button variant="outline" onClick={() => setForm(emptyForm())}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-base font-bold">Banners</h2>
        {rows.length === 0 ? (
          <EmptyState
            title="No banners yet"
            description="With no banners the home carousel keeps showing your featured items."
          />
        ) : (
          rows.map((b, i) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold">
                    {b.title}
                    <Badge variant={b.isActive ? "default" : "secondary"}>
                      {b.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {b.subtitle ?? "No subtitle"}
                    {b.ctaLabel ? ` · ${b.ctaLabel}` : ""}
                    {b.ctaHref ? ` → ${b.ctaHref}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={i === 0}
                    aria-label={`Move ${b.title} up`}
                    onClick={() => void move(b, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={i === rows.length - 1}
                    aria-label={`Move ${b.title} down`}
                    onClick={() => void move(b, 1)}
                  >
                    ↓
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setForm(toForm(b))}>
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete banner ${b.title}`}
                    onClick={async () => {
                      try {
                        await remove({ data: { id: b.id } });
                        await refresh();
                        toast.success("Banner deleted");
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Couldn't delete this banner",
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
