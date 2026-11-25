import { useState, useMemo, useRef } from "react";
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
  HelpCircle,
  Eye,
  Code2,
  Package,
  ClipboardCheck,
  Mic,
  MicOff,
  PoundSterling,
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
import { useAiPreferences } from "@/hooks/use-ai-preferences";
import { profileToCvMarkdown } from "@/lib/profile-types";
import { callGeminiApi } from "@/lib/gemini-api";
import { callOpenAiApi } from "@/lib/openai-api";
import { callClaudeApi } from "@/lib/claude-api";
import {
  APPLICATION_STATUS_META,
  PDF_THEME_OPTIONS,
  refineDocumentWithBruce,
  draftApplicationAnswerWithBruce,
  evaluateMockInterviewAnswerWithBruce,
  generateUkSalaryCoachWithBruce,
  downloadMarkdownFile,
  printCleanDocument,
  markdownToPrintHtml,
  extractAtsKeywordCoverage,
  type ApplicationStatus,
  type PdfTheme,
  type MockInterviewEvaluation,
  type UkSalaryCoachPlan,
} from "@/lib/application-utils";
import { downloadApplyPackZip } from "@/lib/zip-pack";
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

  const {
    provider: model,
    modelId: activeModelId,
    thinkingLevel,
    setProvider: setModel,
  } = useAiPreferences();

  const gemini = usePersistentApiKey("gemini");
  const openai = usePersistentApiKey("openai");
  const claude = usePersistentApiKey("claude");
  const activeKey = { gemini, openai, claude }[model].apiKey;

  const [generating, setGenerating] = useState(false);
  const [pdfTheme, setPdfTheme] = useState<PdfTheme>("classic");
  const [cvViewMode, setCvViewMode] = useState<"edit" | "split" | "preview">("split");
  const [chatTarget, setChatTarget] = useState<"cv" | "cover_letter">("cv");
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Custom ATS Form Question Drafter state
  const [formQuestion, setFormQuestion] = useState("");
  const [formTone, setFormTone] = useState<"concise" | "detailed">("concise");
  const [draftingAnswer, setDraftingAnswer] = useState(false);
  const [draftedAnswers, setDraftedAnswers] = useState<
    Array<{ id: string; question: string; answer: string; keyPointsUsed: string[] }>
  >([]);

  // Interactive Mock Interview state
  const [mockIdx, setMockIdx] = useState(0);
  const [mockCustomQ, setMockCustomQ] = useState("");
  const [mockAnswer, setMockAnswer] = useState("");
  const [evaluatingMock, setEvaluatingMock] = useState(false);
  const [mockFeedback, setMockFeedback] = useState<MockInterviewEvaluation | null>(null);
  const [listeningMock, setListeningMock] = useState(false);
  const mockRecRef = useRef<{ stop: () => void } | null>(null);

  // UK Salary Coach state
  const [coachingSalary, setCoachingSalary] = useState(false);
  const [salaryPlan, setSalaryPlan] = useState<UkSalaryCoachPlan | null>(null);

  const keywordCoverage = useMemo(
    () => extractAtsKeywordCoverage(app?.jobSpecText ?? "", app?.tailoredCv ?? ""),
    [app?.jobSpecText, app?.tailoredCv]
  );

  const cvPreviewHtml = useMemo(
    () => markdownToPrintHtml(app?.tailoredCv ?? ""),
    [app?.tailoredCv]
  );

  const quickCopyFields = useMemo(
    () =>
      [
        { key: "name", label: "Name", value: profile.basics.fullName },
        { key: "email", label: "Email", value: profile.basics.email },
        { key: "phone", label: "Phone", value: profile.basics.phone },
        { key: "location", label: "Location", value: profile.basics.location },
        { key: "linkedin", label: "LinkedIn", value: profile.basics.linkedinUrl },
        { key: "github", label: "GitHub", value: profile.basics.githubUrl },
        { key: "salary", label: "Salary Target", value: profile.preferences.minSalary },
      ].filter((f) => f.value.trim().length > 0),
    [profile]
  );

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
        "Normal",
        activeModelId,
        thinkingLevel
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
        description: "Tap the 🔑 button in the top bar to save an AI key first.",
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
        modelId: activeModelId,
        thinkingLevel,
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

  const handleDraftFormAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim()) return;
    if (!activeKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Tap the 🔑 button in the top bar to save a Gemini, Claude, or OpenAI key.",
        variant: "destructive",
      });
      return;
    }

    setDraftingAnswer(true);
    try {
      const q = formQuestion.trim();
      const res = await draftApplicationAnswerWithBruce({
        provider: model,
        modelId: activeModelId,
        thinkingLevel,
        apiKey: activeKey,
        question: q,
        company: app.company,
        roleTitle: app.roleTitle,
        masterProfileText: masterCvText || app.tailoredCv,
        careerStory: profile.careerStory,
        jobSpecText: app.jobSpecText,
        tone: formTone,
      });
      setDraftedAnswers((prev) => [
        { id: `ans-${Date.now()}`, question: q, answer: res.answer, keyPointsUsed: res.keyPointsUsed ?? [] },
        ...prev,
      ]);
      setFormQuestion("");
    } catch (err) {
      toast({
        title: "Draft failed",
        description: err instanceof Error ? err.message : "Could not draft answer.",
        variant: "destructive",
      });
    } finally {
      setDraftingAnswer(false);
    }
  };

  const handleDownloadApplyPack = () => {
    const entries: Array<{ name: string; content: string }> = [];
    if (app.tailoredCv.trim()) {
      entries.push({ name: "01-Tailored-CV.md", content: app.tailoredCv });
    }
    if (app.coverLetter.trim()) {
      entries.push({ name: "02-Cover-Letter.md", content: app.coverLetter });
    }
    if (draftedAnswers.length > 0) {
      entries.push({
        name: "03-Form-Answers.md",
        content: draftedAnswers
          .map((d, idx) => `## Q${idx + 1}: ${d.question}\n\n${d.answer}`)
          .join("\n\n---\n\n"),
      });
    }
    if (app.interviewQna.length > 0) {
      entries.push({
        name: "04-Interview-Prep.md",
        content: app.interviewQna
          .map((qa, idx) => `### Q${idx + 1}: ${qa.question}\n\n${qa.answer}`)
          .join("\n\n"),
      });
    }
    if (entries.length === 0) {
      toast({
        title: "Nothing to Bundle Yet",
        description: "Generate your bespoke kit or draft answers first.",
      });
      return;
    }
    downloadApplyPackZip(`${app.company}-${app.roleTitle}`, entries);
    toast({
      title: "Apply Pack Downloaded",
      description: `Bundled ${entries.length} documents into a .zip archive.`,
    });
  };

  const activeMockQuestion =
    app.interviewQna[mockIdx]?.question ||
    mockCustomQ.trim() ||
    `Tell me about a challenging project relevant to ${app.roleTitle} at ${app.company}.`;

  const toggleMockVoice = () => {
    const Ctor =
      typeof window !== "undefined"
        ? ((window as unknown as Record<string, unknown>).SpeechRecognition ||
            (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
        : undefined;
    if (!Ctor) {
      toast({
        title: "Voice Input Unavailable",
        description: "Your browser does not support speech dictation.",
      });
      return;
    }
    if (listeningMock && mockRecRef.current) {
      mockRecRef.current.stop();
      setListeningMock(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (Ctor as any)();
    rec.lang = "en-GB";
    rec.continuous = false;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript ?? "";
      if (t) setMockAnswer((prev) => `${prev ? `${prev} ` : ""}${t}`);
    };
    rec.onerror = () => setListeningMock(false);
    rec.onend = () => setListeningMock(false);
    mockRecRef.current = rec;
    setListeningMock(true);
    rec.start();
  };

  const handleEvaluateMock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockAnswer.trim()) return;
    if (!activeKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Tap the 🔑 button in the top bar to save an AI key first.",
        variant: "destructive",
      });
      return;
    }
    setEvaluatingMock(true);
    try {
      const feedback = await evaluateMockInterviewAnswerWithBruce({
        provider: model,
        modelId: activeModelId,
        thinkingLevel,
        apiKey: activeKey,
        question: activeMockQuestion,
        userAnswer: mockAnswer.trim(),
        company: app.company,
        roleTitle: app.roleTitle,
        masterProfileText: masterCvText || app.tailoredCv,
        jobSpecText: app.jobSpecText,
      });
      setMockFeedback(feedback);
    } catch (err) {
      toast({
        title: "Evaluation failed",
        description: err instanceof Error ? err.message : "Could not evaluate answer.",
        variant: "destructive",
      });
    } finally {
      setEvaluatingMock(false);
    }
  };

  const handleSalaryCoach = async () => {
    if (!activeKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Tap the 🔑 button in the top bar to save an AI key first.",
        variant: "destructive",
      });
      return;
    }
    setCoachingSalary(true);
    try {
      const plan = await generateUkSalaryCoachWithBruce({
        provider: model,
        modelId: activeModelId,
        thinkingLevel,
        apiKey: activeKey,
        company: app.company,
        roleTitle: app.roleTitle,
        location: app.location,
        listedSalary: app.salary,
        targetFloor: profile.preferences.minSalary,
        masterProfileText: masterCvText || app.tailoredCv,
        jobSpecText: app.jobSpecText,
      });
      setSalaryPlan(plan);
    } catch (err) {
      toast({
        title: "Salary Coach failed",
        description: err instanceof Error ? err.message : "Could not build negotiation brief.",
        variant: "destructive",
      });
    } finally {
      setCoachingSalary(false);
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

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadApplyPack}
              className="gap-1.5"
            >
              <Package className="h-4 w-4" />
              Apply Pack (.zip)
            </Button>

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

        {/* Quick-Fill Clipboard Bar for ATS forms */}
        {quickCopyFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/80 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
              Quick-Fill Copy:
            </span>
            {quickCopyFields.map((field) => (
              <Button
                key={field.key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleCopy(`qf-${field.key}`, field.value)}
                className="h-7 gap-1 text-xs bg-background"
                title={field.value}
              >
                {copiedKey === `qf-${field.key}` ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {field.label}
              </Button>
            ))}
          </div>
        )}

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

          {/* Right column: Bespoke Documents + Form Q&A + Bruce Refinement Chat */}
          <div className="space-y-4 lg:col-span-8">
            <Tabs defaultValue="cv" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-card border border-border">
                <TabsTrigger value="cv" className="gap-1 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Bespoke CV</span>
                  <span className="sm:hidden">CV</span>
                </TabsTrigger>
                <TabsTrigger value="cover" className="gap-1 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cover Letter</span>
                  <span className="sm:hidden">Letter</span>
                </TabsTrigger>
                <TabsTrigger value="form_qna" className="gap-1 text-xs">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Form Q&amp;A</span>
                  <span className="sm:hidden">Forms</span>
                </TabsTrigger>
                <TabsTrigger value="qna" className="gap-1 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Interview</span>
                  <span className="sm:hidden">Prep</span>
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-1 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  Refine ({app.cvVersions.length})
                </TabsTrigger>
              </TabsList>

              {/* CV Tab */}
              <TabsContent value="cv" className="mt-4">
                <Card className="border-border bg-card">
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                    <div>
                      <CardTitle className="text-lg">Tailored CV (Markdown + Live Preview)</CardTitle>
                      <CardDescription className="text-xs">
                        Edit Markdown, inspect live ATS keyword coverage, or export a themed PDF.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                        {(
                          [
                            { id: "edit", label: "Edit", icon: Code2 },
                            { id: "split", label: "Split", icon: FileText },
                            { id: "preview", label: "Preview", icon: Eye },
                          ] as const
                        ).map(({ id: modeId, label, icon: ModeIcon }) => (
                          <button
                            key={modeId}
                            type="button"
                            onClick={() => setCvViewMode(modeId)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                              cvViewMode === modeId
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <ModeIcon className="h-3 w-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                      <Select value={pdfTheme} onValueChange={(v) => setPdfTheme(v as PdfTheme)}>
                        <SelectTrigger className="h-8 w-36 bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PDF_THEME_OPTIONS.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          printCleanDocument(
                            `${app.company} — ${app.roleTitle} CV`,
                            app.tailoredCv,
                            pdfTheme
                          )
                        }
                        className="gap-1.5 text-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Export PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Live ATS Keyword Coverage Bar */}
                    {(keywordCoverage.matched.length > 0 || keywordCoverage.missing.length > 0) && (
                      <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold">
                            ATS Spec Keyword Coverage: {keywordCoverage.coveragePct}%
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {keywordCoverage.matched.length} matched · {keywordCoverage.missing.length} missing
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {keywordCoverage.matched.map((kw) => (
                            <Badge key={`m-${kw}`} variant="secondary" className="text-[10px]">
                              ✓ {kw}
                            </Badge>
                          ))}
                          {keywordCoverage.missing.map((kw) => (
                            <Badge key={`x-${kw}`} variant="outline" className="text-[10px] opacity-70">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className={
                        cvViewMode === "split" ? "grid gap-3 md:grid-cols-2" : "block"
                      }
                    >
                      {cvViewMode !== "preview" && (
                        <Textarea
                          rows={22}
                          value={app.tailoredCv}
                          onChange={(e) => void updateApplication(app.id, { tailoredCv: e.target.value })}
                          placeholder="Click '1-Click Bespoke Kit' above to generate a fact-grounded CV tailored to this role..."
                          className="bg-background font-mono text-xs leading-relaxed"
                        />
                      )}

                      {cvViewMode !== "edit" && (
                        <div className="h-[490px] overflow-y-auto rounded-lg border border-border bg-white p-5 text-zinc-900 shadow-inner">
                          {app.tailoredCv.trim() ? (
                            <div
                              className="prose prose-sm max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:border-b [&_h2]:border-zinc-200 [&_h2]:pb-1 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_p]:my-1.5 [&_p]:text-xs [&_li]:text-xs"
                              dangerouslySetInnerHTML={{ __html: cvPreviewHtml }}
                            />
                          ) : (
                            <p className="text-xs text-zinc-500">
                              Live CV preview will appear here once generated or typed.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cover Letter Tab */}
              <TabsContent value="cover" className="mt-4">
                <Card className="border-border bg-card">
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                    <CardTitle className="text-lg">Tailored Cover Letter</CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Select value={pdfTheme} onValueChange={(v) => setPdfTheme(v as PdfTheme)}>
                        <SelectTrigger className="h-8 w-36 bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PDF_THEME_OPTIONS.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                            app.coverLetter,
                            pdfTheme
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

              {/* Custom ATS Application Form Question Drafter Tab */}
              <TabsContent value="form_qna" className="mt-4 space-y-4">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      Application Form Question Drafter
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Paste any custom screening question from Greenhouse, Lever, Ashby, or Workday (e.g. &ldquo;Why do you want to work at {app.company}?&rdquo;). Bruce drafts a fact-grounded answer from your Master Profile.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleDraftFormAnswer} className="space-y-3">
                      <Textarea
                        rows={3}
                        placeholder={`e.g. "Why are you excited about ${app.company}?" or "Tell us about a difficult engineering trade-off you made."`}
                        value={formQuestion}
                        onChange={(e) => setFormQuestion(e.target.value)}
                        className="bg-background text-sm"
                        disabled={draftingAnswer}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Select
                          value={formTone}
                          onValueChange={(v) => setFormTone(v as "concise" | "detailed")}
                        >
                          <SelectTrigger className="w-44 bg-background text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="concise">Concise (1 paragraph)</SelectItem>
                            <SelectItem value="detailed">Detailed (2-3 paragraphs)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="submit"
                          disabled={draftingAnswer || !formQuestion.trim()}
                          className="gap-1.5"
                        >
                          {draftingAnswer ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {draftingAnswer ? "Drafting..." : "Draft Answer"}
                        </Button>
                      </div>
                    </form>

                    {draftedAnswers.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {draftedAnswers.map((item) => (
                          <div
                            key={item.id}
                            className="space-y-2 rounded-xl border border-border bg-background/70 p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold text-foreground">{item.question}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 gap-1 text-xs"
                                onClick={() => void handleCopy(item.id, item.answer)}
                              >
                                {copiedKey === item.id ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                Copy
                              </Button>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-card-foreground/90">
                              {item.answer}
                            </p>
                            {item.keyPointsUsed.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {item.keyPointsUsed.map((pt, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                                    ✓ {pt}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Interactive Mock Interview, UK Salary Coach & Study Q&A Tab */}
              <TabsContent value="qna" className="mt-4 space-y-4">
                {/* 1. Interactive Mock Interview */}
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          Interactive Mock Interview
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Practise answering out loud or in writing — Bruce scores STAR structure &amp; sharpens your reply.
                        </CardDescription>
                      </div>
                      {app.interviewQna.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={mockIdx === 0}
                            onClick={() => {
                              setMockIdx((i) => Math.max(0, i - 1));
                              setMockFeedback(null);
                              setMockAnswer("");
                            }}
                          >
                            Prev
                          </Button>
                          <span className="text-xs font-mono text-muted-foreground">
                            {mockIdx + 1}/{app.interviewQna.length}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={mockIdx >= app.interviewQna.length - 1}
                            onClick={() => {
                              setMockIdx((i) => Math.min(app.interviewQna.length - 1, i + 1));
                              setMockFeedback(null);
                              setMockAnswer("");
                            }}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-xl border border-border bg-background/70 p-3.5 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Bruce asks:
                      </p>
                      <p className="text-sm font-semibold">{activeMockQuestion}</p>
                      {app.interviewQna.length === 0 && (
                        <Input
                          placeholder="Or enter a custom question to practise..."
                          value={mockCustomQ}
                          onChange={(e) => setMockCustomQ(e.target.value)}
                          className="bg-card text-xs mt-2"
                        />
                      )}
                    </div>

                    <form onSubmit={handleEvaluateMock} className="space-y-2.5">
                      <Textarea
                        rows={4}
                        placeholder="Type or dictate your STAR answer..."
                        value={mockAnswer}
                        onChange={(e) => setMockAnswer(e.target.value)}
                        className="bg-background text-sm"
                        disabled={evaluatingMock}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={listeningMock ? "destructive" : "outline"}
                          onClick={toggleMockVoice}
                          className="gap-1.5 text-xs"
                        >
                          {listeningMock ? (
                            <MicOff className="h-3.5 w-3.5" />
                          ) : (
                            <Mic className="h-3.5 w-3.5" />
                          )}
                          {listeningMock ? "Stop Dictation" : "Speak Answer"}
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={evaluatingMock || !mockAnswer.trim()}
                          className="gap-1.5"
                        >
                          {evaluatingMock ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {evaluatingMock ? "Evaluating..." : "Score My Answer"}
                        </Button>
                      </div>
                    </form>

                    {mockFeedback && (
                      <div className="space-y-3 rounded-xl border border-primary/40 bg-background/80 p-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">Bruce&apos;s Feedback</span>
                          <Badge className="font-mono">{mockFeedback.score}/10</Badge>
                        </div>
                        {mockFeedback.strengths.length > 0 && (
                          <div>
                            <p className="font-semibold text-foreground mb-1">What Worked</p>
                            <ul className="list-disc pl-4 space-y-0.5 text-card-foreground/85">
                              {mockFeedback.strengths.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {mockFeedback.improvements.length > 0 && (
                          <div>
                            <p className="font-semibold text-foreground mb-1">To Tighten</p>
                            <ul className="list-disc pl-4 space-y-0.5 text-card-foreground/85">
                              {mockFeedback.improvements.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="rounded-lg border border-border bg-card p-3">
                          <p className="font-semibold mb-1">Sharpened Version</p>
                          <p className="leading-relaxed text-card-foreground/90">
                            {mockFeedback.refinedAnswer}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. UK Salary & Offer Coach */}
                <Card className="border-border bg-card">
                  <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <PoundSterling className="h-5 w-5 text-primary" />
                        UK Salary &amp; Offer Coach
                      </CardTitle>
                      <CardDescription className="text-xs">
                        UK-calibrated comp positioning, pension/equity/hybrid levers, and ready-to-send negotiation scripts.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSalaryCoach()}
                      disabled={coachingSalary}
                      className="gap-1.5 self-start sm:self-auto"
                    >
                      {coachingSalary ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PoundSterling className="h-3.5 w-3.5" />
                      )}
                      {coachingSalary ? "Analysing..." : "Build Salary Brief"}
                    </Button>
                  </CardHeader>
                  {salaryPlan && (
                    <CardContent className="space-y-3 text-xs">
                      <p className="rounded-lg border border-border bg-background/60 p-3 leading-relaxed">
                        {salaryPlan.targetRangeGuidance}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background/60 p-3">
                          <p className="font-semibold mb-1.5">Your Leverage Points</p>
                          <ul className="list-disc pl-4 space-y-1 text-card-foreground/85">
                            {salaryPlan.leveragePoints.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-border bg-background/60 p-3">
                          <p className="font-semibold mb-1.5">UK Total-Comp Levers</p>
                          <ul className="list-disc pl-4 space-y-1 text-card-foreground/85">
                            {salaryPlan.totalCompLevers.map((lv, i) => (
                              <li key={i}>{lv}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Early Screening Script</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] gap-1"
                            onClick={() => void handleCopy("sal-rec", salaryPlan.recruiterScript)}
                          >
                            {copiedKey === "sal-rec" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            Copy
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap text-card-foreground/90 leading-relaxed">
                          {salaryPlan.recruiterScript}
                        </p>
                      </div>
                      <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Counter-Offer Email Script</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] gap-1"
                            onClick={() => void handleCopy("sal-ctr", salaryPlan.counterOfferScript)}
                          >
                            {copiedKey === "sal-ctr" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            Copy
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap text-card-foreground/90 leading-relaxed">
                          {salaryPlan.counterOfferScript}
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* 3. Study Q&A Cards */}
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Generated Interview Prep Q&amp;A</CardTitle>
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
