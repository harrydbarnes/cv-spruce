import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Mail,
  MessageSquare,
  Download,
  Printer,
  Send,
  RotateCcw,
  ExternalLink,
  Loader2,
  Target,
  Calendar,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApplications } from "@/hooks/use-applications";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { usePersistentApiKey } from "@/hooks/use-persistent-api-key";
import { profileToCvMarkdown } from "@/lib/profile-types";
import { callGeminiApi } from "@/lib/gemini-api";
import { callOpenAiApi } from "@/lib/openai-api";
import { callClaudeApi } from "@/lib/claude-api";
import {
  APPLICATION_STATUS_META,
  refineDocumentWithBruce,
  downloadMarkdownFile,
  printCleanDocument,
  type ApplicationStatus,
} from "@/lib/application-utils";
import type { ModelType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";

const callers = {
  gemini: callGeminiApi,
  openai: callOpenAiApi,
  claude: callClaudeApi,
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { applications, updateApplication } = useApplications();
  const { profile } = useCareerProfile();

  const app = applications.find((a) => a.id === id);

  const [model, setModel] = useState<ModelType>("gemini");
  const gemini = usePersistentApiKey("gemini");
  const openai = usePersistentApiKey("openai");
  const claude = usePersistentApiKey("claude");
  const activeKey = { gemini, openai, claude }[model].apiKey;

  const [generating, setGenerating] = useState(false);
  const [chatTarget, setChatTarget] = useState<"cv" | "cover_letter">("cv");
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!app) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Application not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been deleted or not synced yet.
          </p>
          <Button className="mt-6" onClick={() => navigate("/board")}>
            Back to Board
          </Button>
        </main>
      </div>
    );
  }

  const masterCvText = profileToCvMarkdown(profile);

  const handleCopy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleGenerateKit = async () => {
    if (!activeKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Save a Gemini, Claude, or OpenAI key on Quick Tailor first.",
        variant: "destructive",
      });
      return;
    }
    if (!masterCvText.trim()) {
      toast({
        title: "Master Profile Empty",
        description: "Import or fill out your Master Career Profile first so Bruce has verified facts.",
        variant: "destructive",
      });
      return;
    }
    if (!app.jobSpecText.trim()) {
      toast({
        title: "Job Specification Empty",
        description: "Paste the job specification before generating.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const result = await callers[model](
        activeKey,
        masterCvText,
        app.jobSpecText,
        "",
        ["Precision"],
        "Middle",
        "Normal"
      );

      const snapshot = {
        id: `ver-${Date.now()}`,
        label: `Initial ${model.toUpperCase()} draft`,
        tailoredCv: result.tailored_cv,
        coverLetter: result.cover_letter ?? "",
        createdAt: new Date().toISOString(),
      };

      await updateApplication(app.id, {
        matchPercentage: result.match_percentage,
        matchingHighlights: result.matching_highlights,
        missingSkills: result.missing_skills,
        tailoredCv: result.tailored_cv,
        coverLetter: result.cover_letter ?? "",
        interviewQna: result.interview_qna ?? [],
        industryUpdates: result.industry_updates ?? [],
        cvVersions: [snapshot, ...app.cvVersions].slice(0, 12),
      });

      toast({
        title: "Bespoke Kit Ready!",
        description: `Generated fact-grounded CV, cover letter, and interview Q&A (${result.match_percentage}% match).`,
      });
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Could not generate application kit.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRefineChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (!activeKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Save an API key on Quick Tailor to chat with Bruce.",
        variant: "destructive",
      });
      return;
    }

    const currentDoc = chatTarget === "cv" ? app.tailoredCv : app.coverLetter;
    if (!currentDoc.trim()) {
      toast({
        title: "No draft to refine",
        description: "Generate the bespoke kit first before asking Bruce for edits.",
        variant: "destructive",
      });
      return;
    }

    const instruction = chatInput.trim();
    setChatInput("");
    setRefining(true);

    try {
      const { updatedDocument, reply } = await refineDocumentWithBruce({
        provider: model,
        apiKey: activeKey,
        target: chatTarget,
        currentDocument: currentDoc,
        masterProfileText: masterCvText || currentDoc,
        jobSpecText: app.jobSpecText,
        userInstruction: instruction,
      });

      const now = new Date().toISOString();
      const nextCv = chatTarget === "cv" ? updatedDocument : app.tailoredCv;
      const nextCl = chatTarget === "cover_letter" ? updatedDocument : app.coverLetter;

      await updateApplication(app.id, {
        tailoredCv: nextCv,
        coverLetter: nextCl,
        cvVersions: [
          {
            id: `ver-${Date.now()}`,
            label: `Refined ${chatTarget === "cv" ? "CV" : "Cover Letter"}: ${instruction.slice(0, 32)}`,
            tailoredCv: nextCv,
            coverLetter: nextCl,
            createdAt: now,
          },
          ...app.cvVersions,
        ].slice(0, 12),
        chatHistory: [
          ...app.chatHistory,
          { id: `u-${Date.now()}`, role: "user", content: instruction, createdAt: now },
          { id: `a-${Date.now() + 1}`, role: "assistant", content: reply, createdAt: now },
        ],
      });
    } catch (err) {
      toast({
        title: "Refinement failed",
        description: err instanceof Error ? err.message : "Bruce couldn't refine the document.",
        variant: "destructive",
      });
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6 pb-20">
        {/* Top bar */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <Link
              to="/board"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Application Board
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold">{app.roleTitle}</h1>
              <Badge variant="outline" className="text-xs">
                {app.company}
              </Badge>
              {typeof app.matchPercentage === "number" && (
                <Badge variant="default" className="font-mono">
                  {app.matchPercentage}% Match
                </Badge>
              )}
            </div>
            {app.jobUrl && (
              <a
                href={app.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open original job posting
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={app.status}
              onValueChange={(v) =>
                void updateApplication(app.id, { status: v as ApplicationStatus })
              }
            >
              <SelectTrigger className="w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUS_META.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={model} onValueChange={(v) => setModel(v as ModelType)}>
              <SelectTrigger className="w-28 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleGenerateKit} disabled={generating} className="gap-2">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? "Generating..." : "1-Click Bespoke Kit"}
            </Button>
          </div>
        </div>

        {/* Main 2-column studio */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left column: Match, Monitoring, Notes, Spec */}
          <div className="space-y-4 lg:col-span-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-primary" />
                  Match &amp; Gaps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {app.matchingHighlights.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-semibold text-foreground">Strengths</p>
                    <ul className="list-disc space-y-1 pl-4 text-card-foreground/85">
                      {app.matchingHighlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {app.missingSkills.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-semibold text-foreground">
                      Honest Gaps (Not Invented)
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-card-foreground/85">
                      {app.missingSkills.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {app.matchingHighlights.length === 0 && app.missingSkills.length === 0 && (
                  <p className="text-muted-foreground">
                    Click <strong>1-Click Bespoke Kit</strong> to run a full gap analysis against your Master Profile.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  Monitoring &amp; Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="followup-date" className="text-xs">
                    Next Follow-Up Reminder
                  </Label>
                  <Input
                    id="followup-date"
                    type="date"
                    value={app.nextFollowUpAt ? app.nextFollowUpAt.slice(0, 10) : ""}
                    onChange={(e) =>
                      void updateApplication(app.id, {
                        nextFollowUpAt: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : undefined,
                      })
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="app-notes" className="text-xs">
                    Private Notes &amp; Interview Log
                  </Label>
                  <Textarea
                    id="app-notes"
                    rows={4}
                    placeholder="Recruiter name, interview takeaways, salary notes..."
                    value={app.notes}
                    onChange={(e) => void updateApplication(app.id, { notes: e.target.value })}
                    className="bg-background text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Job Specification</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={8}
                  value={app.jobSpecText}
                  onChange={(e) => void updateApplication(app.id, { jobSpecText: e.target.value })}
                  className="bg-background text-xs"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column: Bespoke Documents + Bruce Refinement Chat */}
          <div className="space-y-4 lg:col-span-8">
            <Tabs defaultValue="cv" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
                <TabsTrigger value="cv" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Bespoke CV
                </TabsTrigger>
                <TabsTrigger value="cover" className="gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  Cover Letter
                </TabsTrigger>
                <TabsTrigger value="qna" className="gap-1.5 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Interview Q&amp;A
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  Refine ({app.cvVersions.length})
                </TabsTrigger>
              </TabsList>

              {/* CV Tab */}
              <TabsContent value="cv" className="mt-4">
                <Card className="border-border bg-card">
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                    <div>
                      <CardTitle className="text-lg">Tailored CV (Markdown)</CardTitle>
                      <CardDescription className="text-xs">
                        Edit directly or export as a clean ATS-friendly PDF.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!app.tailoredCv}
                        onClick={() => void handleCopy("cv", app.tailoredCv)}
                        className="gap-1.5 text-xs"
                      >
                        {copiedKey === "cv" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!app.tailoredCv}
                        onClick={() =>
                          downloadMarkdownFile(`${app.company}-${app.roleTitle}-CV`, app.tailoredCv)
                        }
                        className="gap-1.5 text-xs"
                      >
                        <Download className="h-3.5 w-3.5" />
                        .md
                      </Button>
                      <Button
                        size="sm"
                        disabled={!app.tailoredCv}
                        onClick={() =>
                          printCleanDocument(`${app.company} — ${app.roleTitle} CV`, app.tailoredCv)
                        }
                        className="gap-1.5 text-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Export PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      rows={22}
                      value={app.tailoredCv}
                      onChange={(e) => void updateApplication(app.id, { tailoredCv: e.target.value })}
                      placeholder="Click '1-Click Bespoke Kit' above to generate a fact-grounded CV tailored to this role..."
                      className="bg-background font-mono text-xs leading-relaxed"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cover Letter Tab */}
              <TabsContent value="cover" className="mt-4">
                <Card className="border-border bg-card">
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                    <CardTitle className="text-lg">Tailored Cover Letter</CardTitle>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!app.coverLetter}
                        onClick={() => void handleCopy("cl", app.coverLetter)}
                        className="gap-1.5 text-xs"
                      >
                        {copiedKey === "cl" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        disabled={!app.coverLetter}
                        onClick={() =>
                          printCleanDocument(
                            `${app.company} — ${app.roleTitle} Cover Letter`,
                            app.coverLetter
                          )
                        }
                        className="gap-1.5 text-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Export PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      rows={18}
                      value={app.coverLetter}
                      onChange={(e) => void updateApplication(app.id, { coverLetter: e.target.value })}
                      placeholder="Cover letter will appear here after generating..."
                      className="bg-background text-sm leading-relaxed"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Interview Q&A Tab */}
              <TabsContent value="qna" className="mt-4">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Interview Prep Q&amp;A</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {app.interviewQna.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Generate the bespoke kit to get tailored technical &amp; behavioural interview prep.
                      </p>
                    ) : (
                      app.interviewQna.map((qa, idx) => (
                        <div key={idx} className="space-y-1.5 rounded-xl border border-border bg-background/60 p-4">
                          <p className="font-semibold text-sm">
                            Q{idx + 1}: {qa.question}
                          </p>
                          <p className="border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-card-foreground/85">
                            {qa.answer}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Bruce Refinement Chat & Version History Tab */}
              <TabsContent value="chat" className="mt-4 space-y-4">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Refine with Bruce</CardTitle>
                    <CardDescription className="text-xs">
                      Ask for targeted edits (e.g. &ldquo;Make the summary 2 lines&rdquo; or &ldquo;Emphasise TypeScript architecture&rdquo;). Every edit is saved to version history.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-background/60 p-3">
                      {app.chatHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No refinement messages yet. Tell Bruce what to tweak below.
                        </p>
                      ) : (
                        app.chatHistory.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-2.5 text-xs ${
                              msg.role === "user"
                                ? "ml-8 bg-primary text-primary-foreground"
                                : "mr-8 border border-border bg-card text-foreground"
                            }`}
                          >
                            {msg.content}
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleRefineChat} className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={chatTarget}
                        onValueChange={(v) => setChatTarget(v as "cv" | "cover_letter")}
                      >
                        <SelectTrigger className="w-full sm:w-36 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cv">Edit CV</SelectItem>
                          <SelectItem value="cover_letter">Edit Cover Letter</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Tell Bruce how to improve this draft..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 bg-background"
                        disabled={refining}
                      />
                      <Button type="submit" disabled={refining || !chatInput.trim()} className="gap-1.5">
                        {refining ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Refine
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {app.cvVersions.length > 0 && (
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Version History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {app.cvVersions.map((ver) => (
                        <div
                          key={ver.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-2.5 text-xs"
                        >
                          <div>
                            <p className="font-semibold">{ver.label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(ver.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                              void updateApplication(app.id, {
                                tailoredCv: ver.tailoredCv,
                                coverLetter: ver.coverLetter,
                              });
                              toast({ title: "Version Restored", description: ver.label });
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
