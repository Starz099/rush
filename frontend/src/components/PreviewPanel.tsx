import { useWorkspaceStore } from '@/store/workspaceStore'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FileIcon } from '@phosphor-icons/react'

export const PreviewPanel = () => {
  const selectedAsset = useWorkspaceStore((state) => state.selectedAsset)

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex aspect-video w-full max-w-[80%] items-center justify-center overflow-hidden bg-black text-white/20 shadow-2xl">
        {selectedAsset ? (
          selectedAsset.media_type === 'video' ? (
            <video
              src={convertFileSrc(selectedAsset.file_path)}
              controls
              className="h-full w-full object-contain"
            />
          ) : selectedAsset.media_type === 'image' ? (
            <img
              src={convertFileSrc(selectedAsset.file_path)}
              alt={selectedAsset.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-center">
              <FileIcon className="mx-auto mb-2 size-12 opacity-20" />
              <p className="text-xs">Preview not available</p>
            </div>
          )
        ) : (
          'Preview Canvas'
        )}
      </div>
    </div>
  )
}
