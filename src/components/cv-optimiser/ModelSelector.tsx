import { memo } from "react";
import { motion } from "framer-motion";
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
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {provider.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Level 2: Model Tier + Thinking Level */}
      {(onModelIdChange || onThinkingLevelChange) && (
        <div className="flex flex-col items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-background/40 p-2.5 sm:flex-row">
          {onModelIdChange && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              {tierOptions.map((tier) => {
                const active = tier.id === activeTierId;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => onModelIdChange(tier.id)}
                    title={tier.description}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card/60 text-foreground/85 hover:bg-card"
                    )}
                  >
                    <span>{tier.label}</span>
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 text-[10px] font-semibold",
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
            </div>
          )}

          {onThinkingLevelChange && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
                title={
                  thinkingLevel === "auto"
                    ? `Auto scales with workload (${apiWorkload} → ${resolvedThinking})`
                    : `Reasoning / thinking effort: ${thinkingLevel}`
                }
              >
                <Gauge className="h-3.5 w-3.5 text-primary" />
                Thinking:
              </span>
              <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5">
                {THINKING_OPTIONS.map((opt) => {
                  const active = thinkingLevel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onThinkingLevelChange(opt.id)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                      {opt.id === "auto" && active ? ` (${resolvedThinking})` : ""}
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
