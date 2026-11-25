import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Kanban,
  Plus,
  Clock,
  AlertTriangle,
  Building2,
  ExternalLink,
  Trash2,
  ArrowUpRight,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApplications } from "@/hooks/use-applications";
import {
  APPLICATION_STATUS_META,
  isFollowUpDue,
  isApplicationStale,
  type ApplicationStatus,
} from "@/lib/application-utils";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";

const BOARD_COLUMNS: ApplicationStatus[] = [
  "saved",
  "drafting",
  "applied",
  "interviewing",
  "offer",
  "archived",
];

export default function BoardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { applications, createApplication, updateApplication, deleteApplication } = useApplications();

  const [newOpen, setNewOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobSpecText, setJobSpecText] = useState("");

  const metrics = useMemo(() => {
    const active = applications.filter(
      (a) => !["rejected", "archived"].includes(a.status)
    );
    const interviewing = applications.filter((a) => a.status === "interviewing").length;
    const dueCount = applications.filter((a) => isFollowUpDue(a) || isApplicationStale(a)).length;
    const scored = applications.filter((a) => typeof a.matchPercentage === "number");
    const avgMatch =
      scored.length > 0
        ? Math.round(scored.reduce((acc, a) => acc + (a.matchPercentage ?? 0), 0) / scored.length)
        : null;
    return { activeCount: active.length, interviewing, dueCount, avgMatch };
  }, [applications]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !roleTitle.trim()) return;
    const created = await createApplication({
      company: company.trim(),
      roleTitle: roleTitle.trim(),
      jobUrl: jobUrl.trim() || undefined,
      jobSpecText: jobSpecText.trim(),
      status: "drafting",
    });
    setCompany("");
    setRoleTitle("");
    setJobUrl("");
    setJobSpecText("");
    setNewOpen(false);
    toast({ title: "Application Added", description: "Opening bespoke tailoring studio." });
    navigate(`/applications/${created.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
              <Kanban className="h-8 w-8 text-primary" />
              Application Monitoring Board
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track every bespoke CV, cover letter, interview stage, and follow-up deadline in one place.
            </p>
          </div>

          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 self-start sm:self-auto">
                <Plus className="h-4 w-4" />
                New Application
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg border-border bg-card">
              <DialogHeader>
                <DialogTitle>Track New Application</DialogTitle>
                <DialogDescription>
                  Paste a job posting to create a bespoke CV &amp; cover letter workspace.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="app-company">Company</Label>
                    <Input
                      id="app-company"
                      required
                      placeholder="e.g. Linear"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="app-role">Role Title</Label>
                    <Input
                      id="app-role"
                      required
                      placeholder="e.g. Staff Frontend Engineer"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="app-url">Posting URL (optional)</Label>
                  <Input
                    id="app-url"
                    type="url"
                    placeholder="https://..."
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="app-spec">Job Specification</Label>
                  <Textarea
                    id="app-spec"
                    rows={5}
                    placeholder="Paste the job description here..."
                    value={jobSpecText}
                    onChange={(e) => setJobSpecText(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <Button type="submit" className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  Create &amp; Open Studio
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Monitoring Strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Active Pipeline
              </p>
              <p className="mt-1 text-3xl font-bold text-foreground">{metrics.activeCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Interviewing
              </p>
              <p className="mt-1 text-3xl font-bold text-primary">{metrics.interviewing}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Average Match
              </p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {metrics.avgMatch !== null ? `${metrics.avgMatch}%` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Follow-ups / Stale
              </p>
              <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-foreground">
                {metrics.dueCount}
                {metrics.dueCount > 0 && <AlertTriangle className="h-5 w-5 text-destructive" />}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Kanban Columns */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {BOARD_COLUMNS.map((colStatus) => {
            const meta = APPLICATION_STATUS_META.find((m) => m.id === colStatus)!;
            const colItems = applications.filter((a) =>
              colStatus === "archived"
                ? a.status === "archived" || a.status === "rejected"
                : a.status === colStatus
            );

            return (
              <Card key={colStatus} className="flex flex-col border-border bg-card/90">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base font-bold">{meta.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {colItems.length}
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {colItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                      No applications here yet
                    </div>
                  ) : (
                    colItems.map((app) => {
                      const due = isFollowUpDue(app);
                      const stale = isApplicationStale(app);
                      return (
                        <div
                          key={app.id}
                          className="space-y-2.5 rounded-xl border border-border bg-background/70 p-3.5 transition-all hover:border-primary/60"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link
                                to={`/applications/${app.id}`}
                                className="inline-flex items-center gap-1 font-bold leading-snug hover:text-primary hover:underline"
                              >
                                <span className="truncate">{app.roleTitle}</span>
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                              </Link>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                {app.company}
                              </p>
                            </div>
                            {typeof app.matchPercentage === "number" && (
                              <Badge variant="default" className="shrink-0 font-mono text-xs">
                                {app.matchPercentage}%
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {app.tailoredCv && (
                              <Badge variant="secondary" className="text-[10px]">
                                CV Ready
                              </Badge>
                            )}
                            {app.coverLetter && (
                              <Badge variant="secondary" className="text-[10px]">
                                Cover Letter
                              </Badge>
                            )}
                            {due && (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <Clock className="h-2.5 w-2.5" />
                                Follow-up due
                              </Badge>
                            )}
                            {!due && stale && (
                              <Badge variant="outline" className="gap-1 text-[10px]">
                                <Calendar className="h-2.5 w-2.5" />
                                7d+ no update
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                            <Select
                              value={app.status}
                              onValueChange={(val) =>
                                void updateApplication(app.id, { status: val as ApplicationStatus })
                              }
                            >
                              <SelectTrigger className="h-7 w-32 bg-card text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {APPLICATION_STATUS_META.map((opt) => (
                                  <SelectItem key={opt.id} value={opt.id} className="text-xs">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-1">
                              {app.jobUrl && (
                                <a
                                  href={app.jobUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label="Open job posting"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => void deleteApplication(app.id)}
                                aria-label={`Delete ${app.roleTitle}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
