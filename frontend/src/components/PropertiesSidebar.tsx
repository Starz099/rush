import { useWorkspaceStore } from '@/store/workspaceStore'
import { useProjectStore } from '@/store/projectStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

export const PropertiesSidebar = () => {
  const { selectedAsset, selectedClipId, selectedTrackId } = useWorkspaceStore()
  const { activeProject, updateClipProperties } = useProjectStore()

  // Find the selected clip object if one exists
  const selectedClip = activeProject?.timeline_state.tracks
    .find((t) => t.id === selectedTrackId)
    ?.clips.find((c) => c.id === selectedClipId)

  const handleClipUpdate = (props: any) => {
    if (selectedTrackId && selectedClipId) {
      updateClipProperties(selectedTrackId, selectedClipId, props)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/5 p-3">
        <h2 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          Properties
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {selectedClip ? (
            <div className="space-y-6">
              {/* Timing Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-blue-500" />
                  <h3 className="text-[10px] font-bold tracking-tight text-blue-400/80 uppercase">
                    Timeline Position
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-semibold text-white/40 uppercase">
                      In (Frames)
                    </Label>
                    <Input
                      type="number"
                      className="h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs focus-visible:ring-blue-500/50"
                      value={selectedClip.timeline_in}
                      onChange={(e) =>
                        handleClipUpdate({
                          timeline_in: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-semibold text-white/40 uppercase">
                      Out (Frames)
                    </Label>
                    <Input
                      type="number"
                      className="h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs focus-visible:ring-blue-500/50"
                      value={selectedClip.timeline_out}
                      onChange={(e) =>
                        handleClipUpdate({
                          timeline_out: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-md border border-white/5 bg-white/[0.02] p-2.5">
                  <Label className="text-[9px] font-semibold text-white/30 uppercase">
                    Duration
                  </Label>
                  <p className="mt-0.5 font-mono text-xs font-medium text-white/70">
                    {selectedClip.timeline_out - selectedClip.timeline_in}{' '}
                    <span className="text-[9px] text-white/20 uppercase">
                      frames
                    </span>
                  </p>
                </div>
              </div>

              <Separator className="bg-white/5" />

              {/* Source Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-purple-500" />
                  <h3 className="text-[10px] font-bold tracking-tight text-purple-400/80 uppercase">
                    Source Trim
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-semibold text-white/40 uppercase">
                      Source Start
                    </Label>
                    <Input
                      type="number"
                      className="h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs focus-visible:ring-purple-500/50"
                      value={selectedClip.source_in}
                      onChange={(e) =>
                        handleClipUpdate({
                          source_in: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-semibold text-white/40 uppercase">
                      Source End
                    </Label>
                    <Input
                      type="number"
                      className="h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs focus-visible:ring-purple-500/50"
                      disabled
                      value={selectedClip.source_out}
                    />
                  </div>
                </div>
                <p className="text-[9px] text-white/20 italic">
                  Source End is calculated automatically.
                </p>
              </div>

              <Separator className="bg-white/5" />

              {/* Info Section */}
              <div className="space-y-2">
                <Label className="text-[9px] font-semibold text-white/40 uppercase">
                  Clip ID
                </Label>
                <p className="truncate font-mono text-[10px] text-white/30">
                  {selectedClip.id}
                </p>
              </div>
            </div>
          ) : selectedAsset ? (
            <div className="space-y-5">
              <div className="flex aspect-video w-full items-center justify-center rounded-md border border-white/10 bg-black/40">
                <span className="text-[10px] font-bold tracking-widest text-white/20 uppercase">
                  Preview
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold tracking-tight text-white/40 uppercase">
                    Name
                  </label>
                  <p className="truncate text-xs font-medium text-white/90">
                    {selectedAsset.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold tracking-tight text-white/40 uppercase">
                      Type
                    </label>
                    <p className="text-xs text-white/80 capitalize">
                      {selectedAsset.media_type}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold tracking-tight text-white/40 uppercase">
                      Duration
                    </label>
                    <p className="text-xs text-white/80">
                      {selectedAsset.duration_ms
                        ? (selectedAsset.duration_ms / 1000).toFixed(2) + 's'
                        : 'Static'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold tracking-tight text-white/40 uppercase">
                    File Path
                  </label>
                  <p className="mt-1 rounded border border-white/5 bg-white/[0.02] p-2 text-[9px] leading-relaxed break-all text-white/30">
                    {selectedAsset.file_path}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <p className="text-xs text-white/20 italic">
                Select a clip on the timeline or an asset to view properties
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
