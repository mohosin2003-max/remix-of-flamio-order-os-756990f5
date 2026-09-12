/**
 * Server-only owner authorization. Roles live in `public.user_roles` and are
 * checked with the SECURITY DEFINER `has_role` function, which is executable
 * by the service role only — never by the browser.
 */

export type OwnerContext = { userId: string };

export async function assertOwner(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [owner, admin] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "owner" }),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);

  if (owner.error || admin.error) {
    console.error("Role check failed", owner.error ?? admin.error);
    throw new Error("We couldn't verify your access. Please try again.");
  }

  if (!owner.data && !admin.data) {
    throw new Error("Forbidden");
  }
}
