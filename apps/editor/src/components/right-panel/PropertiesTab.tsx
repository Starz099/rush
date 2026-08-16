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

  const handleTextConfigChange = (key: string, value: any) => {
    if (!selectedClip) return;
    const currentConfig = (selectedClip.effect_config as any) || {};
    handleClipUpdate({
      effect_config: {
        ...currentConfig,
        [key]: value,
      },
    });
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

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="p-4 pb-24">
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
                  ) : selectedClip.effect_type === 'text' ? (
                    /* --- TEXT EFFECT CUSTOMIZER --- */
                    <>
                      {(() => {
                        const textConfig = (selectedClip.effect_config ||
                          {}) as any;
                        const fontWeight = textConfig.font_weight ?? 'bold';
                        const fontStyle = textConfig.font_style ?? 'normal';
                        const textDecoration =
                          textConfig.text_decoration ?? 'none';

                        const presets = [
                          {
                            label: 'Comic Pop 💥',
                            config: {
                              font_family: 'Impact, sans-serif',
                              font_size: 48,
                              color: '#FFE600',
                              font_weight: 'bold',
                              font_style: 'italic',
                              text_decoration: 'none',
                              stroke_enable: true,
                              stroke_color: '#000000',
                              stroke_width: 5,
                              letter_spacing: 4,
                              bg_enable: false,
                            },
                          },
                          {
                            label: 'Neon Cyberpunk 💫',
                            config: {
                              font_family: 'Arial Black, sans-serif',
                              font_size: 38,
                              color: '#00F0FF',
                              font_weight: 'bold',
                              font_style: 'normal',
                              text_decoration: 'none',
                              stroke_enable: true,
                              stroke_color: '#100020',
                              stroke_width: 4,
                              letter_spacing: 2,
                              bg_enable: false,
                            },
                          },
                          {
                            label: 'Netflix Subtitle 🎥',
                            config: {
                              font_family: 'Outfit, sans-serif',
                              font_size: 23,
                              color: '#FFFFFF',
                              font_weight: 'normal',
                              font_style: 'normal',
                              text_decoration: 'none',
                              stroke_enable: true,
                              stroke_color: '#000000',
                              stroke_width: 2,
                              letter_spacing: 1,
                              bg_enable: false,
                            },
                          },
                          {
                            label: 'Cinematic Title 🎬',
                            config: {
                              font_family: 'Copperplate, serif',
                              font_size: 32,
                              color: '#F0F0F0',
                              font_weight: 'normal',
                              font_style: 'normal',
                              text_decoration: 'none',
                              stroke_enable: false,
                              letter_spacing: 10,
                              bg_enable: false,
                            },
                          },
                          {
                            label: 'Vintage Typewriter ⌨️',
                            config: {
                              font_family: 'Courier New, monospace',
                              font_size: 20,
                              color: '#E0E0E0',
                              font_weight: 'normal',
                              font_style: 'normal',
                              text_decoration: 'none',
                              stroke_enable: false,
                              letter_spacing: 4,
                              bg_enable: true,
                              bg_color: '#050505',
                              bg_opacity: 0.7,
                            },
                          },
                          {
                            label: 'Bold Industrial 🔨',
                            config: {
                              font_family: 'Franklin Gothic Medium, sans-serif',
                              font_size: 42,
                              color: '#FF3E3E',
                              font_weight: 'bold',
                              font_style: 'normal',
                              text_decoration: 'none',
                              stroke_enable: true,
                              stroke_color: '#000000',
                              stroke_width: 3.5,
                              letter_spacing: 3,
                              bg_enable: false,
                            },
                          },
                        ];

                        return (
                          <div className="space-y-4">
                            {/* Title */}
                            <div className="flex items-center gap-2">
                              <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                              <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                                Text Presets
                              </h3>
                            </div>

                            {/* Preset Buttons Grid */}
                            <div className="grid grid-cols-2 gap-1.5">
                              {presets.map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() =>
                                    handleClipUpdate({
                                      effect_config: {
                                        ...textConfig,
                                        ...preset.config,
                                      },
                                    })
                                  }
                                  className="h-8 w-full rounded border border-white/5 bg-white/[0.01] text-[10px] font-semibold text-white/70 transition-all hover:border-white/10 hover:bg-white/[0.03] hover:text-white"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>

                            <Separator className="bg-white/5" />

                            {/* Core properties section */}
                            <div className="flex items-center gap-2">
                              <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                              <h3 className="text-primary text-[10px] font-bold tracking-tight uppercase">
                                Typography & Formatting
                              </h3>
                            </div>

                            <div className="space-y-4 pt-1">
                              {/* Text content */}
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                  Text Content
                                </Label>
                                <Input
                                  value={textConfig.text ?? 'Hello World'}
                                  onChange={(e) =>
                                    handleTextConfigChange(
                                      'text',
                                      e.target.value,
                                    )
                                  }
                                  className="focus-visible:ring-primary/50 h-8 border-white/5 bg-white/[0.03] px-2 text-xs text-white"
                                />
                              </div>

                              {/* Font Styles Bar (B, I, U) */}
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                  Style Formatting
                                </Label>
                                <div className="flex items-center gap-1 rounded border border-white/5 bg-white/[0.01] p-1">
                                  {/* Bold button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTextConfigChange(
                                        'font_weight',
                                        fontWeight === 'bold'
                                          ? 'normal'
                                          : 'bold',
                                      )
                                    }
                                    className={`h-7 flex-1 rounded text-xs font-bold transition-all ${
                                      fontWeight === 'bold'
                                        ? 'bg-primary font-black text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                  >
                                    Bold
                                  </button>
                                  {/* Italic button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTextConfigChange(
                                        'font_style',
                                        fontStyle === 'italic'
                                          ? 'normal'
                                          : 'italic',
                                      )
                                    }
                                    className={`h-7 flex-1 rounded text-xs italic transition-all ${
                                      fontStyle === 'italic'
                                        ? 'bg-primary font-semibold text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                  >
                                    Italic
                                  </button>
                                  {/* Underline button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTextConfigChange(
                                        'text_decoration',
                                        textDecoration === 'underline'
                                          ? 'none'
                                          : 'underline',
                                      )
                                    }
                                    className={`h-7 flex-1 rounded text-xs underline transition-all ${
                                      textDecoration === 'underline'
                                        ? 'bg-primary font-semibold text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                  >
                                    Underline
                                  </button>
                                </div>
                              </div>

                              {/* Font Family select dropdown & Custom input */}
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                  Font Family
                                </Label>
                                <div className="space-y-1">
                                  <select
                                    value={
                                      textConfig.font_family ??
                                      'Outfit, sans-serif'
                                    }
                                    onChange={(e) =>
                                      handleTextConfigChange(
                                        'font_family',
                                        e.target.value,
                                      )
                                    }
                                    className="focus-visible:ring-primary/50 h-8 w-full rounded border border-white/5 bg-white/[0.03] px-2 text-xs font-medium text-white/85 focus:outline-none"
                                  >
                                    <option
                                      value="Outfit, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Outfit (Modern)
                                    </option>
                                    <option
                                      value="Impact, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Impact (Comic Bold)
                                    </option>
                                    <option
                                      value="Arial Black, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Arial Black (Heavy Retro)
                                    </option>
                                    <option
                                      value="Comic Sans MS, cursive"
                                      className="bg-[#111] text-white"
                                    >
                                      Comic Sans (Cartoon)
                                    </option>
                                    <option
                                      value="Courier New, monospace"
                                      className="bg-[#111] text-white"
                                    >
                                      Typewriter Monospace
                                    </option>
                                    <option
                                      value="Georgia, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Georgia (Classic Serif)
                                    </option>
                                    <option
                                      value="Times New Roman, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Times New Roman
                                    </option>
                                    <option
                                      value="Verdana, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Verdana (Clean UI)
                                    </option>
                                    <option
                                      value="Trebuchet MS, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Trebuchet (Groovy)
                                    </option>
                                    <option
                                      value="Arial, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Arial (Standard)
                                    </option>
                                    <option
                                      value="Helvetica, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Helvetica (Neutral)
                                    </option>
                                    <option
                                      value="Palatino, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Palatino (Renaissance)
                                    </option>
                                    <option
                                      value="Garamond, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Garamond (Antique)
                                    </option>
                                    <option
                                      value="Bookman Old Style, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Bookman (Editorial)
                                    </option>
                                    <option
                                      value="Century Gothic, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Century Gothic (Geometric)
                                    </option>
                                    <option
                                      value="Franklin Gothic Medium, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Franklin Gothic (Industrial)
                                    </option>
                                    <option
                                      value="Copperplate, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Copperplate (Cinematic)
                                    </option>
                                    <option
                                      value="Papyrus, fantasy"
                                      className="bg-[#111] text-white"
                                    >
                                      Papyrus (Rustic)
                                    </option>
                                    <option
                                      value="Brush Script MT, cursive"
                                      className="bg-[#111] text-white"
                                    >
                                      Brush Script (Elegant Script)
                                    </option>
                                    <option
                                      value="Outfit, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Outfit (Modern)
                                    </option>
                                    <option
                                      value="Impact, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Impact (Comic Bold)
                                    </option>
                                    <option
                                      value="Arial Black, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Arial Black (Heavy Retro)
                                    </option>
                                    <option
                                      value="Comic Sans MS, cursive"
                                      className="bg-[#111] text-white"
                                    >
                                      Comic Sans (Cartoon)
                                    </option>
                                    <option
                                      value="Courier New, monospace"
                                      className="bg-[#111] text-white"
                                    >
                                      Typewriter Monospace
                                    </option>
                                    <option
                                      value="Georgia, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Georgia (Classic Serif)
                                    </option>
                                    <option
                                      value="Times New Roman, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Times New Roman
                                    </option>
                                    <option
                                      value="Verdana, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Verdana (Clean UI)
                                    </option>
                                    <option
                                      value="Trebuchet MS, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Trebuchet (Groovy)
                                    </option>
                                    <option
                                      value="Arial, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Arial (Standard)
                                    </option>
                                    <option
                                      value="Helvetica, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Helvetica (Neutral)
                                    </option>
                                    <option
                                      value="Palatino, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Palatino (Renaissance)
                                    </option>
                                    <option
                                      value="Garamond, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Garamond (Antique)
                                    </option>
                                    <option
                                      value="Bookman Old Style, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Bookman (Editorial)
                                    </option>
                                    <option
                                      value="Century Gothic, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Century Gothic (Geometric)
                                    </option>
                                    <option
                                      value="Franklin Gothic Medium, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Franklin Gothic (Industrial)
                                    </option>
                                    <option
                                      value="Copperplate, serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Copperplate (Cinematic)
                                    </option>
                                    <option
                                      value="Papyrus, fantasy"
                                      className="bg-[#111] text-white"
                                    >
                                      Papyrus (Rustic)
                                    </option>
                                    <option
                                      value="Brush Script MT, cursive"
                                      className="bg-[#111] text-white"
                                    >
                                      Brush Script (Elegant Script)
                                    </option>
                                    <option
                                      value="Lucida Console, monospace"
                                      className="bg-[#111] text-white"
                                    >
                                      Lucida Console (Terminal)
                                    </option>
                                    <option
                                      value="Jokerman, fantasy"
                                      className="bg-[#111] text-white"
                                    >
                                      Jokerman (Funky Dots)
                                    </option>
                                    <option
                                      value="Chiller, fantasy"
                                      className="bg-[#111] text-white"
                                    >
                                      Chiller (Horror Stencil)
                                    </option>
                                    <option
                                      value="Broadway, sans-serif"
                                      className="bg-[#111] text-white"
                                    >
                                      Broadway (Retro Deco)
                                    </option>
                                    <option
                                      value="Gigi, cursive"
                                      className="bg-[#111] text-white"
                                    >
                                      Gigi (Funky Curly)
                                    </option>
                                    <option
                                      value="Ravie, fantasy"
                                      className="bg-[#111] text-white"
                                    >
                                      Ravie (Cartoon Fat)
                                    </option>
                                  </select>
                                  <Input
                                    placeholder="Or type custom system font name..."
                                    value={textConfig.font_family ?? ''}
                                    onChange={(e) =>
                                      handleTextConfigChange(
                                        'font_family',
                                        e.target.value,
                                      )
                                    }
                                    className="focus-visible:ring-primary/50 h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-[10px] text-white/70"
                                  />
                                </div>
                              </div>

                              {/* Letter Spacing (Gap) Slider */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                    Letter Spacing (Gap)
                                  </Label>
                                  <span className="font-mono text-[10px] text-white/60">
                                    {textConfig.letter_spacing ?? 0}px
                                  </span>
                                </div>
                                <Slider
                                  value={[textConfig.letter_spacing ?? 0]}
                                  min={-10}
                                  max={40}
                                  step={1}
                                  onValueChange={([val]) =>
                                    handleTextConfigChange(
                                      'letter_spacing',
                                      val,
                                    )
                                  }
                                />
                              </div>

                              {/* Font Size slider */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                    Font Size
                                  </Label>
                                  <span className="font-mono text-[10px] text-white/60">
                                    {textConfig.font_size ?? 36}px
                                  </span>
                                </div>
                                <Slider
                                  value={[textConfig.font_size ?? 36]}
                                  min={10}
                                  max={120}
                                  step={1}
                                  onValueChange={([val]) =>
                                    handleTextConfigChange('font_size', val)
                                  }
                                />
                              </div>

                              {/* Font Color */}
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                  Text Color (Hex)
                                </Label>
                                <Input
                                  value={textConfig.color ?? '#ffffff'}
                                  onChange={(e) =>
                                    handleTextConfigChange(
                                      'color',
                                      e.target.value,
                                    )
                                  }
                                  className="focus-visible:ring-primary/50 h-8 border-white/5 bg-white/[0.03] px-2 font-mono text-xs text-white"
                                />
                              </div>

                              {/* Stroke Outline Section */}
                              <div className="space-y-4 rounded-md border border-white/5 bg-white/[0.01] p-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                    Outline Stroke (Comic Style)
                                  </Label>
                                  <input
                                    type="checkbox"
                                    checked={textConfig.stroke_enable ?? false}
                                    onChange={(e) =>
                                      handleTextConfigChange(
                                        'stroke_enable',
                                        e.target.checked,
                                      )
                                    }
                                    className="accent-primary h-3.5 w-3.5 cursor-pointer rounded border-white/10 bg-white/5"
                                  />
                                </div>

                                {(textConfig.stroke_enable ?? false) && (
                                  <div className="space-y-3 border-t border-white/5 pt-2">
                                    <div className="space-y-1.5">
                                      <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                        Outline Color
                                      </Label>
                                      <Input
                                        value={
                                          textConfig.stroke_color ?? '#000000'
                                        }
                                        onChange={(e) =>
                                          handleTextConfigChange(
                                            'stroke_color',
                                            e.target.value,
                                          )
                                        }
                                        className="focus-visible:ring-primary/50 h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs text-white"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                          Outline Thickness
                                        </Label>
                                        <span className="font-mono text-[10px] text-white/60">
                                          {textConfig.stroke_width ?? 4}px
                                        </span>
                                      </div>
                                      <Slider
                                        value={[textConfig.stroke_width ?? 4]}
                                        min={1}
                                        max={12}
                                        step={0.5}
                                        onValueChange={([val]) =>
                                          handleTextConfigChange(
                                            'stroke_width',
                                            val,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Center Position X Slider */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                    Center Position X
                                  </Label>
                                  <span className="font-mono text-[10px] text-white/60">
                                    {Math.round(
                                      (textConfig.position?.x ?? 0.5) * 100,
                                    )}
                                    %
                                  </span>
                                </div>
                                <Slider
                                  value={[textConfig.position?.x ?? 0.5]}
                                  min={0.0}
                                  max={1.0}
                                  step={0.01}
                                  onValueChange={([val]) =>
                                    handleTextConfigChange('position', {
                                      ...(textConfig.position || { y: 0.5 }),
                                      x: val,
                                    })
                                  }
                                />
                              </div>

                              {/* Center Position Y Slider */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                    Center Position Y
                                  </Label>
                                  <span className="font-mono text-[10px] text-white/60">
                                    {Math.round(
                                      (textConfig.position?.y ?? 0.5) * 100,
                                    )}
                                    %
                                  </span>
                                </div>
                                <Slider
                                  value={[textConfig.position?.y ?? 0.5]}
                                  min={0.0}
                                  max={1.0}
                                  step={0.01}
                                  onValueChange={([val]) =>
                                    handleTextConfigChange('position', {
                                      ...(textConfig.position || { x: 0.5 }),
                                      y: val,
                                    })
                                  }
                                />
                              </div>

                              {/* Background Box Section */}
                              <div className="space-y-4 rounded-md border border-white/5 bg-white/[0.01] p-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                    Background Bounding Box
                                  </Label>
                                  <input
                                    type="checkbox"
                                    checked={textConfig.bg_enable ?? false}
                                    onChange={(e) =>
                                      handleTextConfigChange(
                                        'bg_enable',
                                        e.target.checked,
                                      )
                                    }
                                    className="accent-primary h-3.5 w-3.5 cursor-pointer rounded border-white/10 bg-white/5"
                                  />
                                </div>

                                {(textConfig.bg_enable ?? false) && (
                                  <div className="space-y-3 border-t border-white/5 pt-2">
                                    <div className="space-y-1.5">
                                      <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                        Box Color
                                      </Label>
                                      <Input
                                        value={textConfig.bg_color ?? '#000000'}
                                        onChange={(e) =>
                                          handleTextConfigChange(
                                            'bg_color',
                                            e.target.value,
                                          )
                                        }
                                        className="focus-visible:ring-primary/50 h-7 border-white/5 bg-white/[0.03] px-2 font-mono text-xs text-white"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-[9px] font-semibold text-white/40 uppercase">
                                          Box Opacity
                                        </Label>
                                        <span className="font-mono text-[10px] text-white/60">
                                          {Math.round(
                                            (textConfig.bg_opacity ?? 0.5) *
                                              100,
                                          )}
                                          %
                                        </span>
                                      </div>
                                      <Slider
                                        value={[textConfig.bg_opacity ?? 0.5]}
                                        min={0.0}
                                        max={1.0}
                                        step={0.05}
                                        onValueChange={([val]) =>
                                          handleTextConfigChange(
                                            'bg_opacity',
                                            val,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

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
      </div>
    </div>
  );
};

export default PropertiesTab;
