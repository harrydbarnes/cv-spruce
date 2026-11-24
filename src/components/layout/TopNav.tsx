import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sparkles,
  Compass,
  Kanban,
  UserCircle2,
  LogIn,
  LogOut,
  Moon,
  Sun,
  Trees,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Quick Tailor", icon: Sparkles },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/board", label: "Board", icon: Kanban },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
];

export function TopNav() {
  const location = useLocation();
  const { user, signOut, isSupabaseConfigured } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark") || localStorage.getItem("cv-spruce-theme") === "dark";
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("cv-spruce-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("cv-spruce-theme", "light");
    }
  }, [isDark]);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md print:hidden"
      >
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trees className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline text-base">CV Spruce</span>
          </Link>

          <div className="flex items-center gap-1 rounded-full border border-border bg-card/70 p-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active =
                to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(to) ||
                    (to === "/board" && location.pathname.startsWith("/applications"));
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9 rounded-full"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 rounded-full border-primary/40">
                    <UserCircle2 className="h-4 w-4 text-primary" />
                    <span className="hidden max-w-[120px] truncate sm:inline">
                      {user.user_metadata?.full_name || user.email?.split("@")[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Master Career Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/board">Application Board</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="gap-1.5 rounded-full"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{isSupabaseConfigured ? "Sign In" : "Sync / Account"}</span>
              </Button>
            )}
          </div>
        </div>
      </nav>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
