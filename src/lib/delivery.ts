import { queryOptions } from "@tanstack/react-query";

import { deliverySettings, deliveryZones } from "@/data/delivery";
import type {
  DeliveryQuote,
  DeliverySettings,
  DeliveryZone,
  FulfillmentType,
} from "@/types/menu";

/**
 * Single read layer for delivery configuration. Swap the seed data for a
 * server function later without touching any component.
 */
export const deliveryQueryOptions = () =>
  queryOptions({
    queryKey: ["delivery-settings"],
    queryFn: async () => ({
      settings: deliverySettings,
      zones: deliveryZones.filter((z) => z.isActive),
    }),
    staleTime: 5 * 60 * 1000,
  });

export function resolveZone(zones: DeliveryZone[], zoneId: string | null): DeliveryZone | null {
  return zones.find((z) => z.id === zoneId) ?? null;
}

export function quoteDelivery(params: {
  settings: DeliverySettings;
  zone: DeliveryZone | null;
  fulfillment: FulfillmentType;
  subtotal: number;
  discount?: number;
}): DeliveryQuote {
  const { settings, zone, fulfillment, subtotal } = params;
  const discount = params.discount ?? 0;

  if (fulfillment === "pickup") {
    return {
      charge: 0,
      isFree: true,
      freeReason: "pickup",
      minimumOrder: 0,
      meetsMinimumOrder: true,
      freeDeliveryThreshold: null,
      amountToFreeDelivery: null,
      estimatedTime: null,
    };
  }

  const baseCharge = zone?.deliveryCharge ?? settings.defaultDeliveryCharge;
  const minimumOrder = zone?.minimumOrder ?? settings.defaultMinimumOrder;
  const freeEnabled = zone
    ? zone.isFreeDeliveryEnabled && settings.isFreeDeliveryEnabled
    : settings.isFreeDeliveryEnabled;
  const threshold = zone?.freeDeliveryThreshold ?? settings.freeDeliveryThreshold;
  const payable = Math.max(subtotal - discount, 0);

  const qualifiesFree = freeEnabled && threshold !== null && payable >= threshold;

  return {
    charge: qualifiesFree ? 0 : baseCharge,
    isFree: qualifiesFree,
    freeReason: qualifiesFree ? "threshold" : null,
    minimumOrder,
    meetsMinimumOrder: payable >= minimumOrder,
    freeDeliveryThreshold: freeEnabled ? threshold : null,
    amountToFreeDelivery:
      freeEnabled && threshold !== null && payable < threshold ? threshold - payable : null,
    estimatedTime: zone?.estimatedDeliveryTime ?? settings.defaultEstimatedDeliveryTime,
  };
}
