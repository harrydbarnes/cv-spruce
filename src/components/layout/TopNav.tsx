import { useState, useEffect, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
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
  HelpCircle,
  KeyRound,
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
import { cn } from "@/lib/utils";

const AuthDialog = lazy(() =>
  import("@/components/auth/AuthDialog").then((m) => ({ default: m.AuthDialog }))
);
const HelpDialog = lazy(() =>
  import("@/components/layout/HelpDialog").then((m) => ({ default: m.HelpDialog }))
);
const ApiKeysDialog = lazy(() =>
  import("@/components/layout/ApiKeysDialog").then((m) => ({ default: m.ApiKeysDialog }))
);

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      document.documentElement.classList.contains("dark") ||
      localStorage.getItem("cv-spruce-theme") === "dark"
    );
  });

  useEffect(() => {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("cv-spruce-theme", "dark");
      themeMeta?.setAttribute("content", "#212900");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("cv-spruce-theme", "light");
      themeMeta?.setAttribute("content", "#CCFF00");
    }
  }, [isDark]);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="sticky top-0 z-40 w-full overflow-x-hidden border-b border-border/80 bg-background/85 backdrop-blur-md print:hidden"
      >
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-1.5 px-2.5 sm:gap-3 sm:px-4">
          {/* Brand */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
          >
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trees className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <span className="hidden lg:inline text-base">CV Spruce</span>
          </Link>

          {/* Animated Mode Tabs */}
          <div className="flex min-w-0 items-center gap-0.5 rounded-full border border-border bg-card/70 p-0.5 sm:gap-1 sm:p-1 shadow-sm">
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
                  aria-label={label}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3.5",
                    active
                      ? "text-primary-foreground"
                      : "text-foreground/80 hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNavTab"
                      className="absolute inset-0 rounded-full bg-primary shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                        mass: 0.8,
                      }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden md:inline whitespace-nowrap">{label}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right Utilities */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setKeysOpen(true)}
              aria-label="Manage AI API keys"
              title="Manage AI API keys"
              className="h-7 w-7 sm:h-9 sm:w-9 rounded-full"
            >
              <KeyRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHelpOpen(true)}
              aria-label="How CV Spruce works"
              title="How CV Spruce works"
              className="h-7 w-7 sm:h-9 sm:w-9 rounded-full"
            >
              <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="h-7 w-7 sm:h-9 sm:w-9 rounded-full"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 sm:h-8 gap-1.5 rounded-full border-primary/40 px-2 sm:px-3"
                  >
                    <UserCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    <span className="hidden max-w-[110px] truncate sm:inline text-xs">
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
                aria-label={isSupabaseConfigured ? "Sign In" : "Sync or Account"}
                className="h-7 sm:h-8 shrink-0 gap-1.5 rounded-full px-2 sm:px-3 text-xs"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline whitespace-nowrap">
                  {isSupabaseConfigured ? "Sign In" : "Sync / Account"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </nav>

      <Suspense fallback={null}>
        {authOpen && <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />}
        {helpOpen && <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />}
        {keysOpen && <ApiKeysDialog open={keysOpen} onOpenChange={setKeysOpen} />}
      </Suspense>
    </>
  );
}
