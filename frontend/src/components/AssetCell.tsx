import type { Asset } from '@/api/bindings';
import { Button } from '@/components/ui/button';
import {
  FileVideoIcon,
  FileImageIcon,
  FileAudioIcon,
  FileIcon,
  TrashIcon,
  PencilSimpleIcon,
  PlusIcon,
} from '@phosphor-icons/react';

interface AssetCellProps {
  asset: Asset;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void;
  onAddToTimeline: (e: React.MouseEvent) => void;
}

export const AssetCell = ({
  asset,
  isSelected,
  onClick,
  onDelete,
  onRename,
  onAddToTimeline,
}: AssetCellProps) => {
  return (
    <div
      onClick={onClick}
      className={`group hover:bg-accent relative flex cursor-pointer items-center gap-2 rounded-md p-2 text-left text-sm transition-colors ${
        isSelected ? 'bg-accent text-accent-foreground' : ''
      }`}
    >
      {asset.media_type === 'video' ? (
        <FileVideoIcon className="size-4 shrink-0 text-blue-500" />
      ) : asset.media_type === 'image' ? (
        <FileImageIcon className="size-4 shrink-0 text-green-500" />
      ) : asset.media_type === 'audio' ||
        asset.file_path.toLowerCase().endsWith('.mp3') ? (
        <FileAudioIcon className="size-4 shrink-0 text-purple-500" />
      ) : (
        <FileIcon className="text-muted-foreground size-4 shrink-0" />
      )}
      <span className="flex-1 truncate">{asset.name}</span>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-blue-500 hover:text-blue-600"
          onClick={onAddToTimeline}
          title="Add to Timeline"
        >
          <PlusIcon weight="bold" className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onRename}
          title="Rename"
        >
          <PencilSimpleIcon
            weight="bold"
            className="text-muted-foreground hover:text-foreground size-3.5"
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onDelete}
          title="Delete"
        >
          <TrashIcon
            weight="bold"
            className="size-3.5 text-red-500 hover:text-red-600"
          />
        </Button>
      </div>
    </div>
  );
};
