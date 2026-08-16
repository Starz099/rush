import { useEffect, useState } from 'react';
import {
  CursorClickIcon,
  ScissorsIcon,
  CropIcon,
  EyedropperIcon,
  SparkleIcon,
  TimerIcon,
  TextTIcon,
  SlidersIcon,
} from '@phosphor-icons/react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useProjectStore } from '@/store/projectStore';
import { useAppStore } from '@/store/timelineStore';
import { projectApi } from '@/api/project';
import type { ToolDescriptor, EffectDescriptor } from '@/api/bindings';
import type { EditingTool } from '@/types/editor';
import { BackgroundTool } from './tools/background/BackgroundTool';
import { ColorTool } from './tools/color/ColorTool';

/**
 * Fallback tools list to maintain UI functionality if backend fetch fails.
 */
const DEFAULT_TOOLS = [
  {
    name: 'select',
    label: 'Select Tool',
    description:
      'Select and drag clips to reposition them on the timeline tracks.',
  },
  {
    name: 'split',
    label: 'Split Tool',
    description:
      'Click on any clip in the timeline to split it at the cursor position.',
  },
  {
    name: 'trim',
    label: 'Trim Tool',
    description:
      'Drag the edge of any clip on the timeline to crop its duration.',
  },
  {
    name: 'color',
    label: 'Color Grading',
    description:
      'Cinematic color presets, filters, vignettes, sepia, and temperature adjustments.',
  },
  {
    name: 'bg',
    label: 'Background Config',
    description:
      'Select custom color gradients and blur filters for the viewport background.',
  },
];

/**
 * Icon and style mappings for the editing tools.
 */
const TOOL_STYLES: Record<
  string,
  { icon: any; colorClass: string; iconClass: string }
> = {
  select: {
    icon: CursorClickIcon,
    colorClass: 'border-primary bg-primary/10 text-white',
    iconClass: 'text-primary',
  },
  split: {
    icon: ScissorsIcon,
    colorClass: 'border-primary bg-primary/10 text-white',
    iconClass: 'text-primary',
  },
  trim: {
    icon: CropIcon,
    colorClass: 'border-primary bg-primary/10 text-white',
    iconClass: 'text-primary',
  },
  color: {
    icon: SlidersIcon,
    colorClass: 'border-primary bg-primary/10 text-white',
    iconClass: 'text-primary',
  },
  bg: {
    icon: EyedropperIcon,
    colorClass: 'border-primary bg-primary/10 text-white',
    iconClass: 'text-primary',
  },
};

/**
 * Icon and style mappings for the timeline effects.
 */
const EFFECT_STYLES: Record<string, { icon: any; iconClass: string }> = {
  zoom: { icon: SparkleIcon, iconClass: 'text-primary' },
  speed: { icon: TimerIcon, iconClass: 'text-primary' },
  text: { icon: TextTIcon, iconClass: 'text-primary' },
};

/**
 * ToolsTab displays active editing tools and adds effects dynamically from the backend registry.
 */
export const ToolsTab = () => {
  const activeTool: any = useWorkspaceStore((state) => state.activeTool);
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool);

  const activeProject = useProjectStore((state) => state.activeProject);
  const saveTimeline = useProjectStore((state) => state.saveTimeline);
  const playheadPosition = useAppStore((state) => state.playhead_position);

  const [registry, setRegistry] = useState<{
    tools: ToolDescriptor[];
    effects: EffectDescriptor[];
  } | null>(null);

  // Fetch editing tools and effects registry on component mount
  useEffect(() => {
    projectApi
      .getEditingRegistry()
      .then((data) => {
        setRegistry(data);
      })
      .catch((err) => {
        console.error('Failed to load editing registry:', err);
      });
  }, []);

  if (activeTool === 'bg') {
    return <BackgroundTool />;
  }

  if (activeTool === 'color') {
    return <ColorTool />;
  }

  const tools = registry?.tools || DEFAULT_TOOLS;
  const effects = registry?.effects || [];

  /**
   * Spawns a new effect block on the timeline's effects track at the current playhead.
   * Parses the default parameters from the backend configuration registry.
   */
  const handleAddEffect = async (effect: EffectDescriptor) => {
    if (!activeProject) return;
    const timeline = activeProject.timeline_state;
    const effectsTrack = timeline.tracks.find(
      (t: any) => t.track_type?.toLowerCase() === 'effects',
    );
    if (!effectsTrack) {
      alert('No effects track found on the timeline.');
      return;
    }

    const duration = effect.defaultDurationFrames;
    let parsedConfig: any = {};
    try {
      parsedConfig = JSON.parse(effect.defaultConfigJson);
    } catch (e) {
      console.error(
        'Failed to parse default config json for effect:',
        effect.name,
        e,
      );
    }

    const newClip: any = {
      id: crypto.randomUUID(),
      asset_id: null,
      timeline_in: playheadPosition,
      timeline_out: playheadPosition + duration,
      source_in: 0,
      source_out: duration,
    };

    newClip.effect_type = effect.name;
    newClip.effect_config = parsedConfig;

    if (effect.name === 'zoom') {
      newClip.transform = {
        x: {
          has_keyframes: false,
          value: parsedConfig.x ?? 0.0,
          keyframes: [],
        },
        y: {
          has_keyframes: false,
          value: parsedConfig.y ?? 0.0,
          keyframes: [],
        },
        scale: {
          has_keyframes: false,
          value: parsedConfig.scale ?? 1.2,
          keyframes: [],
        },
        rotation: { has_keyframes: false, value: 0.0, keyframes: [] },
        opacity: { has_keyframes: false, value: 1.0, keyframes: [] },
        anchor_x: 0.5,
        anchor_y: 0.5,
        z_index: parsedConfig.z_index ?? 0,
      };
    } else if (effect.name === 'speed') {
      newClip.speed_factor = parsedConfig.speed_factor;
    }

    const updatedTracks = timeline.tracks.map((t: any) => {
      if (t.id === effectsTrack.id) {
        return { ...t, clips: [...t.clips, newClip] };
      }
      return t;
    });

    await saveTimeline(activeProject.id, {
      ...timeline,
      tracks: updatedTracks,
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Editing Tools
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {/* Editing Tools Section */}
        {tools.map((tool) => {
          const style = TOOL_STYLES[tool.name] || {
            icon: CursorClickIcon,
            colorClass: 'border-primary bg-primary/10 text-white',
            iconClass: 'text-primary',
          };
          const Icon = style.icon;
          const isActive = activeTool === tool.name;

          return (
            <button
              key={tool.name}
              onClick={() => setActiveTool(tool.name as EditingTool)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                isActive
                  ? style.colorClass
                  : 'border-white/5 bg-white/[0.01] text-white/60 hover:border-white/10 hover:bg-white/[0.02]'
              }`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${style.iconClass}`} />
              <div>
                <div
                  className={`text-xs font-medium ${isActive ? 'text-white' : ''}`}
                >
                  {tool.label}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                  {tool.description}
                </div>
              </div>
            </button>
          );
        })}

        <div className="my-2 border-t border-white/5 pb-2" />

        {/* Dynamic Effects Section */}
        {effects.map((effect) => {
          const style = EFFECT_STYLES[effect.name] || {
            icon: SparkleIcon,
            iconClass: 'text-primary',
          };
          const Icon = style.icon;

          return (
            <button
              key={effect.name}
              onClick={() => handleAddEffect(effect)}
              className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3 text-left text-white/60 transition-all hover:border-white/10 hover:bg-white/[0.02]"
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${style.iconClass}`} />
              <div>
                <div className="text-xs font-medium text-white">
                  Add {effect.label}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                  {effect.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
