import { KeyRound, CheckCircle2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ApiKeyInput from "@/components/cv-optimiser/ApiKeyInput";
import { usePersistentApiKey } from "@/hooks/use-persistent-api-key";
import { MODEL_PROVIDER_NAMES } from "@/lib/constants";

interface ApiKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeysDialog({ open, onOpenChange }: ApiKeysDialogProps) {
  const gemini = usePersistentApiKey("gemini");
  const claude = usePersistentApiKey("claude");
  const openai = usePersistentApiKey("openai");

  const providers = [
    { id: "gemini" as const, hook: gemini, badge: "Free Tier", link: "https://aistudio.google.com/apikey" },
    { id: "claude" as const, hook: claude, badge: "Paid API", link: "https://console.anthropic.com/settings/keys" },
    { id: "openai" as const, hook: openai, badge: "Paid API", link: "https://platform.openai.com/api-keys" },
  ];

  const configuredCount = providers.filter((p) => p.hook.apiKey.trim().length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <KeyRound className="h-5 w-5 text-primary" />
            AI Provider Keys
            <Badge variant="secondary" className="ml-1 text-xs">
              {configuredCount}/3 set
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Manage your Gemini, Claude, and OpenAI keys from any tab. Keys stay strictly in your browser and go directly to each provider.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="gemini" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            {providers.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="gap-1.5 text-xs">
                <span>{p.id === "openai" ? "ChatGPT" : p.id.charAt(0).toUpperCase() + p.id.slice(1)}</span>
                {p.hook.apiKey.trim() && <CheckCircle2 className="h-3 w-3 text-primary" />}
              </TabsTrigger>
            ))}
          </TabsList>

          {providers.map(({ id, hook, badge, link }) => (
            <TabsContent key={id} value={id} className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  {MODEL_PROVIDER_NAMES[id]}{" "}
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    {badge}
                  </Badge>
                </span>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Get key
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <ApiKeyInput
                value={hook.apiKey}
                onChange={hook.setApiKey}
                saveKey={hook.saveKey}
                onSaveKeyChange={hook.setSaveKey}
                provider={id}
              />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
