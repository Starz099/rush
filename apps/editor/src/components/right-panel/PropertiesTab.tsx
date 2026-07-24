import { useWorkspaceStore } from '@/store/workspaceStore';
import { useProjectStore } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ArrowUpIcon, ArrowDownIcon } from '@phosphor-icons/react';

const PropertiesTab = () => {
  const { selectedAsset, selectedClipId, selectedTrackId, clearSelection } =
    useWorkspaceStore();

  const { activeProject, updateClipProperties, deleteClip, moveClipToTrack } =
    useProjectStore();

  // Find track
  const track = activeProject?.timeline_state.tracks.find(
    (t) => t.id === selectedTrackId,
  );

  // Find clip
  const selectedClip = track?.clips.find((c) => c.id === selectedClipId);

  const isGap =
    track?.track_type?.toLowerCase() === 'effects'
      ? !selectedClip?.effect_type &&
        !selectedClip?.asset_id &&
        (selectedClip?.speed_factor === undefined ||
          selectedClip?.speed_factor === null ||
          selectedClip?.speed_factor === 1.0)
      : !selectedClip?.asset_id;

  const handleClipUpdate = (props: any) => {
    if (selectedTrackId && selectedClipId) {
      updateClipProperties(selectedTrackId, selectedClipId, props);
    }
  };

  // Helper to extract static value (no keyframe search)
  const getStaticValue = (prop: any, defaultValue: number): number => {
    if (!prop) return defaultValue;
    return typeof prop.value === 'number' ? prop.value : defaultValue;
  };

  // Helper to update static value (no keyframe arrays)
  const updateStaticValue = (propKey: string, value: number) => {
    if (!selectedClip || !selectedTrackId || !selectedClipId) return;

    const currentTransform = selectedClip.transform || {
      x: { has_keyframes: false, value: 0.0, keyframes: [] },
      y: { has_keyframes: false, value: 0.0, keyframes: [] },
      scale: { has_keyframes: false, value: 1.0, keyframes: [] },
      rotation: { has_keyframes: false, value: 0.0, keyframes: [] },
      opacity: { has_keyframes: false, value: 1.0, keyframes: [] },
      anchor_x: 0.5,
      anchor_y: 0.5,
      z_index: 0,
    };

    const prop = (currentTransform as any)[propKey] || {
      has_keyframes: false,
      value: 0.0,
      keyframes: [],
    };

    handleClipUpdate({
      transform: {
        ...currentTransform,
        [propKey]: {
          ...prop,
          value,
        },
      },
    });
  };

  const handleZIndexUpdate = (delta: number) => {
    if (selectedClip) {
      const currentTransform = selectedClip.transform || { z_index: 0 };
      const currentZ = currentTransform.z_index || 0;
      handleClipUpdate({
        transform: {
          ...(selectedClip.transform || {}),
          z_index: currentZ + delta,
        },
      });
    }
  };

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
            /* --- CLIP INSPECTOR PANEL --- */
            <div className="space-y-6">
              {/* Timing Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                  <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
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
                      className="focus-visible:ring-primary/50 h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs"
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
                      className="focus-visible:ring-primary/50 h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs"
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

              {!isGap && track && activeProject && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                    <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                      Track Assignment
                    </h3>
                  </div>
                  <select
                    className="focus-visible:ring-primary/50 h-8 w-full rounded border border-white/5 bg-white/[0.03] px-2 text-xs font-medium text-white/85 focus:outline-none"
                    value={selectedTrackId || ''}
                    onChange={(e) => {
                      if (selectedTrackId && selectedClipId) {
                        moveClipToTrack(
                          selectedTrackId,
                          e.target.value,
                          selectedClipId,
                        );
                      }
                    }}
                  >
                    {activeProject.timeline_state.tracks
                      .filter(
                        (t: any) =>
                          t.track_type?.toLowerCase() ===
                          track.track_type?.toLowerCase(),
                      )
                      .map((t: any) => (
                        <option
                          key={t.id}
                          value={t.id}
                          className="bg-[#111] text-white"
                        >
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <Separator className="bg-white/5" />

              {/* Transform & Motion Section */}
              {!isGap && (
                <>
                  {selectedClip.effect_type === 'zoom' ? (
                    /* --- ZOOM MOTION SELECTOR --- */
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                            <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                              Zoom Motion
                            </h3>
                          </div>
                        </div>

                        {/* Slider controls linking to updateStaticValue */}
                        <div className="space-y-4 pt-1">
                          {/* Zoom Scale Slider */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                Scale multiplier
                              </Label>
                              <span className="font-mono text-[10px] text-white/60">
                                {Math.round(
                                  getStaticValue(
                                    selectedClip.transform?.scale,
                                    1.0,
                                  ) * 100,
                                )}
                                %
                              </span>
                            </div>
                            <Slider
                              value={[
                                getStaticValue(
                                  selectedClip.transform?.scale,
                                  1.0,
                                ),
                              ]}
                              min={1.0}
                              max={4.0}
                              step={0.05}
                              onValueChange={([val]) =>
                                updateStaticValue('scale', val)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-white/5" />
                    </>
                  ) : (
                    /* --- STANDARD CLIP STATIC TRANSFORMS --- */
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                          <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                            Transform & Layout
                          </h3>
                        </div>

                        <div className="space-y-4">
                          {/* Scale */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                Scale multiplier
                              </Label>
                              <span className="font-mono text-[10px] text-white/60">
                                {Math.round(
                                  getStaticValue(
                                    selectedClip.transform?.scale,
                                    1.0,
                                  ) * 100,
                                )}
                                %
                              </span>
                            </div>
                            <Slider
                              value={[
                                getStaticValue(
                                  selectedClip.transform?.scale,
                                  1.0,
                                ),
                              ]}
                              min={0.1}
                              max={3.0}
                              step={0.05}
                              onValueChange={([val]) =>
                                updateStaticValue('scale', val)
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <Separator className="bg-white/5" />

                      {/* Single Clip Transitions Section */}
                      <div className="space-y-4 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                          <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                            Clip Transitions (Entrance/Exit)
                          </h3>
                        </div>

                        <div className="space-y-4">
                          {/* Fade In (Entrance) */}
                          <div className="space-y-2">
                            <Label className="text-[9px] font-semibold text-white/40 uppercase">
                              Entrance Transition (In)
                            </Label>
                            <select
                              className="h-8 w-full rounded border border-white/5 bg-white/[0.03] px-2 text-xs font-medium text-white/85 focus:outline-none focus-visible:ring-purple-500/50"
                              value={
                                selectedClip.clip_transitions?.in_transition
                                  ?.transition_type || 'none'
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                const currentTransitions =
                                  selectedClip.clip_transitions || {
                                    in_transition: null,
                                    out_transition: null,
                                    loop_animation: null,
                                  };
                                if (val === 'none') {
                                  handleClipUpdate({
                                    clip_transitions: {
                                      ...currentTransitions,
                                      in_transition: null,
                                    },
                                  });
                                } else {
                                  handleClipUpdate({
                                    clip_transitions: {
                                      ...currentTransitions,
                                      in_transition: {
                                        transition_type: val as any,
                                        duration_frames:
                                          selectedClip.clip_transitions
                                            ?.in_transition?.duration_frames ||
                                          15,
                                        ease_curve: 'ease_in_out',
                                        config: null,
                                      },
                                    },
                                  });
                                }
                              }}
                            >
                              <option
                                value="none"
                                className="bg-[#111] text-white"
                              >
                                None
                              </option>
                              <option
                                value="fade"
                                className="bg-[#111] text-white"
                              >
                                Fade In
                              </option>
                              <option
                                value="slide"
                                className="bg-[#111] text-white"
                              >
                                Slide In
                              </option>
                              <option
                                value="zoom"
                                className="bg-[#111] text-white"
                              >
                                Zoom In
                              </option>
                              <option
                                value="spin"
                                className="bg-[#111] text-white"
                              >
                                Spin In
                              </option>
                              <option
                                value="glitch"
                                className="bg-[#111] text-white"
                              >
                                Glitch In
                              </option>
                            </select>

                            {selectedClip.clip_transitions?.in_transition && (
                              <div className="space-y-3 border-l border-white/5 pt-1 pl-3">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-white/30 uppercase">
                                      Duration (Frames)
                                    </span>
                                    <span className="font-mono text-[10px] text-white/60">
                                      {
                                        selectedClip.clip_transitions
                                          .in_transition.duration_frames
                                      }
                                      f
                                    </span>
                                  </div>
                                  <Slider
                                    value={[
                                      selectedClip.clip_transitions
                                        .in_transition.duration_frames,
                                    ]}
                                    min={5}
                                    max={60}
                                    step={1}
                                    onValueChange={([val]) =>
                                      handleClipUpdate({
                                        clip_transitions: {
                                          ...selectedClip.clip_transitions,
                                          in_transition: {
                                            ...selectedClip.clip_transitions
                                              ?.in_transition,
                                            duration_frames: val,
                                          },
                                        },
                                      })
                                    }
                                  />
                                </div>

                                {selectedClip.clip_transitions.in_transition
                                  .transition_type === 'slide' && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] text-white/30 uppercase">
                                        Direction Angle
                                      </span>
                                      <span className="font-mono text-[10px] text-white/60">
                                        {selectedClip.clip_transitions
                                          .in_transition.config
                                          ?.angle_degrees ?? 180}
                                        °
                                      </span>
                                    </div>
                                    <Slider
                                      value={[
                                        selectedClip.clip_transitions
                                          .in_transition.config
                                          ?.angle_degrees ?? 180,
                                      ]}
                                      min={0}
                                      max={360}
                                      step={45}
                                      onValueChange={([val]) =>
                                        handleClipUpdate({
                                          clip_transitions: {
                                            ...selectedClip.clip_transitions,
                                            in_transition: {
                                              ...selectedClip.clip_transitions
                                                ?.in_transition,
                                              config: { angle_degrees: val },
                                            },
                                          },
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Fade Out (Exit) */}
                          <div className="space-y-2">
                            <Label className="text-[9px] font-semibold text-white/40 uppercase">
                              Exit Transition (Out)
                            </Label>
                            <select
                              className="h-8 w-full rounded border border-white/5 bg-white/[0.03] px-2 text-xs font-medium text-white/85 focus:outline-none focus-visible:ring-purple-500/50"
                              value={
                                selectedClip.clip_transitions?.out_transition
                                  ?.transition_type || 'none'
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                const currentTransitions =
                                  selectedClip.clip_transitions || {
                                    in_transition: null,
                                    out_transition: null,
                                    loop_animation: null,
                                  };
                                if (val === 'none') {
                                  handleClipUpdate({
                                    clip_transitions: {
                                      ...currentTransitions,
                                      out_transition: null,
                                    },
                                  });
                                } else {
                                  handleClipUpdate({
                                    clip_transitions: {
                                      ...currentTransitions,
                                      out_transition: {
                                        transition_type: val as any,
                                        duration_frames:
                                          selectedClip.clip_transitions
                                            ?.out_transition?.duration_frames ||
                                          15,
                                        ease_curve: 'ease_in_out',
                                        config: null,
                                      },
                                    },
                                  });
                                }
                              }}
                            >
                              <option
                                value="none"
                                className="bg-[#111] text-white"
                              >
                                None
                              </option>
                              <option
                                value="fade"
                                className="bg-[#111] text-white"
                              >
                                Fade Out
                              </option>
                              <option
                                value="slide"
                                className="bg-[#111] text-white"
                              >
                                Slide Out
                              </option>
                              <option
                                value="zoom"
                                className="bg-[#111] text-white"
                              >
                                Zoom Out
                              </option>
                              <option
                                value="spin"
                                className="bg-[#111] text-white"
                              >
                                Spin Out
                              </option>
                              <option
                                value="glitch"
                                className="bg-[#111] text-white"
                              >
                                Glitch Out
                              </option>
                            </select>

                            {selectedClip.clip_transitions?.out_transition && (
                              <div className="space-y-3 border-l border-white/5 pt-1 pl-3">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-white/30 uppercase">
                                      Duration (Frames)
                                    </span>
                                    <span className="font-mono text-[10px] text-white/60">
                                      {
                                        selectedClip.clip_transitions
                                          .out_transition.duration_frames
                                      }
                                      f
                                    </span>
                                  </div>
                                  <Slider
                                    value={[
                                      selectedClip.clip_transitions
                                        .out_transition.duration_frames,
                                    ]}
                                    min={5}
                                    max={60}
                                    step={1}
                                    onValueChange={([val]) =>
                                      handleClipUpdate({
                                        clip_transitions: {
                                          ...selectedClip.clip_transitions,
                                          out_transition: {
                                            ...selectedClip.clip_transitions
                                              ?.out_transition,
                                            duration_frames: val,
                                          },
                                        },
                                      })
                                    }
                                  />
                                </div>

                                {selectedClip.clip_transitions.out_transition
                                  .transition_type === 'slide' && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] text-white/30 uppercase">
                                        Direction Angle
                                      </span>
                                      <span className="font-mono text-[10px] text-white/60">
                                        {selectedClip.clip_transitions
                                          .out_transition.config
                                          ?.angle_degrees ?? 0}
                                        °
                                      </span>
                                    </div>
                                    <Slider
                                      value={[
                                        selectedClip.clip_transitions
                                          .out_transition.config
                                          ?.angle_degrees ?? 0,
                                      ]}
                                      min={0}
                                      max={360}
                                      step={45}
                                      onValueChange={([val]) =>
                                        handleClipUpdate({
                                          clip_transitions: {
                                            ...selectedClip.clip_transitions,
                                            out_transition: {
                                              ...selectedClip.clip_transitions
                                                ?.out_transition,
                                              config: { angle_degrees: val },
                                            },
                                          },
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Color Adjustments Section */}
                      <Separator className="bg-white/5" />
                      <div className="space-y-4 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                          <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                            Color Adjustments
                          </h3>
                        </div>

                        {/* Brightness Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/30 uppercase">
                              Brightness
                            </span>
                            <span className="font-mono text-[10px] text-white/60">
                              {(
                                selectedClip.adjustments?.brightness ?? 1.0
                              ).toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[
                              selectedClip.adjustments?.brightness ?? 1.0,
                            ]}
                            min={0.5}
                            max={2.0}
                            step={0.05}
                            onValueChange={([val]) =>
                              handleClipUpdate({
                                adjustments: {
                                  ...(selectedClip.adjustments || {
                                    brightness: 1.0,
                                    contrast: 1.0,
                                    saturation: 1.0,
                                    vignette: 0.0,
                                  }),
                                  brightness: val,
                                },
                              })
                            }
                          />
                        </div>

                        {/* Contrast Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/30 uppercase">
                              Contrast
                            </span>
                            <span className="font-mono text-[10px] text-white/60">
                              {(
                                selectedClip.adjustments?.contrast ?? 1.0
                              ).toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[selectedClip.adjustments?.contrast ?? 1.0]}
                            min={0.5}
                            max={2.0}
                            step={0.05}
                            onValueChange={([val]) =>
                              handleClipUpdate({
                                adjustments: {
                                  ...(selectedClip.adjustments || {
                                    brightness: 1.0,
                                    contrast: 1.0,
                                    saturation: 1.0,
                                    vignette: 0.0,
                                  }),
                                  contrast: val,
                                },
                              })
                            }
                          />
                        </div>

                        {/* Saturation Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/30 uppercase">
                              Saturation
                            </span>
                            <span className="font-mono text-[10px] text-white/60">
                              {(
                                selectedClip.adjustments?.saturation ?? 1.0
                              ).toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[
                              selectedClip.adjustments?.saturation ?? 1.0,
                            ]}
                            min={0.0}
                            max={2.0}
                            step={0.05}
                            onValueChange={([val]) =>
                              handleClipUpdate({
                                adjustments: {
                                  ...(selectedClip.adjustments || {
                                    brightness: 1.0,
                                    contrast: 1.0,
                                    saturation: 1.0,
                                    vignette: 0.0,
                                  }),
                                  saturation: val,
                                },
                              })
                            }
                          />
                        </div>

                        {/* Vignette Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/30 uppercase">
                              Vignette
                            </span>
                            <span className="font-mono text-[10px] text-white/60">
                              {(
                                selectedClip.adjustments?.vignette ?? 0.0
                              ).toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[selectedClip.adjustments?.vignette ?? 0.0]}
                            min={0.0}
                            max={1.0}
                            step={0.05}
                            onValueChange={([val]) =>
                              handleClipUpdate({
                                adjustments: {
                                  ...(selectedClip.adjustments || {
                                    brightness: 1.0,
                                    contrast: 1.0,
                                    saturation: 1.0,
                                    vignette: 0.0,
                                  }),
                                  vignette: val,
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                      <Separator className="bg-white/5" />
                    </>
                  )}
                </>
              )}

              {/* Layer Order Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                  <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                    Layer Order
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-8 border-white/5 bg-white/[0.02] text-[10px] font-semibold text-white/80 hover:bg-white/5"
                    onClick={() => handleZIndexUpdate(1)}
                  >
                    <ArrowUpIcon className="mr-1 h-3.5 w-3.5" />
                    Bring Forward
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 border-white/5 bg-white/[0.02] text-[10px] font-semibold text-white/80 hover:bg-white/5"
                    onClick={() => handleZIndexUpdate(-1)}
                  >
                    <ArrowDownIcon className="mr-1 h-3.5 w-3.5" />
                    Send Backward
                  </Button>
                </div>
              </div>

              <Separator className="bg-white/5" />

              {/* Source Details Readout */}
              {selectedClip.asset_id && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                      <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                        Source Trimming
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-semibold text-white/40 uppercase">
                          Source In (Frames)
                        </Label>
                        <Input
                          type="number"
                          className="h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs focus-visible:ring-purple-500/50"
                          disabled
                          value={selectedClip.source_in}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-semibold text-white/40 uppercase">
                          Source Out (Frames)
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

              <Button
                variant="destructive"
                size="sm"
                className="mt-4 h-8 w-full text-[10px] font-semibold tracking-wider uppercase"
                onClick={() => {
                  if (selectedTrackId && selectedClipId) {
                    deleteClip(selectedTrackId, selectedClipId);
                    clearSelection();
                  }
                }}
              >
                Delete Clip
              </Button>
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
  );
};

export default PropertiesTab;
