import { useMemo } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useProjectStore } from '@/store/projectStore';
import { CaretLeftIcon, SparkleIcon, TrashIcon } from '@phosphor-icons/react';
import { debounce } from 'lodash';

export const ColorTool = () => {
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);
  const selectedClipId = useWorkspaceStore((state) => state.selectedClipId);
  const activeProject = useProjectStore((state) => state.activeProject);
  const updateClipProperties = useProjectStore(
    (state) => state.updateClipProperties,
  );

  const timeline = activeProject?.timeline_state;

  // Locate the currently selected clip and its track
  const selectedClipInfo = useMemo(() => {
    if (!timeline || !selectedClipId) return null;
    for (const track of timeline.tracks) {
      const clip = track.clips.find((c: any) => c.id === selectedClipId);
      if (clip) {
        return { clip, trackId: track.id };
      }
    }
    return null;
  }, [timeline, selectedClipId]);

  // Debounced database save (persists timeline properties to SQLite 250ms after dragging finishes)
  const debouncedPersist = useMemo(
    () =>
      debounce((trackId: string, clipId: string, adj: any) => {
        void useProjectStore
          .getState()
          .updateClipProperties(trackId, clipId, { adjustments: adj }, true);
      }, 250),
    [],
  );

  const adjustments = (selectedClipInfo?.clip?.adjustments || {}) as any;
  const brightness =
    typeof adjustments.brightness === 'number' ? adjustments.brightness : 1.0;
  const contrast =
    typeof adjustments.contrast === 'number' ? adjustments.contrast : 1.0;
  const saturation =
    typeof adjustments.saturation === 'number' ? adjustments.saturation : 1.0;
  const vignette =
    typeof adjustments.vignette === 'number' ? adjustments.vignette : 0.0;
  const sepia = typeof adjustments.sepia === 'number' ? adjustments.sepia : 0.0;
  const temperature =
    typeof adjustments.temperature === 'number' ? adjustments.temperature : 0.0;
  const activePreset =
    typeof adjustments.preset === 'string' ? adjustments.preset : 'none';

  const handleAdjustmentChange = (fieldName: string, value: any) => {
    if (!selectedClipInfo || !selectedClipId) return;

    const newAdjustments = {
      ...adjustments,
      [fieldName]: value,
    };

    // Update store instantly for 60fps local rendering preview
    void updateClipProperties(
      selectedClipInfo.trackId,
      selectedClipId,
      { adjustments: newAdjustments },
      false,
    );

    // Persist to database in background
    debouncedPersist(selectedClipInfo.trackId, selectedClipId, newAdjustments);
  };

  const resetAdjustments = () => {
    if (!selectedClipInfo || !selectedClipId) return;

    const defaults = {
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      vignette: 0.0,
      sepia: 0.0,
      temperature: 0.0,
      preset: 'none',
      tint: [1.0, 1.0, 1.0],
    };

    void updateClipProperties(
      selectedClipInfo.trackId,
      selectedClipId,
      { adjustments: defaults },
      true,
    );
  };

  if (!selectedClipInfo || !selectedClipId) {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Header */}
        <div className="border-border flex items-center gap-2 border-b pb-2">
          <button
            onClick={() => setActiveTool('select')}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-6 items-center justify-center rounded-none transition-all"
            title="Back to Tools"
          >
            <CaretLeftIcon className="size-4" />
          </button>
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Color Grading
          </h2>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="bg-primary/5 text-primary border-primary/20 mb-3 flex size-12 items-center justify-center rounded-full border">
            <SparkleIcon className="size-6 animate-pulse" />
          </div>
          <h3 className="text-xs font-medium text-white">No Clip Selected</h3>
          <p className="text-muted-foreground mt-1 max-w-[180px] text-[10px] leading-relaxed">
            Please click on a video or image clip in your timeline to adjust its
            color settings and presets.
          </p>
        </div>
      </div>
    );
  }

  const presets = [
    { id: 'none', label: 'None / Original' },
    { id: 'classic_pop', label: 'Classic Pop' },
    { id: 'cinematic_dark', label: 'Cinematic Dark' },
    { id: 'cyberpunk_neon', label: 'Spider-Verse Neon' },
    { id: 'vintage_film', label: 'Cinematic Retro Film' },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTool('select')}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-6 items-center justify-center rounded-none transition-all"
            title="Back to Tools"
          >
            <CaretLeftIcon className="size-4" />
          </button>
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Color Grading
          </h2>
        </div>
        <button
          onClick={resetAdjustments}
          className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-[10px] font-medium transition-all"
          title="Reset all settings to default"
        >
          <TrashIcon className="size-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Preset List */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
          Cinematic Presets
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {presets.map((preset) => {
            const isPresetActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleAdjustmentChange('preset', preset.id)}
                className={`w-full rounded-md border p-2 text-left text-[11px] font-medium transition-all ${
                  isPresetActive
                    ? 'border-primary bg-primary/10 text-white shadow-sm'
                    : 'border-white/5 bg-white/[0.01] text-white/60 hover:border-white/10 hover:bg-white/[0.02]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="my-1 border-t border-white/5" />

      {/* Controls Sliders */}
      <div className="space-y-4">
        <label className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
          Adjustments
        </label>

        {/* Exposure/Brightness */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/70">Exposure</span>
            <span className="font-mono text-white/50">
              {brightness.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.01"
            value={brightness}
            onChange={(e) =>
              handleAdjustmentChange('brightness', parseFloat(e.target.value))
            }
            className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 hover:bg-white/20"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/70">Contrast</span>
            <span className="font-mono text-white/50">
              {contrast.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.01"
            value={contrast}
            onChange={(e) =>
              handleAdjustmentChange('contrast', parseFloat(e.target.value))
            }
            className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 hover:bg-white/20"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/70">Saturation</span>
            <span className="font-mono text-white/50">
              {saturation.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="2.0"
            step="0.01"
            value={saturation}
            onChange={(e) =>
              handleAdjustmentChange('saturation', parseFloat(e.target.value))
            }
            className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 hover:bg-white/20"
          />
        </div>

        {/* Vignette */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/70">Vignette Intensity</span>
            <span className="font-mono text-white/50">
              {vignette.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={vignette}
            onChange={(e) =>
              handleAdjustmentChange('vignette', parseFloat(e.target.value))
            }
            className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 hover:bg-white/20"
          />
        </div>

        {/* Temperature */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/70">Temperature</span>
            <span className="font-mono text-white/50">
              {temperature > 0
                ? `+${temperature.toFixed(2)}`
                : temperature.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="-1.0"
            max="1.0"
            step="0.01"
            value={temperature}
            onChange={(e) =>
              handleAdjustmentChange('temperature', parseFloat(e.target.value))
            }
            className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 hover:bg-white/20"
          />
          <div className="flex justify-between px-0.5 text-[8px] text-white/30">
            <span>Cold (Blue)</span>
            <span>Warm (Amber)</span>
          </div>
        </div>

        {/* Sepia */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/70">Sepia Aging</span>
            <span className="font-mono text-white/50">{sepia.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={sepia}
            onChange={(e) =>
              handleAdjustmentChange('sepia', parseFloat(e.target.value))
            }
            className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 hover:bg-white/20"
          />
        </div>
      </div>
    </div>
  );
};
