import { useState } from "react";
import {
  UserCircle2,
  Sparkles,
  Plus,
  Trash2,
  Upload,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Save,
  Briefcase,
  GraduationCap,
  Code2,
  Brain,
  Download,
  HardDrive,
} from "lucide-react";
import { downloadWorkspaceBackup, restoreWorkspaceBackup } from "@/lib/workspace-backup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { usePersistentApiKey } from "@/hooks/use-persistent-api-key";
import { extractTextFromFile } from "@/lib/extract-text";
import {
  parseCvToProfileWithAi,
  type CareerProfile,
  type WorkModePreference,
} from "@/lib/profile-types";
import type { ModelType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";

const csvToList = (val: string) =>
  val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export default function ProfilePage() {
  const { profile, saving, strength, updateProfile, removeFeedbackSignal } = useCareerProfile();
  const { toast } = useToast();

  const [draft, setDraft] = useState<CareerProfile>(profile);
  const [syncedProfileRef, setSyncedProfileRef] = useState(profile);
  if (profile !== syncedProfileRef) {
    setSyncedProfileRef(profile);
    setDraft(profile);
  }

  const [importModel, setImportModel] = useState<ModelType>("gemini");
  const gemini = usePersistentApiKey("gemini");
  const openai = usePersistentApiKey("openai");
  const claude = usePersistentApiKey("claude");
  const activeKey = { gemini, openai, claude }[importModel].apiKey;

  const [importing, setImporting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [targetRoleInput, setTargetRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [dealbreakerInput, setDealbreakerInput] = useState("");

  const handleSave = async () => {
    await updateProfile(draft);
    toast({
      title: "Master Profile Saved",
      description: "Bruce will use these verified facts for all future CV tailoring & job matching.",
    });
  };

  const handleImportCvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    try {
      const rawText = await extractTextFromFile(file);
      if (!activeKey.trim()) {
        // Still store raw CV text even without an API key
        const updated = { ...draft, rawCvText: rawText };
        setDraft(updated);
        await updateProfile(updated);
        toast({
          title: "CV Text Stored",
          description: "Add an API key on Quick Tailor to auto-extract structured sections with AI.",
        });
        return;
      }

      const extracted = await parseCvToProfileWithAi(importModel, activeKey, rawText);
      const merged: CareerProfile = {
        ...draft,
        basics: { ...draft.basics, ...(extracted.basics ?? {}) },
        summary: extracted.summary || draft.summary,
        experience: extracted.experience?.length ? extracted.experience : draft.experience,
        skills: extracted.skills?.length ? extracted.skills : draft.skills,
        projects: extracted.projects?.length ? extracted.projects : draft.projects,
        education: extracted.education?.length ? extracted.education : draft.education,
        certifications: extracted.certifications?.length
          ? extracted.certifications
          : draft.certifications,
        rawCvText: rawText,
      };
      setDraft(merged);
      await updateProfile(merged);
      toast({
        title: "Profile Imported!",
        description: `Bruce extracted ${merged.experience.length} roles and ${merged.skills.length} skills from ${file.name}.`,
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not parse CV file.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const addExperience = () => {
    setDraft((prev) => ({
      ...prev,
      experience: [
        {
          id: `exp-${Date.now()}`,
          role: "",
          company: "",
          location: "",
          startDate: "",
          endDate: "",
          current: false,
          highlights: [""],
        },
        ...prev.experience,
      ],
    }));
  };

  const addEducation = () => {
    setDraft((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id: `edu-${Date.now()}`,
          institution: "",
          degree: "",
          field: "",
          graduationYear: "",
        },
      ],
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8 pb-20">
        {/* Header + Save */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
              <UserCircle2 className="h-8 w-8 text-primary" />
              Master Career Profile
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One verified source of truth. Every bespoke CV Bruce writes comes strictly from facts here — never invented.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 self-start sm:self-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </Button>
        </div>

        {/* Profile Strength Meter + 1-Click CV Import */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Profile Strength</CardTitle>
                <span className="text-xl font-bold text-primary">{strength.score}%</span>
              </div>
              <Progress value={strength.score} className="h-2.5" />
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {strength.missing.length === 0 ? (
                <p className="font-medium text-foreground">
                  Your Master Profile is complete — Bruce is ready for 1-click bespoke applications!
                </p>
              ) : (
                <p>Add to boost match accuracy: {strength.missing.join(" • ")}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4 text-primary" />
                Import from Existing CV
              </CardTitle>
              <CardDescription className="text-xs">
                Upload PDF, DOCX, or TXT and let Bruce populate your structured history.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Select value={importModel} onValueChange={(v) => setImportModel(v as ModelType)}>
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex-1">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleImportCvFile}
                  className="hidden"
                  disabled={importing}
                />
                <Button type="button" variant="outline" className="w-full gap-2" asChild>
                  <span>
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Parsing CV...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Upload &amp; Parse CV
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Bruce Career Story & Preferences (Jack & Jill-inspired) */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              Bruce&apos;s Career Brief &amp; Preferences
            </CardTitle>
            <CardDescription>
              Tell Bruce what your CV leaves out — what you want next, your ideal environment, and hard dealbreakers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="career-story">Your Career Story &amp; Next Move</Label>
              <Textarea
                id="career-story"
                rows={3}
                placeholder="e.g. I'm a Senior Full-Stack Engineer looking to step into Staff/Lead roles at high-trust product companies working on developer tools or AI workflows..."
                value={draft.careerStory}
                onChange={(e) => setDraft({ ...draft, careerStory: e.target.value })}
                className="bg-background"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Search Mode</Label>
                <Select
                  value={draft.preferences.searchStatus}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      preferences: {
                        ...draft.preferences,
                        searchStatus: v as CareerProfile["preferences"]["searchStatus"],
                      },
                    })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actively_looking">Actively Looking</SelectItem>
                    <SelectItem value="preparing">Preparing to Move</SelectItem>
                    <SelectItem value="open_passively">Happily Employed (Passive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Work Mode</Label>
                <Select
                  value={draft.preferences.workMode}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      preferences: {
                        ...draft.preferences,
                        workMode: v as WorkModePreference,
                      },
                    })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="remote">Remote Only</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="min-salary">Target Salary Floor</Label>
                <Input
                  id="min-salary"
                  placeholder="e.g. £95,000 or $160k"
                  value={draft.preferences.minSalary}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      preferences: { ...draft.preferences, minSalary: e.target.value },
                    })
                  }
                  className="bg-background"
                />
              </div>
            </div>

            {/* Target Roles */}
            <div className="space-y-2">
              <Label>Target Roles</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add roles (comma-separated, e.g. Staff Engineer, Frontend Lead)"
                  value={targetRoleInput}
                  onChange={(e) => setTargetRoleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && targetRoleInput.trim()) {
                      e.preventDefault();
                      setDraft({
                        ...draft,
                        preferences: {
                          ...draft.preferences,
                          targetRoles: Array.from(
                            new Set([...draft.preferences.targetRoles, ...csvToList(targetRoleInput)])
                          ),
                        },
                      });
                      setTargetRoleInput("");
                    }
                  }}
                  className="bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!targetRoleInput.trim()) return;
                    setDraft({
                      ...draft,
                      preferences: {
                        ...draft.preferences,
                        targetRoles: Array.from(
                          new Set([...draft.preferences.targetRoles, ...csvToList(targetRoleInput)])
                        ),
                      },
                    });
                    setTargetRoleInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {draft.preferences.targetRoles.map((role) => (
                  <Badge key={role} variant="secondary" className="gap-1">
                    {role}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          preferences: {
                            ...draft.preferences,
                            targetRoles: draft.preferences.targetRoles.filter((r) => r !== role),
                          },
                        })
                      }
                      aria-label={`Remove ${role}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Preferred Locations & Dealbreakers */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Preferred Locations</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="London, UK Remote, Europe..."
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    className="bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!locationInput.trim()) return;
                      setDraft({
                        ...draft,
                        preferences: {
                          ...draft.preferences,
                          preferredLocations: Array.from(
                            new Set([
                              ...draft.preferences.preferredLocations,
                              ...csvToList(locationInput),
                            ])
                          ),
                        },
                      });
                      setLocationInput("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draft.preferences.preferredLocations.map((loc) => (
                    <Badge key={loc} variant="outline" className="gap-1">
                      {loc}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            preferences: {
                              ...draft.preferences,
                              preferredLocations: draft.preferences.preferredLocations.filter(
                                (l) => l !== loc
                              ),
                            },
                          })
                        }
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dealbreakers</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 5 days in-office, crypto, on-call"
                    value={dealbreakerInput}
                    onChange={(e) => setDealbreakerInput(e.target.value)}
                    className="bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!dealbreakerInput.trim()) return;
                      setDraft({
                        ...draft,
                        preferences: {
                          ...draft.preferences,
                          dealbreakers: Array.from(
                            new Set([
                              ...draft.preferences.dealbreakers,
                              ...csvToList(dealbreakerInput),
                            ])
                          ),
                        },
                      });
                      setDealbreakerInput("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draft.preferences.dealbreakers.map((db) => (
                    <Badge key={db} variant="destructive" className="gap-1">
                      {db}
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            preferences: {
                              ...draft.preferences,
                              dealbreakers: draft.preferences.dealbreakers.filter((d) => d !== db),
                            },
                          })
                        }
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Learned Feedback Memory */}
            {draft.feedbackMemory.length > 0 && (
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Learned Signals from Discover ({draft.feedbackMemory.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {draft.feedbackMemory.slice(0, 12).map((fb) => (
                    <Badge
                      key={fb.id}
                      variant={fb.signal === "liked" ? "default" : "outline"}
                      className="gap-1.5"
                    >
                      {fb.signal === "liked" ? (
                        <ThumbsUp className="h-3 w-3" />
                      ) : (
                        <ThumbsDown className="h-3 w-3" />
                      )}
                      {fb.jobTitle} @ {fb.company}
                      {fb.reason ? ` (${fb.reason})` : ""}
                      <button
                        type="button"
                        onClick={() => void removeFeedbackSignal(fb.id)}
                        className="ml-1 opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Basics & Summary */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Basics &amp; Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  value={draft.basics.fullName}
                  onChange={(e) =>
                    setDraft({ ...draft, basics: { ...draft.basics, fullName: e.target.value } })
                  }
                  placeholder="Alex Mercer"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input
                  value={draft.basics.headline}
                  onChange={(e) =>
                    setDraft({ ...draft, basics: { ...draft.basics, headline: e.target.value } })
                  }
                  placeholder="Senior Software Engineer"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={draft.basics.email}
                  onChange={(e) =>
                    setDraft({ ...draft, basics: { ...draft.basics, email: e.target.value } })
                  }
                  placeholder="alex@example.com"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input
                  value={draft.basics.location}
                  onChange={(e) =>
                    setDraft({ ...draft, basics: { ...draft.basics, location: e.target.value } })
                  }
                  placeholder="London, UK"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>LinkedIn URL</Label>
                <Input
                  value={draft.basics.linkedinUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, basics: { ...draft.basics, linkedinUrl: e.target.value } })
                  }
                  placeholder="https://linkedin.com/in/..."
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label>GitHub / Portfolio URL</Label>
                <Input
                  value={draft.basics.githubUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, basics: { ...draft.basics, githubUrl: e.target.value } })
                  }
                  placeholder="https://github.com/..."
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Professional Summary</Label>
              <Textarea
                rows={3}
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                placeholder="Concise overview of your career impact and core domains..."
                className="bg-background"
              />
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5 text-primary" />
              Verified Skills
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add skills (comma-separated, e.g. TypeScript, React, PostgreSQL, AWS)"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && skillInput.trim()) {
                    e.preventDefault();
                    setDraft({
                      ...draft,
                      skills: Array.from(new Set([...draft.skills, ...csvToList(skillInput)])),
                    });
                    setSkillInput("");
                  }
                }}
                className="bg-background"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!skillInput.trim()) return;
                  setDraft({
                    ...draft,
                    skills: Array.from(new Set([...draft.skills, ...csvToList(skillInput)])),
                  });
                  setSkillInput("");
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {draft.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1">
                  {skill}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, skills: draft.skills.filter((s) => s !== skill) })
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Experience */}
        <Card className="border-border bg-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-primary" />
              Work Experience
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addExperience} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.experience.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No experience entries yet. Import your CV above or click &ldquo;Add Role&rdquo;.
              </p>
            ) : (
              draft.experience.map((exp, idx) => (
                <div key={exp.id} className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Role #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          experience: draft.experience.filter((e) => e.id !== exp.id),
                        })
                      }
                      className="h-7 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Role / Title"
                      value={exp.role}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === exp.id ? { ...item, role: e.target.value } : item
                          ),
                        })
                      }
                    />
                    <Input
                      placeholder="Company"
                      value={exp.company}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === exp.id ? { ...item, company: e.target.value } : item
                          ),
                        })
                      }
                    />
                    <Input
                      placeholder="Start Date (e.g. Jan 2022)"
                      value={exp.startDate}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === exp.id ? { ...item, startDate: e.target.value } : item
                          ),
                        })
                      }
                    />
                    <Input
                      placeholder="End Date (or Present)"
                      value={exp.current ? "Present" : exp.endDate}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          experience: draft.experience.map((item) =>
                            item.id === exp.id
                              ? {
                                  ...item,
                                  endDate: e.target.value,
                                  current: e.target.value.toLowerCase() === "present",
                                }
                              : item
                          ),
                        })
                      }
                    />
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Key achievements & metrics (one bullet per line)..."
                    value={exp.highlights.join("\n")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        experience: draft.experience.map((item) =>
                          item.id === exp.id
                            ? { ...item, highlights: e.target.value.split("\n") }
                            : item
                        ),
                      })
                    }
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Education */}
        <Card className="border-border bg-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Education
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addEducation} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Education
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.education.map((edu) => (
              <div key={edu.id} className="grid gap-3 rounded-xl border border-border bg-background/60 p-3 sm:grid-cols-4">
                <Input
                  placeholder="Institution"
                  value={edu.institution}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      education: draft.education.map((item) =>
                        item.id === edu.id ? { ...item, institution: e.target.value } : item
                      ),
                    })
                  }
                />
                <Input
                  placeholder="Degree"
                  value={edu.degree}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      education: draft.education.map((item) =>
                        item.id === edu.id ? { ...item, degree: e.target.value } : item
                      ),
                    })
                  }
                />
                <Input
                  placeholder="Field of Study"
                  value={edu.field}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      education: draft.education.map((item) =>
                        item.id === edu.id ? { ...item, field: e.target.value } : item
                      ),
                    })
                  }
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Year"
                    value={edu.graduationYear}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        education: draft.education.map((item) =>
                          item.id === edu.id ? { ...item, graduationYear: e.target.value } : item
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        education: draft.education.filter((i) => i.id !== edu.id),
                      })
                    }
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Workspace JSON Backup & Restore (Guest Mode Safety Net) */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardDrive className="h-5 w-5 text-primary" />
              Workspace Backup &amp; Portability
            </CardTitle>
            <CardDescription className="text-xs">
              Export your entire local workspace (Master Profile, job watchers, discovered roles, and Kanban board) as a JSON file, or restore a previous backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                const file = downloadWorkspaceBackup();
                toast({
                  title: "Backup Exported",
                  description: `Saved ${file} to your downloads folder.`,
                });
              }}
            >
              <Download className="h-4 w-4" />
              Export Workspace JSON
            </Button>

            <label>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const { restoredSections } = restoreWorkspaceBackup(text);
                    toast({
                      title: "Workspace Restored",
                      description: `Imported: ${restoredSections.join(", ")}. Reloading...`,
                    });
                    setTimeout(() => window.location.reload(), 600);
                  } catch (err) {
                    toast({
                      title: "Import Failed",
                      description: err instanceof Error ? err.message : "Invalid backup file.",
                      variant: "destructive",
                    });
                  }
                }}
              />
              <Button type="button" variant="outline" className="gap-2" asChild>
                <span>
                  <Upload className="h-4 w-4" />
                  Import Workspace JSON
                </span>
              </Button>
            </label>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
