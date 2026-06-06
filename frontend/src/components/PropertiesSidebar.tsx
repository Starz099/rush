import { useWorkspaceStore } from '@/store/workspaceStore'

export const PropertiesSidebar = () => {
  const selectedAsset = useWorkspaceStore((state) => state.selectedAsset)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Properties
        </h2>
      </div>
      <div className="flex-1 p-4">
        {selectedAsset ? (
          <div className="space-y-4">
            <div>
              <label className="text-muted-foreground block text-[10px] font-medium uppercase">
                Name
              </label>
              <p className="truncate text-sm">{selectedAsset.name}</p>
            </div>
            <div>
              <label className="text-muted-foreground block text-[10px] font-medium uppercase">
                Type
              </label>
              <p className="text-sm capitalize">{selectedAsset.media_type}</p>
            </div>
            <div>
              <label className="text-muted-foreground block text-[10px] font-medium uppercase">
                Path
              </label>
              <p className="text-muted-foreground text-[10px] break-all">
                {selectedAsset.file_path}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">
            Select an item to view properties
          </p>
        )}
      </div>
    </div>
  )
}
