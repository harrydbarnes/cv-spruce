import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Compass,
  RefreshCw,
  Sparkles,
  Plus,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  MapPin,
  Building2,
  Loader2,
  SlidersHorizontal,
  ArrowRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { useJobDiscovery } from "@/hooks/use-job-discovery";
import { useApplications } from "@/hooks/use-applications";
import { usePersistentApiKey } from "@/hooks/use-persistent-api-key";
import { JOB_SOURCE_LABELS, type DiscoveredJob, type JobSource } from "@/lib/job-feeds";
import { computeScanCadence } from "@/lib/scan-cadence";
import type { ModelType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, lastActiveAt, touchActivity, recordFeedbackSignal } = useCareerProfile();

  useEffect(() => {
    void touchActivity();
  }, [touchActivity]);

  const scanCadence = useMemo(
    () => computeScanCadence(lastActiveAt, profile.preferences.searchStatus),
    [lastActiveAt, profile.preferences.searchStatus]
  );

  const {
    watchers,
    jobs,
    scanning,
    aiScoring,
    scanErrors,
    addWatcher,
    toggleWatcher,
    deleteWatcher,
    runScan,
    runAiDeepScore,
    setJobFeedback,
  } = useJobDiscovery(profile, (signal) => {
    void recordFeedbackSignal(signal);
  });
  const { createApplication } = useApplications();

  const [newName, setNewName] = useState("");
  const [newSource, setNewSource] = useState<JobSource>("remotive");
  const [newQuery, setNewQuery] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newRemoteOnly, setNewRemoteOnly] = useState(false);

  const [filterText, setFilterText] = useState("");
  const [onlyRemote, setOnlyRemote] = useState(false);
  const [hideDisliked, setHideDisliked] = useState(true);

  const [scoreModel, setScoreModel] = useState<ModelType>("gemini");
  const gemini = usePersistentApiKey("gemini");
  const openai = usePersistentApiKey("openai");
  const claude = usePersistentApiKey("claude");
  const activeKey = { gemini, openai, claude }[scoreModel].apiKey;

  const needsSlug = newSource === "greenhouse" || newSource === "lever";

  const handleAddWatcher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsSlug && !newSlug.trim()) {
      toast({
        title: "Company slug required",
        description: "Enter a company board slug (e.g. stripe, linear, monzo).",
        variant: "destructive",
      });
      return;
    }

    const label =
      newName.trim() ||
      (needsSlug ? `${newSlug.trim()} (${newSource})` : `${newQuery.trim() || "All"} on ${newSource}`);

    await addWatcher({
      name: label,
      source: newSource,
      query: newQuery.trim(),
      companySlug: needsSlug ? newSlug.trim().toLowerCase() : undefined,
      remoteOnly: newRemoteOnly,
      enabled: true,
    });

    setNewName("");
    setNewQuery("");
    setNewSlug("");
    toast({ title: "Watcher Added", description: `Ready to scan ${label}.` });
  };

  const handleScan = async () => {
    const found = await runScan();
    toast({
      title: "Scan Complete",
      description: `Scored ${found.length} roles against your Master Career Profile.`,
    });
  };

  const handleAiDeepScore = async () => {
    if (!activeKey.trim()) {
      toast({
        title: "API Key Needed",
        description: "Save a Gemini, Claude, or OpenAI API key on Quick Tailor first.",
        variant: "destructive",
      });
      return;
    }
    try {
      await runAiDeepScore(scoreModel, activeKey);
      toast({
        title: "Bruce AI Ranking Updated",
        description: "Top roles have been deeply scored against your career story & feedback.",
      });
    } catch (err) {
      toast({
        title: "AI Scoring Failed",
        description: err instanceof Error ? err.message : "Could not score roles.",
        variant: "destructive",
      });
    }
  };

  const handleSpruceAndTrack = async (job: DiscoveredJob) => {
    await setJobFeedback(job, "saved");
    const app = await createApplication({
      jobId: job.id,
      company: job.company,
      roleTitle: job.title,
      location: job.location,
      salary: job.salary,
      jobUrl: job.url,
      jobSpecText: `${job.title} at ${job.company}\nLocation: ${job.location}\n\n${job.description}`,
      status: "drafting",
      matchPercentage: job.matchScore,
      matchingHighlights: job.matchReasons,
      missingSkills: job.skillGaps,
    });
    toast({
      title: "Moved to Bespoke Studio",
      description: `Opening ${job.title} @ ${job.company} to generate your tailored CV.`,
    });
    navigate(`/applications/${app.id}`);
  };

  const visibleJobs = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return jobs.filter((job) => {
      if (hideDisliked && (job.feedback === "disliked" || job.feedback === "hidden")) return false;
      if (onlyRemote && !job.remote) return false;
      if (!q) return true;
      return `${job.title} ${job.company} ${job.location} ${job.tags.join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [jobs, filterText, onlyRemote, hideDisliked]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
              <Compass className="h-8 w-8 text-primary" />
              Discover Jobs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bruce scans open feeds &amp; target company boards, ranks matches to your profile, and learns from your 👍/👎 feedback.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-foreground">
                Auto-scan: {scanCadence.label}
              </span>
              <span>· {scanCadence.reason}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleScan} disabled={scanning} className="gap-2">
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {scanning ? "Scanning Feeds..." : "Scan Watchers Now"}
            </Button>

            <div className="flex items-center gap-1.5">
              <Select value={scoreModel} onValueChange={(v) => setScoreModel(v as ModelType)}>
                <SelectTrigger className="h-10 w-28 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleAiDeepScore}
                disabled={aiScoring || visibleJobs.length === 0}
                className="gap-2"
              >
                {aiScoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                AI Re-Rank
              </Button>
            </div>
          </div>
        </div>

        {/* Watchers Panel */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-border bg-card lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Job Watchers ({watchers.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Watch open boards or plug in any Greenhouse/Lever company slug (e.g. <code>stripe</code>, <code>monzo</code>, <code>vercel</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddWatcher} className="space-y-3 rounded-xl border border-border bg-background/60 p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Source</Label>
                  <Select value={newSource} onValueChange={(v) => setNewSource(v as JobSource)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remotive">{JOB_SOURCE_LABELS.remotive}</SelectItem>
                      <SelectItem value="arbeitnow">{JOB_SOURCE_LABELS.arbeitnow}</SelectItem>
                      <SelectItem value="hn_yc">{JOB_SOURCE_LABELS.hn_yc}</SelectItem>
                      <SelectItem value="greenhouse">{JOB_SOURCE_LABELS.greenhouse}</SelectItem>
                      <SelectItem value="lever">{JOB_SOURCE_LABELS.lever}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {needsSlug && (
                  <div className="space-y-1">
                    <Label className="text-xs">Company Board Slug</Label>
                    <Input
                      placeholder="e.g. stripe, airbnb, datadog"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Keyword Filter (optional)</Label>
                  <Input
                    placeholder="e.g. frontend, typescript, product"
                    value={newQuery}
                    onChange={(e) => setNewQuery(e.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Watcher Label (optional)</Label>
                  <Input
                    placeholder="e.g. Senior React Roles"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Label htmlFor="new-remote" className="text-xs">
                    Remote only
                  </Label>
                  <Switch
                    id="new-remote"
                    checked={newRemoteOnly}
                    onCheckedChange={setNewRemoteOnly}
                  />
                </div>

                <Button type="submit" variant="outline" size="sm" className="w-full gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Watcher
                </Button>
              </form>

              <div className="space-y-2">
                {watchers.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 p-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{w.name}</p>
                      <p className="truncate text-muted-foreground">
                        {w.source}
                        {w.companySlug ? ` • ${w.companySlug}` : ""}
                        {w.query ? ` • "${w.query}"` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={w.enabled}
                        onCheckedChange={() => void toggleWatcher(w.id)}
                        aria-label={`Toggle ${w.name}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => void deleteWatcher(w.id)}
                        aria-label={`Delete ${w.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Feed Results */}
          <div className="space-y-4 lg:col-span-2">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
              <Input
                placeholder="Filter discovered roles..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="flex-1 min-w-[180px] bg-background"
              />
              <label className="flex items-center gap-2 text-xs font-medium">
                <Switch checked={onlyRemote} onCheckedChange={setOnlyRemote} />
                Remote only
              </label>
              <label className="flex items-center gap-2 text-xs font-medium">
                <Switch checked={hideDisliked} onCheckedChange={setHideDisliked} />
                Hide passed
              </label>
            </div>

            {scanErrors.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Some watchers had issues:</p>
                  <ul className="list-disc pl-4">
                    {scanErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {visibleJobs.length === 0 ? (
              <Card className="border-dashed border-border bg-card/60">
                <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                  <Compass className="mb-3 h-10 w-10 text-primary/70" />
                  <h2 className="text-lg font-semibold">No jobs scanned yet</h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Click <strong>Scan Watchers Now</strong> to pull fresh roles from Remotive, HN/YC, Arbeitnow, or your target company Greenhouse/Lever boards.
                  </p>
                  <Button onClick={handleScan} disabled={scanning} className="mt-4 gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Scan Watchers Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {visibleJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="border-border bg-card transition-all hover:neon-glow"
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold leading-snug">{job.title}</h3>
                            <Badge variant="outline" className="text-[11px] uppercase">
                              {job.source}
                            </Badge>
                            {job.remote && (
                              <Badge variant="secondary" className="text-[11px]">
                                Remote
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <Building2 className="h-3.5 w-3.5 text-primary" />
                              {job.company}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {job.location}
                            </span>
                            {job.salary && <span>{job.salary}</span>}
                          </div>
                        </div>

                        {typeof job.matchScore === "number" && (
                          <div className="flex shrink-0 flex-col items-center rounded-xl bg-background/70 px-3 py-1.5 text-center border border-border">
                            <span className="text-xl font-bold text-primary">
                              {job.matchScore}%
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Match
                            </span>
                          </div>
                        )}
                      </div>

                      {(job.matchReasons.length > 0 || job.skillGaps.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {job.matchReasons.map((r, idx) => (
                            <Badge
                              key={`r-${idx}`}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              ✓ {r}
                            </Badge>
                          ))}
                          {job.skillGaps.map((g, idx) => (
                            <Badge
                              key={`g-${idx}`}
                              variant="outline"
                              className="text-xs font-normal opacity-80"
                            >
                              Gap: {g}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <p className="mt-3 line-clamp-2 text-xs text-card-foreground/80">
                        {job.description}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={job.feedback === "liked" ? "default" : "ghost"}
                            onClick={() => void setJobFeedback(job, "liked")}
                            className="h-8 gap-1 text-xs"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            More like this
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={job.feedback === "disliked" ? "destructive" : "ghost"}
                            onClick={() => void setJobFeedback(job, "disliked")}
                            className="h-8 gap-1 text-xs"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            Pass
                          </Button>
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-primary hover:underline"
                            >
                              Posting
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleSpruceAndTrack(job)}
                          className="gap-1.5"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Spruce &amp; Apply
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
