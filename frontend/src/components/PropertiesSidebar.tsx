import { useWorkspaceStore } from '@/store/workspaceStore'
import { useProjectStore } from '@/store/projectStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { ArrowUpIcon, ArrowDownIcon } from '@phosphor-icons/react'

export const PropertiesSidebar = () => {
  const { selectedAsset, selectedClipId, selectedTrackId } = useWorkspaceStore()
  const { activeProject, updateClipProperties } = useProjectStore()

  // Find the selected clip object if one exists
  const track = activeProject?.timeline_state.tracks.find(
    (t) => t.id === selectedTrackId,
  )
  const selectedClip = track?.clips.find((c) => c.id === selectedClipId)

  const handleClipUpdate = (props: any) => {
    if (selectedTrackId && selectedClipId) {
      updateClipProperties(selectedTrackId, selectedClipId, props)
    }
  }

  const handleTransformUpdate = (key: string, value: number) => {
    const currentTransform = selectedClip?.transform || {
      x: 0,
      y: 0,
      scale: 1,
      z_index: 0,
    }
    handleClipUpdate({
      transform: {
        ...currentTransform,
        [key]: value,
      },
    })
  }

  const handleZIndexUpdate = (delta: number) => {
    if (selectedClip) {
      const currentZ = selectedClip.transform?.z_index || 0
      handleTransformUpdate('z_index', currentZ + delta)
    }
  }

  const clamp = (val: number, min: number, max: number) =>
    Math.min(Math.max(val, min), max)

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
              </div>

              <Separator className="bg-white/5" />

              {track?.track_type?.toLowerCase() === 'effects' ? (
                <>
                  {/* Zoom Multiplier Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-purple-500" />
                      <h3 className="text-[10px] font-bold tracking-tight text-purple-400/80 uppercase">
                        Zoom Effect Properties
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-semibold text-white/40 uppercase">
                          Zoom Multiplier
                        </Label>
                        <Input
                          type="number"
                          className="h-6 w-16 border-none bg-transparent p-0 text-right font-mono text-[10px] text-white/60 focus-visible:ring-0"
                          value={selectedClip.transform?.scale ?? 1.0}
                          step={0.05}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1.0
                            handleTransformUpdate('scale', val)
                          }}
                        />
                      </div>
                      <Slider
                        value={[selectedClip.transform?.scale ?? 1.0]}
                        min={0.5}
                        max={5.0}
                        step={0.05}
                        onValueChange={([val]) =>
                          handleTransformUpdate('scale', val)
                        }
                      />
                    </div>
                  </div>

                  <Separator className="bg-white/5" />
                </>
              ) : (
                <>
                  {/* Transform Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-emerald-500" />
                      <h3 className="text-[10px] font-bold tracking-tight text-emerald-400/80 uppercase">
                        Transform
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {/* Position X */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[9px] font-semibold text-white/40 uppercase">
                            Position X
                          </Label>
                          <Input
                            type="number"
                            className="h-6 w-16 border-none bg-transparent p-0 text-right font-mono text-[10px] text-white/60 focus-visible:ring-0"
                            value={selectedClip.transform?.x ?? 0}
                            onChange={(e) =>
                              handleTransformUpdate(
                                'x',
                                clamp(
                                  parseInt(e.target.value) || 0,
                                  -1920,
                                  1920,
                                ),
                              )
                            }
                          />
                        </div>
                        <Slider
                          value={[selectedClip.transform?.x ?? 0]}
                          min={-1920}
                          max={1920}
                          step={1}
                          onValueChange={([val]) =>
                            handleTransformUpdate('x', val)
                          }
                        />
                      </div>

                      {/* Position Y */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[9px] font-semibold text-white/40 uppercase">
                            Position Y
                          </Label>
                          <Input
                            type="number"
                            className="h-6 w-16 border-none bg-transparent p-0 text-right font-mono text-[10px] text-white/60 focus-visible:ring-0"
                            value={selectedClip.transform?.y ?? 0}
                            onChange={(e) =>
                              handleTransformUpdate(
                                'y',
                                clamp(
                                  parseInt(e.target.value) || 0,
                                  -1080,
                                  1080,
                                ),
                              )
                            }
                          />
                        </div>
                        <Slider
                          value={[selectedClip.transform?.y ?? 0]}
                          min={-1080}
                          max={1080}
                          step={1}
                          onValueChange={([val]) =>
                            handleTransformUpdate('y', val)
                          }
                        />
                      </div>

                      {/* Scale */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[9px] font-semibold text-white/40 uppercase">
                            Scale (%)
                          </Label>
                          <Input
                            type="number"
                            className="h-6 w-16 border-none bg-transparent p-0 text-right font-mono text-[10px] text-white/60 focus-visible:ring-0"
                            value={Math.round(
                              (selectedClip.transform?.scale ?? 1) * 100,
                            )}
                            onChange={(e) =>
                              handleTransformUpdate(
                                'scale',
                                clamp(parseInt(e.target.value) || 0, 1, 200) /
                                  100,
                              )
                            }
                          />
                        </div>
                        <Slider
                          value={[selectedClip.transform?.scale ?? 1]}
                          min={0.01}
                          max={2}
                          step={0.01}
                          onValueChange={([val]) =>
                            handleTransformUpdate('scale', val)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-white/5" />

                  {/* Layer Order Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-orange-500" />
                      <h3 className="text-[10px] font-bold tracking-tight text-orange-400/80 uppercase">
                        Layer Order
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-white/5 bg-white/[0.03] text-[10px] hover:bg-white/10"
                        onClick={() => handleZIndexUpdate(1)}
                      >
                        <ArrowUpIcon className="mr-1.5 h-3 w-3" />
                        Bring Forward
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-white/5 bg-white/[0.03] text-[10px] hover:bg-white/10"
                        onClick={() => handleZIndexUpdate(-1)}
                      >
                        <ArrowDownIcon className="mr-1.5 h-3 w-3" />
                        Send Backward
                      </Button>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <Label className="text-[9px] font-semibold text-white/40 uppercase">
                        Current Z-Index
                      </Label>
                      <Input
                        type="number"
                        className="h-6 w-12 border-none bg-transparent p-0 text-right font-mono text-[10px] text-white/60 focus-visible:ring-0"
                        value={selectedClip.transform?.z_index || 0}
                        onChange={(e) =>
                          handleTransformUpdate(
                            'z_index',
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
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
                  </div>

                  <Separator className="bg-white/5" />
                </>
              )}

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
