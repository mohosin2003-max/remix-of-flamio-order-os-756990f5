import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Search } from "lucide-react";
import { useState } from "react";

import { LocationSelector, useCustomerLocation } from "@/components/layout/LocationSelector";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/context/cart";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/offers", label: "Offers" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const { itemCount, isHydrated } = useCart();
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const { location, setLocation } = useCustomerLocation();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Flamio home">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-ember text-lg font-black text-primary-foreground">
            F
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">Flamio</span>
        </Link>

        <LocationSelector location={location} onSelect={setLocation} />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search the menu"
            onClick={() => setSearchOpen(true)}
          >
            <Search aria-hidden="true" />
          </Button>

          {!loading && isAuthenticated ? <NotificationBell /> : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {navItems.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/cart">
                  Cart{isHydrated && itemCount > 0 ? ` (${itemCount})` : ""}
                </Link>
              </DropdownMenuItem>
              {!loading && isAuthenticated ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/account/orders">My Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account/favorites">My Favorites</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account">My Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleSignOut()}>Log out</DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/auth">Sign in</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
    <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
