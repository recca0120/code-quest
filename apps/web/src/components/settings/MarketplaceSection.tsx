import type { MarketplaceInfo } from '@code-quest/schemas';
import { TextField } from '@/components/chat/ui/TextField';
import { Button } from '../ui/Button.tsx';
import { BorderedIconButton, RefreshIcon, TrashIcon } from '../ui/Icons.tsx';
import { SurfaceCard } from '../ui/SurfaceCard.tsx';

interface MarketplaceSectionProps {
  marketplaces: MarketplaceInfo[];
  newSource: string;
  onNewSourceChange: (source: string) => void;
  onAdd: () => void;
  onRemove: (marketplaceId: string) => void;
  onRefresh: () => void;
  adding: boolean;
}

export function MarketplaceSection({
  marketplaces,
  newSource,
  onNewSourceChange,
  onAdd,
  onRemove,
  onRefresh,
  adding,
}: MarketplaceSectionProps): React.JSX.Element {
  return (
    <>
      <div className="flex gap-2 mb-3">
        <TextField
          type="text"
          value={newSource}
          onChange={onNewSourceChange}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder="Marketplace source URL…"
          className="flex-1 placeholder:text-muted"
        />
        <Button
          variant="info"
          size="md"
          disabled={!newSource.trim() || adding}
          className="rounded-md py-2"
          onClick={onAdd}
        >
          Add
        </Button>
      </div>

      {marketplaces.length === 0 ? (
        <p className="text-center text-subtle py-8 text-sm">No marketplaces configured.</p>
      ) : (
        <ul className="list-none m-0 p-0">
          {marketplaces.map((mp) => {
            const src = mp.config?.source;
            const detail = !src
              ? undefined
              : src.source === 'npm'
                ? src.package
                : src.source === 'github'
                  ? src.repo
                  : src.source === 'git' || src.source === 'url'
                    ? src.url
                    : 'path' in src
                      ? src.path
                      : undefined;
            return (
              <SurfaceCard
                as="li"
                key={mp.name}
                className="flex items-start justify-between rounded-md mb-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text font-medium text-sm">{mp.name}</span>
                    <span className="text-xs text-muted">{src?.source ?? '—'}</span>
                  </div>
                  {detail && <p className="text-muted text-xs m-0 truncate">{detail}</p>}
                  <p className="text-muted text-xs mt-1 m-0">
                    {mp.installedCount} / {mp.pluginCount} installed
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  <BorderedIconButton onClick={onRefresh} label="Refresh marketplace">
                    <RefreshIcon className="w-3.5 h-3.5" />
                  </BorderedIconButton>
                  <BorderedIconButton
                    onClick={() => onRemove(mp.name)}
                    label="Remove marketplace"
                    danger
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </BorderedIconButton>
                </div>
              </SurfaceCard>
            );
          })}
        </ul>
      )}
    </>
  );
}
