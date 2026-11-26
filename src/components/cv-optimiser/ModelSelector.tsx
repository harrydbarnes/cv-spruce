import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bot, BrainCircuit, LucideIcon, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiWorkload, ModelType, ThinkingLevel } from "@/lib/types";
import {
  MODEL_LABELS,
  PROVIDER_MODELS,
  resolveThinkingLevel,
} from "@/lib/constants";

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  selectedModelId?: string;
  onModelIdChange?: (modelId: string) => void;
  thinkingLevel?: ThinkingLevel;
  onThinkingLevelChange?: (level: ThinkingLevel) => void;
  apiWorkload?: ApiWorkload;
}

const providers: { id: ModelType; label: string; icon: LucideIcon }[] = [
  { id: "gemini", label: MODEL_LABELS.gemini, icon: Sparkles },
  { id: "claude", label: MODEL_LABELS.claude, icon: BrainCircuit },
  { id: "openai", label: MODEL_LABELS.openai, icon: Bot },
];

const THINKING_OPTIONS: Array<{ id: ThinkingLevel; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 32,
  mass: 0.8,
};

const ModelSelector = ({
  selectedModel,
  onModelChange,
  selectedModelId,
  onModelIdChange,
  thinkingLevel = "auto",
  onThinkingLevelChange,
  apiWorkload = "Normal",
}: ModelSelectorProps) => {
  const tierOptions = PROVIDER_MODELS[selectedModel];
  const activeTierId =
    selectedModelId && tierOptions.some((t) => t.id === selectedModelId)
      ? selectedModelId
      : tierOptions[0].id;
  const resolvedThinking = resolveThinkingLevel(thinkingLevel, apiWorkload);

  return (
    <div className="mb-6 space-y-3">
      {/* Level 1: Provider Pill Bar */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-1 shadow-sm">
          {providers.map((provider) => {
            const isSelected = selectedModel === provider.id;
            const Icon = provider.icon;
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => onModelChange(provider.id)}
                aria-label={`Select ${provider.label} model`}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeModel"
                    className="absolute inset-0 rounded-full bg-primary shadow-sm"
                    transition={springTransition}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 whitespace-nowrap">
                  <Icon className="h-4 w-4" />
                  {provider.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Level 2: Clean Centered Two-Row Model Tier + Thinking Control */}
      {(onModelIdChange || onThinkingLevelChange) && (
        <div className="space-y-3 rounded-2xl border border-border/80 bg-background/40 p-3 sm:p-4">
          {onModelIdChange && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selectedModel}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "grid gap-2",
                  tierOptions.length === 3
                    ? "grid-cols-1 sm:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2"
                )}
              >
                {tierOptions.map((tier) => {
                  const active = tier.id === activeTierId;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => onModelIdChange(tier.id)}
                      title={tier.description}
                      className={cn(
                        "relative flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors",
                        active
                          ? "border-primary text-primary-foreground"
                          : "border-border bg-card/60 text-foreground/85 hover:bg-card"
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="activeModelTier"
                          className="absolute inset-0 rounded-[11px] bg-primary shadow-sm"
                          transition={springTransition}
                        />
                      )}
                      <span className="relative z-10 truncate font-semibold">
                        {tier.label}
                      </span>
                      <span
                        className={cn(
                          "relative z-10 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tier.badge}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {onThinkingLevelChange && (
            <div className="flex flex-col gap-1.5 border-t border-border/50 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                title={
                  thinkingLevel === "auto"
                    ? `Auto scales with workload (${apiWorkload} → ${resolvedThinking})`
                    : `Reasoning / thinking effort: ${thinkingLevel}`
                }
              >
                <Gauge className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Thinking Effort</span>
                {thinkingLevel === "auto" && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
                    {resolvedThinking}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 rounded-xl border border-border bg-card/60 p-1 sm:w-auto sm:min-w-[290px]">
                {THINKING_OPTIONS.map((opt) => {
                  const active = thinkingLevel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onThinkingLevelChange(opt.id)}
                      className={cn(
                        "relative rounded-lg px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors",
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="activeThinkingLevel"
                          className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                          transition={springTransition}
                        />
                      )}
                      <span className="relative z-10">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(ModelSelector);
