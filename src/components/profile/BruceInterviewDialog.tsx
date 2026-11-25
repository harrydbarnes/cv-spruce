import { useState, useRef } from "react";
import { Sparkles, Mic, MicOff, ArrowRight, Loader2, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { conductBruceOnboardingWithAi, type CareerProfile } from "@/lib/profile-types";
import type { ModelType, ThinkingLevel } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface BruceInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ModelType;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  apiKey: string;
  onComplete: (patch: Partial<CareerProfile>) => Promise<void> | void;
}

const INTERVIEW_QUESTIONS = [
  "What's your ideal next move — what kinds of roles, team sizes, or problems energise you most?",
  "Tell me about 1 or 2 achievements or projects you're proudest of that your CV might undersell.",
  "Where do you want to work (e.g. London, Manchester, UK Remote), what work mode (remote/hybrid), and what's your minimum salary?",
  "Any hard dealbreakers or companies/industries you definitely want to avoid?",
];

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function BruceInterviewDialog({
  open,
  onOpenChange,
  provider,
  modelId,
  thinkingLevel,
  apiKey,
  onComplete,
}: BruceInterviewDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as
          | (new () => SpeechRecognitionInstance)
          | undefined
      : undefined;

  const toggleVoice = () => {
    if (!SpeechRecognitionCtor) {
      toast({
        title: "Voice Input Unavailable",
        description: "Your browser does not support Web Speech dictation. Type your answer instead.",
      });
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-GB";
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setAnswers((prev) =>
          prev.map((val, idx) => (idx === step ? `${val ? `${val} ` : ""}${transcript}` : val))
        );
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const handleFinish = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "AI Key Needed",
        description: "Tap the 🔑 button in the top bar to add a free Gemini (or Claude/ChatGPT) key first.",
        variant: "destructive",
      });
      return;
    }

    const qaPairs = INTERVIEW_QUESTIONS.map((q, i) => ({
      question: q,
      answer: answers[i]?.trim() || "No preference stated.",
    }));

    setSubmitting(true);
    try {
      const synthesised = await conductBruceOnboardingWithAi({
        provider,
        modelId,
        thinkingLevel,
        apiKey,
        answers: qaPairs,
      });

      await onComplete({
        careerStory: synthesised.careerStory,
        preferences: {
          targetRoles: synthesised.targetRoles ?? [],
          preferredLocations: synthesised.preferredLocations ?? [],
          workMode: synthesised.workMode ?? "any",
          minSalary: synthesised.minSalary ?? "",
          dealbreakers: synthesised.dealbreakers ?? [],
          searchStatus: synthesised.searchStatus ?? "actively_looking",
        },
      });

      toast({
        title: "Career Brief Updated!",
        description: "Bruce saved your story, target roles, and preferences to your Master Profile.",
      });
      setStep(0);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Interview failed",
        description: err instanceof Error ? err.message : "Could not process answers.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = Math.round(((step + 1) / INTERVIEW_QUESTIONS.length) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MessageCircle className="h-5 w-5 text-primary" />
            2-Minute Chat with Bruce
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Answer 4 quick questions (type or dictate) and Bruce will populate your Career Brief &amp; job search preferences automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>
                Question {step + 1} of {INTERVIEW_QUESTIONS.length}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="rounded-xl border border-border bg-background/70 p-4">
            <p className="text-sm font-semibold leading-relaxed text-foreground">
              {INTERVIEW_QUESTIONS[step]}
            </p>
          </div>

          <div className="space-y-2">
            <Textarea
              rows={4}
              placeholder="Speak or type naturally — bullet points or rough thoughts are completely fine..."
              value={answers[step]}
              onChange={(e) =>
                setAnswers((prev) =>
                  prev.map((val, idx) => (idx === step ? e.target.value : val))
                )
              }
              className="bg-background text-sm"
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                variant={listening ? "destructive" : "outline"}
                onClick={toggleVoice}
                className="gap-1.5 text-xs"
              >
                {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {listening ? "Stop Dictation" : "Voice Input"}
              </Button>

              <div className="flex items-center gap-2">
                {step > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setStep((s) => s - 1)}
                    disabled={submitting}
                  >
                    Back
                  </Button>
                )}

                {step < INTERVIEW_QUESTIONS.length - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setStep((s) => s + 1)}
                    className="gap-1.5"
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleFinish()}
                    disabled={submitting}
                    className="gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {submitting ? "Synthesising..." : "Build My Career Brief"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
