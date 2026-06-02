import {
  CommandLineIcon,
  CpuChipIcon,
  DocumentMagnifyingGlassIcon,
  DocumentPlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ServerIcon,
  WrenchIcon,
} from '@heroicons/react/24/outline';
import { isMcpTool } from '@/utils/tool-utils';

type IconComponent = React.ComponentType<{ className?: string }>;

const TOOL_ICONS: Record<string, IconComponent> = {
  Bash: CommandLineIcon,
  Read: DocumentMagnifyingGlassIcon,
  Write: DocumentPlusIcon,
  Edit: PencilSquareIcon,
  MultiEdit: PencilSquareIcon,
  WebSearch: MagnifyingGlassIcon,
  Agent: CpuChipIcon,
  Task: CpuChipIcon,
};

export function getToolIcon(toolName: string): React.ReactNode {
  const Icon = TOOL_ICONS[toolName] ?? (isMcpTool(toolName) ? ServerIcon : WrenchIcon);
  return <Icon className="w-4 h-4 shrink-0" />;
}

export function ToolUseHeader({
  icon,
  name,
  detail,
  range,
  badge,
}: {
  icon: React.ReactNode;
  name: string;
  detail?: string;
  range?: string;
  badge?: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <span className="inline-flex items-center">{icon}</span>
      <span className="font-semibold text-bright">{name}</span>
      {detail && <span className="opacity-70 truncate max-w-72">{detail}</span>}
      {range && <span className="opacity-50 text-xs">{range}</span>}
      {badge}
    </>
  );
}
