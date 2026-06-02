import { useState } from 'react';
import { TextField } from '@/components/chat/ui/TextField';
import type { InitOptions } from '@/types/chat';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';

interface InitOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (opts: InitOptions) => void;
  initial?: InitOptions;
}

const LABEL_CLASS = 'flex flex-col gap-1 text-xs text-muted';

const HOOK_DEFS = [
  { key: 'captureBaseline', label: 'captureBaseline (PreToolUse)', section: 'PreToolUse' },
  { key: 'saveFileIfNeeded', label: 'saveFileIfNeeded (PreToolUse)', section: 'PreToolUse' },
  {
    key: 'findDiagnosticsProblems',
    label: 'findDiagnosticsProblems (PostToolUse)',
    section: 'PostToolUse',
  },
] as const;

function buildEnabledHooks(
  hooks: Record<string, boolean>,
): Record<string, Array<{ matcher: string; hookCallbackIds: string[] }>> {
  const enabled: Record<string, Array<{ matcher: string; hookCallbackIds: string[] }>> = {};
  for (const def of HOOK_DEFS) {
    if (!hooks[def.key]) continue;
    let section = enabled[def.section];
    if (!section) {
      section = [];
      enabled[def.section] = section;
    }
    section.push({ matcher: def.key, hookCallbackIds: [def.key] });
  }
  return enabled;
}

function buildInitOptions(state: {
  systemPrompt: string;
  appendSystemPrompt: string;
  jsonSchema: string;
  agents: string;
  hooks: Record<string, boolean>;
}): InitOptions {
  const opts: InitOptions = {};
  if (state.systemPrompt) opts.systemPrompt = state.systemPrompt;
  if (state.appendSystemPrompt) opts.appendSystemPrompt = state.appendSystemPrompt;
  if (state.jsonSchema) opts.jsonSchema = state.jsonSchema;
  if (state.agents) opts.agents = state.agents;
  const enabledHooks = buildEnabledHooks(state.hooks);
  if (Object.keys(enabledHooks).length > 0) opts.hooks = enabledHooks;
  return opts;
}

export function InitOptionsDialog({
  open,
  onClose,
  onSave,
  initial,
}: InitOptionsDialogProps): React.JSX.Element {
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
  const [appendSystemPrompt, setAppendSystemPrompt] = useState(initial?.appendSystemPrompt ?? '');
  const [jsonSchema, setJsonSchema] = useState(String(initial?.jsonSchema ?? ''));
  const [agents, setAgents] = useState(String(initial?.agents ?? ''));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hooks, setHooks] = useState<Record<string, boolean>>({
    captureBaseline: false,
    saveFileIfNeeded: false,
    findDiagnosticsProblems: false,
  });

  const handleSave = () => {
    onSave(buildInitOptions({ systemPrompt, appendSystemPrompt, jsonSchema, agents, hooks }));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent title="Init Options" className="max-w-md w-full">
        <div className="flex flex-col gap-3">
          <label className={LABEL_CLASS} htmlFor="init-system-prompt">
            System Prompt
            <TextField
              id="init-system-prompt"
              as="textarea"
              mono
              value={systemPrompt}
              onChange={setSystemPrompt}
              className="resize-y min-h-15"
            />
          </label>
          <label className={LABEL_CLASS} htmlFor="init-append-system-prompt">
            Append System Prompt
            <TextField
              id="init-append-system-prompt"
              as="textarea"
              mono
              value={appendSystemPrompt}
              onChange={setAppendSystemPrompt}
              className="resize-y min-h-15"
            />
          </label>
          <details
            open={showAdvanced}
            onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-xs text-muted hover:text-text select-none py-1">
              Advanced
            </summary>
            <div className="flex flex-col gap-3 mt-2">
              <label className={LABEL_CLASS} htmlFor="init-json-schema">
                JSON Schema
                <TextField
                  id="init-json-schema"
                  as="textarea"
                  mono
                  size="sm"
                  value={jsonSchema}
                  onChange={setJsonSchema}
                  placeholder="JSON schema object"
                  className="resize-y min-h-10"
                />
              </label>
              <label className={LABEL_CLASS} htmlFor="init-agents">
                Agents
                <TextField
                  id="init-agents"
                  as="textarea"
                  mono
                  size="sm"
                  value={agents}
                  onChange={setAgents}
                  placeholder="JSON array of agent configs"
                  className="resize-y min-h-10"
                />
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-xs text-muted mb-1">Hooks</legend>
                {HOOK_DEFS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={hooks[key]}
                      onChange={(e) => setHooks((h) => ({ ...h, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>
          </details>
        </div>
        <p className="text-xs text-subtle mt-3">Takes effect on next session creation.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xs" onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
