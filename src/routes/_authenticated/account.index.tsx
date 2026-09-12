import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Receipt, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  sendPhoneChangeOtp,
  verifyPhoneChangeOtp,
} from "@/lib/otp";
import { commitPhoneChange } from "@/lib/phone-change.functions";
import { formatPhone, isValidPhone, normalizePhone } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/account/")({
  head: () => ({
    meta: [
      { title: "My Account — Flamio" },
      { name: "description", content: "Manage your Flamio profile, phone number and orders." },
      { property: "og:title", content: "My Account — Flamio" },
      { property: "og:description", content: "Manage your Flamio profile and orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const commitPhone = useServerFn(commitPhoneChange);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Phone-change verification state (real SMS OTP via the auth provider).
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [configRequired, setConfigRequired] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!profile || hydrated) return;
    setFullName(profile.fullName ?? "");
    setPhone(profile.phone ?? "");
    setEmail(profile.email ?? "");
    setHydrated(true);
  }, [profile, hydrated]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !profile) return;

    if (fullName.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("That email address doesn't look right.");
      return;
    }

    const nextPhone = normalizePhone(phone);
    const phoneChanged = Boolean(profile.phone) && nextPhone !== profile.phone;

    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: profile.id,
      full_name: fullName.trim(),
      phone: profile.phone ?? nextPhone,
      email: email.trim() || null,
    });
    setSaving(false);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "That phone number is already used by another account."
          : "We couldn't save your profile. Please try again.",
      );
      return;
    }
    refreshProfile();

    if (phoneChanged) {
      toast.success("Name and email saved. Verify your new phone number to finish.");
      await startPhoneVerification(nextPhone);
      return;
    }
    toast.success("Profile saved");
  }

  async function startPhoneVerification(target: string, resend = false) {
    if (otpBusy) return;
    setOtpError(null);
    setConfigRequired(false);
    setPendingPhone(target);
    setOtpBusy(true);
    try {
      const sent = await sendPhoneChangeOtp(target);
      if (!sent.ok) {
        setConfigRequired(Boolean(sent.configurationRequired));
        setOtpError(sent.message ?? "We couldn't send the verification code.");
        toast.error(sent.message ?? "We couldn't send the verification code.");
        return;
      }
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      toast.success(resend ? "New code sent" : `Code sent to ${formatPhone(target)}`);
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyPhone(event: React.FormEvent) {
    event.preventDefault();
    if (otpBusy || !pendingPhone) return;
    setOtpError(null);

    if (otpCode.trim().length < 4) {
      setOtpError("Enter the code from the SMS.");
      return;
    }

    setOtpBusy(true);
    try {
      const verified = await verifyPhoneChangeOtp(pendingPhone, otpCode);
      if (!verified.ok) {
        setConfigRequired(Boolean(verified.configurationRequired));
        setOtpError(verified.message ?? "We couldn't verify that code.");
        return;
      }
      const committed = await commitPhone({ data: { phone: pendingPhone } });
      if (!committed.ok) {
        setOtpError(committed.message ?? "We couldn't save your new phone number.");
        return;
      }
      setPendingPhone(null);
      setOtpCode("");
      refreshProfile();
      toast.success("Phone number verified and updated");
    } finally {
      setOtpBusy(false);
    }
  }

  function cancelPhoneChange() {
    setPendingPhone(null);
    setOtpCode("");
    setOtpError(null);
    setConfigRequired(false);
    setPhone(profile?.phone ?? "");
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 pb-28 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-black sm:text-4xl">My Account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {profile?.phone ? formatPhone(profile.phone) : "Keep your details up to date for checkout."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button asChild variant="secondary" size="lg" className="justify-start">
          <Link to="/account/orders">
            <Receipt aria-hidden="true" /> My Orders
          </Link>
        </Button>
        <Button variant="outline" size="lg" className="justify-start" onClick={handleSignOut}>
          <LogOut aria-hidden="true" /> Log out
        </Button>
      </div>

      <form
        onSubmit={handleSave}
        className="mt-6 space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6"
      >
        <h2 className="font-display text-lg font-extrabold">Profile</h2>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            disabled={loading || Boolean(pendingPhone)}
          />
          <p className="text-xs text-muted-foreground">
            Changing your phone number requires SMS verification.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto" disabled={saving} aria-busy={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </form>

      {pendingPhone && (
        <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" /> Verify new number
          </h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            We sent a code to {formatPhone(pendingPhone)}. Enter it to confirm the change.
          </p>

          {configRequired && (
            <div
              role="alert"
              className="mt-4 flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">SMS provider configuration required</p>
                <p className="mt-1 break-words text-muted-foreground">
                  No code was sent. Your phone number was not changed. SMS verification must be
                  enabled for this project first.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerifyPhone} className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="phone-otp">Verification code</Label>
              <Input
                id="phone-otp"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                disabled={configRequired}
              />
            </div>

            {otpError && !configRequired && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {otpError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={otpBusy || configRequired} aria-busy={otpBusy}>
                {otpBusy && <Loader2 className="animate-spin" aria-hidden="true" />}
                {otpBusy ? "Verifying..." : "Verify & update"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={otpBusy || cooldown > 0}
                onClick={() => void startPhoneVerification(pendingPhone, true)}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelPhoneChange} disabled={otpBusy}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
