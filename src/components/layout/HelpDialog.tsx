import {
  Sparkles,
  Compass,
  Kanban,
  UserCircle2,
  KeyRound,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS_GUIDE = [
  {
    icon: Sparkles,
    title: "Quick Tailor",
    badge: "AI Key Needed",
    summary:
      "The fast 1-screen studio. Upload a CV (or load from your Master Profile), paste or fetch a job spec, choose Gemini / Claude / ChatGPT + thinking level, and get a match score, skill gaps, tailored CV, cover letter, and interview Q&As.",
  },
  {
    icon: Compass,
    title: "Discover",
    badge: "Free Watchers",
    summary:
      "Scan open feeds (Remotive, HN/YC, Arbeitnow) and live UK company boards (Monzo, Deliveroo, Synthesia, or any Greenhouse/Lever/Ashby slug + optional Adzuna UK) with zero API key needed. Rate roles 👍/👎 to train Bruce, then click Spruce & Apply.",
  },
  {
    icon: Kanban,
    title: "Board",
    badge: "Free Tracker",
    summary:
      "Your Kanban application pipeline (Saved → Drafting → Applied → Interviewing → Offer). Open any card for the Bespoke Studio: 1-click tailored kit, custom ATS Form Q&A drafter, Bruce refinement chat with version undo, and ATS PDF export.",
  },
  {
    icon: UserCircle2,
    title: "Profile",
    badge: "Source of Truth",
    summary:
      "Import your existing CV once, fill in Bruce's Career Brief (target roles, work mode, dealbreakers), and inspect learned feedback. Bruce only uses verified facts from here — never inventing experience. Also includes 1-click JSON backup export/import.",
  },
];

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <HelpCircle className="h-5 w-5 text-primary" />
            How CV Spruce Works
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Your career co-pilot powered by Bruce — works instantly in Local Mode, or syncs across devices when signed in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* API Key vs Free clarity */}
          <div className="rounded-xl border border-border bg-background/70 p-3.5 space-y-1.5">
            <p className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              When is an API Key needed?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Free without any key:</strong> Job Discovery scanning (Watchers), Profile editing, Kanban Board tracking, PDF/Markdown export, and Workspace JSON backups.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Uses your AI key (Quick Tailor, AI Re-Rank, Bespoke Kit, Form Q&amp;A, Bruce Chat):</strong>{" "}
              Google Gemini (<strong>Gemini 4 Hydrogen</strong> / <strong>3.8 Flash</strong>) has a free tier in Google AI Studio; Claude &amp; ChatGPT use pay-as-you-go API keys.
            </p>
          </div>

          {/* Tab-by-tab guide */}
          <div className="space-y-2.5">
            {TABS_GUIDE.map(({ icon: Icon, title, badge, summary }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-background/50 p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-foreground">
                    <Icon className="h-4 w-4 text-primary" />
                    {title}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {badge}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-card-foreground/85">{summary}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-xs text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>Recommended first flow:</strong> 1) Fill or import your <strong>Profile</strong> → 2) Scan roles in <strong>Discover</strong> → 3) Click <strong>Spruce &amp; Apply</strong> to tailor &amp; track on your <strong>Board</strong>.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
