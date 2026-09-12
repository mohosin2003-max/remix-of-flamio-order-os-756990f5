import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatBDT } from "@/lib/format";
import { ownerListInventory } from "@/lib/inventory.functions";
import { ownerCreatePurchase, ownerListPurchases } from "@/lib/purchases.functions";

/**
 * Owner → Purchases. Reuses the existing purchases server functions, which
 * raise stock through the existing `apply_stock_change` mechanism. Reports are
 * simple client-side summaries of that same data — no separate expense system.
 */
export const Route = createFileRoute("/_authenticated/owner/purchases")({
  component: OwnerPurchases,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

function OwnerPurchases() {
  const listPurchases = useServerFn(ownerListPurchases);
  const listInventory = useServerFn(ownerListInventory);
  const createPurchase = useServerFn(ownerCreatePurchase);
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    purchasedOn: todayIso(),
    supplierName: "",
    itemId: "",
    quantity: "1",
    unitPrice: "0",
    note: "",
  });

  const purchases = useQuery({
    queryKey: ["owner-purchases"],
    queryFn: () => listPurchases(),
  });
  const inventory = useQuery({
    queryKey: ["owner-inventory"],
    queryFn: () => listInventory(),
  });

  const items = inventory.data?.items ?? [];
  const rows = purchases.data ?? [];

  const quantity = Number(form.quantity) || 0;
  const unitPrice = Number(form.unitPrice) || 0;
  const total = Number((quantity * unitPrice).toFixed(2));

  const reports = useMemo(() => {
    const now = new Date();
    const today = todayIso();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart = startOfWeek.toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7);

    let todayTotal = 0;
    let weekTotal = 0;
    let monthTotal = 0;
    const byIngredient = new Map<string, { quantity: number; unit: string; cost: number }>();
    const bySupplier = new Map<string, number>();
    const byMonth = new Map<string, number>();

    for (const row of rows) {
      if (row.purchasedOn === today) todayTotal += row.totalPrice;
      if (row.purchasedOn >= weekStart) weekTotal += row.totalPrice;
      if (row.purchasedOn.slice(0, 7) === monthStart) monthTotal += row.totalPrice;

      const ing = byIngredient.get(row.itemName) ?? { quantity: 0, unit: row.unit, cost: 0 };
      ing.quantity += row.quantity;
      ing.cost += row.totalPrice;
      byIngredient.set(row.itemName, ing);

      bySupplier.set(row.supplierName, (bySupplier.get(row.supplierName) ?? 0) + row.totalPrice);
      const month = row.purchasedOn.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + row.totalPrice);
    }

    return {
      todayTotal,
      weekTotal,
      monthTotal,
      byIngredient: [...byIngredient.entries()].sort((a, b) => b[1].cost - a[1].cost),
      bySupplier: [...bySupplier.entries()].sort((a, b) => b[1] - a[1]),
      byMonth: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12),
    };
  }, [rows]);

  if (purchases.isLoading || inventory.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (purchases.error) {
    return (
      <EmptyState
        title="Couldn't load purchases"
        description="Something went wrong loading your purchase records."
        action={<Button onClick={() => void purchases.refetch()}>Try again</Button>}
      />
    );
  }

  const save = async () => {
    if (!form.itemId) {
      toast.error("Choose an ingredient first.");
      return;
    }
    setSaving(true);
    try {
      await createPurchase({
        data: {
          purchasedOn: form.purchasedOn,
          supplierName: form.supplierName.trim(),
          itemId: form.itemId,
          quantity,
          unitPrice,
          note: form.note.trim() || null,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owner-purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["owner-inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["owner-stock-movements"] }),
      ]);
      toast.success("Purchase saved and stock updated");
      setForm({
        purchasedOn: todayIso(),
        supplierName: form.supplierName,
        itemId: "",
        quantity: "1",
        unitPrice: "0",
        note: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this purchase");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <EmptyState
          title="Add ingredients first"
          description="Purchases raise the stock of an existing ingredient. Add ingredients in Inventory to start recording purchases."
        />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <h2 className="font-display text-base font-bold">Record a purchase</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pu-date">Date</Label>
                <Input
                  id="pu-date"
                  type="date"
                  value={form.purchasedOn}
                  onChange={(e) => setForm({ ...form, purchasedOn: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu-supplier">Supplier</Label>
                <Input
                  id="pu-supplier"
                  value={form.supplierName}
                  placeholder="e.g. Karwan Bazar Traders"
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ingredient</Label>
                <Select
                  value={form.itemId}
                  onValueChange={(value) => setForm({ ...form, itemId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pu-qty">Quantity</Label>
                  <Input
                    id="pu-qty"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pu-price">Unit price</Label>
                  <Input
                    id="pu-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-note">Note (optional)</Label>
              <Textarea
                id="pu-note"
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span className="text-sm text-muted-foreground">Total cost</span>
              <span className="font-display text-lg font-bold">{formatBDT(total)}</span>
            </div>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save purchase
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Today" value={formatBDT(reports.todayTotal)} />
        <SummaryCard label="This week" value={formatBDT(reports.weekTotal)} />
        <SummaryCard label="This month" value={formatBDT(reports.monthTotal)} />
      </div>

      <PurchaseHistory rows={rows} />

      {rows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ListCard
            title="Purchased by ingredient"
            rows={reports.byIngredient.map(([name, value]) => [
              `${name} · ${value.quantity} ${value.unit}`,
              formatBDT(value.cost),
            ])}
          />
          <ListCard
            title="Supplier totals"
            rows={reports.bySupplier.map(([name, value]) => [name, formatBDT(value)])}
          />
          <ListCard
            title="Monthly expense"
            rows={reports.byMonth.map(([month, value]) => [month, formatBDT(value)])}
          />
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-display text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ListCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="font-display text-sm font-bold">{title}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
