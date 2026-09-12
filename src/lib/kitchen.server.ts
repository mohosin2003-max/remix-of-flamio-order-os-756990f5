/**
 * Server-only kitchen authorization. Reuses the existing `public.user_roles`
 * table and the SECURITY DEFINER `has_role` function — no new role table and
 * no second auth system. Owners and admins keep full access; `staff` is the
 * existing enum value used for kitchen users.
 */

export async function assertKitchen(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [owner, admin, staff] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "owner" }),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "staff" }),
  ]);

  const err = owner.error ?? admin.error ?? staff.error;
  if (err) {
    console.error("Kitchen role check failed", err);
    throw new Error("We couldn't verify your access. Please try again.");
  }

  if (!owner.data && !admin.data && !staff.data) {
    throw new Error("Forbidden");
  }
}
