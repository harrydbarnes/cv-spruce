import { useState } from "react";
import { Sparkles, Mail, Lock, User as UserIcon, Loader2, CheckCircle2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const {
    isSupabaseConfigured,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signInWithOAuth,
  } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    const { error } = await signInWithPassword(email, password);
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
    } else {
      toast({ title: "Welcome back!", description: "Your career profile and board are synced." });
      onOpenChange(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    const { error, needsConfirmation } = await signUpWithPassword(email, password, fullName);
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
    } else if (needsConfirmation) {
      setStatusMessage("Check your inbox to confirm your account, then sign in.");
    } else {
      toast({ title: "Account created!", description: "Your local data is ready to sync." });
      onOpenChange(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    const { error } = await signInWithMagicLink(email);
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
    } else {
      setStatusMessage("Magic link sent! Open the link in your email to sign in.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            CV Spruce Account
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Sync your Master Career Profile, Bruce preferences, job watchers, and application board across devices.
          </DialogDescription>
        </DialogHeader>

        {!isSupabaseConfigured ? (
          <div className="space-y-4 rounded-xl border border-border bg-background/60 p-4 text-sm">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">Running in Local-First Guest Mode</p>
                <p className="text-muted-foreground">
                  All features — Quick Tailor, Career Profile, Job Discovery, and the Application Board — already work right now using your browser storage.
                </p>
                <p className="text-xs text-muted-foreground">
                  To enable cloud login &amp; scheduled daily job scanning, add{" "}
                  <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_URL</code> and{" "}
                  <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> to your environment and run{" "}
                  <code className="rounded bg-muted px-1 py-0.5">supabase/migrations/001_initial_schema.sql</code>.
                </p>
              </div>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Continue in Local Mode
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="signin" onValueChange={resetMessages} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="magic">Magic Link</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4 space-y-4">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-4">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Alex Mercer"
                      className="pl-9"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic" className="mt-4 space-y-4">
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Magic Link
                </Button>
              </form>
            </TabsContent>

            {errorMessage && (
              <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {errorMessage}
              </p>
            )}

            {statusMessage && (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-xs text-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {statusMessage}
              </p>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-center text-xs text-muted-foreground">Or continue with</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signInWithOAuth("github")}
                  disabled={submitting}
                >
                  GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signInWithOAuth("google")}
                  disabled={submitting}
                >
                  Google
                </Button>
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
