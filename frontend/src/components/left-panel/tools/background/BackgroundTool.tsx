import { useMemo } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import ColorPicker from '@/components/ui/color-picker'
import { CaretLeftIcon, PlusIcon } from '@phosphor-icons/react'
import { debounce } from 'lodash'

export const BackgroundTool = () => {
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool)
  const activeProject = useProjectStore((state) => state.activeProject)
  const updateBackground = useProjectStore((state) => state.updateBackground)

  // Safe fallback if background hasn't been initialized or uses legacy schema
  const background = activeProject?.timeline_state.background
  const currentBg = (
    background && 'source' in background
      ? background
      : {
          source: { type: 'solid', params: { color_hex: '#000000' } },
          blur_value: 0,
        }
  ) as any

  // Debounced database save: persists values to SQLite 250ms after dragging stops
  const debouncedPersistBackground = useMemo(
    () =>
      debounce((bg: any) => {
        const project = useProjectStore.getState().activeProject
        if (project) {
          useProjectStore.getState().saveTimeline(project.id, {
            ...project.timeline_state,
            background: bg,
          })
        }
      }, 250),
    [],
  )

  const handleBackgroundChange = (newBg: any) => {
    // Update store instantly with persist = false for smooth real-time preview
    void updateBackground(newBg, false)

    // Queue the database save operation
    debouncedPersistBackground(newBg)
  }

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
          Background Tool
        </h2>
      </div>

      {/* Source Selector Tabs */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-[9px] font-semibold uppercase">
          Background Source
        </label>
        <div className="border-border bg-muted/30 flex rounded-none border p-1">
          {(['solid', 'gradient'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                const newSource =
                  type === 'solid'
                    ? {
                        type: 'solid' as const,
                        params: { color_hex: '#000000' },
                      }
                    : {
                        type: 'gradient' as const,
                        params: {
                          gradient_type: 'linear',
                          colors: ['#ff512f', '#dd2476'],
                          angle_degrees: 45,
                        },
                      }
                handleBackgroundChange({
                  ...currentBg,
                  source: newSource,
                })
              }}
              className={`flex-1 rounded-none py-1.5 text-center text-[10px] font-semibold capitalize transition-all ${
                currentBg.source.type === type
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Solid Settings */}
      {currentBg.source.type === 'solid' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-[9px] font-semibold uppercase">
              Color Selection
            </label>
            <div className="flex items-center gap-3">
              <ColorPicker
                value={currentBg.source.params.color_hex}
                onChange={(newColor) => {
                  handleBackgroundChange({
                    ...currentBg,
                    source: { type: 'solid', params: { color_hex: newColor } },
                  })
                }}
              >
                <button className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground flex h-8 items-center gap-2 rounded-none border px-3 text-xs transition-all">
                  <div
                    className="border-border size-4 rounded-full border"
                    style={{
                      backgroundColor: currentBg.source.params.color_hex,
                    }}
                  />
                  <span className="font-mono text-xs">
                    {currentBg.source.params.color_hex}
                  </span>
                </button>
              </ColorPicker>
            </div>
          </div>
        </div>
      )}

      {/* Gradient Settings */}
      {currentBg.source.type === 'gradient' && (
        <div className="space-y-4">
          {/* Gradient Type Selection */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-[9px] font-semibold uppercase">
              Gradient Type
            </label>
            <div className="border-border bg-muted/30 flex rounded-none border p-0.5">
              {(['linear', 'radial'] as const).map((gType) => (
                <button
                  key={gType}
                  onClick={() => {
                    handleBackgroundChange({
                      ...currentBg,
                      source: {
                        type: 'gradient',
                        params: {
                          ...currentBg.source.params,
                          gradient_type: gType,
                        },
                      },
                    })
                  }}
                  className={`flex-1 rounded-none py-1.5 text-center text-[10px] font-semibold capitalize transition-all ${
                    currentBg.source.params.gradient_type === gType
                      ? 'bg-background text-foreground border-border border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {gType}
                </button>
              ))}
            </div>
          </div>

          {/* Angle Selection (Linear Only) */}
          {currentBg.source.params.gradient_type === 'linear' && (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-muted-foreground text-[9px] font-semibold uppercase">
                  Angle
                </label>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {currentBg.source.params.angle_degrees ?? 45}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={currentBg.source.params.angle_degrees ?? 45}
                onChange={(e) => {
                  handleBackgroundChange({
                    ...currentBg,
                    source: {
                      type: 'gradient',
                      params: {
                        ...currentBg.source.params,
                        angle_degrees: parseInt(e.target.value),
                      },
                    },
                  })
                }}
                className="accent-primary w-full cursor-pointer"
              />
            </div>
          )}

          {/* Color Stops Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-[9px] font-semibold uppercase">
                Color Stops
              </label>
              <button
                onClick={() => {
                  const newColors = [
                    ...(currentBg.source.params.colors || [
                      '#ff512f',
                      '#dd2476',
                    ]),
                    '#ffffff',
                  ]
                  handleBackgroundChange({
                    ...currentBg,
                    source: {
                      type: 'gradient',
                      params: {
                        ...currentBg.source.params,
                        colors: newColors,
                      },
                    },
                  })
                }}
                className="text-primary hover:text-primary/90 flex items-center gap-1 text-[10px] font-semibold transition-all"
              >
                <PlusIcon className="size-3" />
                Add Stop
              </button>
            </div>

            <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
              {(currentBg.source.params.colors || ['#ff512f', '#dd2476']).map(
                (color: string, index: number) => (
                  <div
                    key={index}
                    className="border-border bg-muted/20 flex items-center justify-between gap-2 rounded-none border p-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/60 font-mono text-[9px]">
                        Stop {index + 1}
                      </span>
                      <ColorPicker
                        value={color}
                        onChange={(newColor) => {
                          const newColors = [
                            ...(currentBg.source.params.colors || [
                              '#ff512f',
                              '#dd2476',
                            ]),
                          ]
                          newColors[index] = newColor
                          handleBackgroundChange({
                            ...currentBg,
                            source: {
                              type: 'gradient',
                              params: {
                                ...currentBg.source.params,
                                colors: newColors,
                              },
                            },
                          })
                        }}
                      >
                        <button className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground flex h-7 items-center gap-1.5 rounded-none border px-2 text-[10px] transition-all">
                          <div
                            className="border-border size-3 rounded-full border"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-mono text-[9px]">{color}</span>
                        </button>
                      </ColorPicker>
                    </div>

                    {(currentBg.source.params.colors || ['#ff512f', '#dd2476'])
                      .length > 2 && (
                      <button
                        onClick={() => {
                          const oldColors = currentBg.source.params.colors || [
                            '#ff512f',
                            '#dd2476',
                          ]
                          const newColors = oldColors.filter(
                            (_: any, i: number) => i !== index,
                          )
                          handleBackgroundChange({
                            ...currentBg,
                            source: {
                              type: 'gradient',
                              params: {
                                ...currentBg.source.params,
                                colors: newColors,
                              },
                            },
                          })
                        }}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-none px-2 py-0.5 text-[10px] font-semibold transition-all"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
      {/* Mandatory Blur Value Slider */}
      <div className="border-border mt-4 space-y-1.5 border-t pt-4">
        <div className="flex items-center justify-between">
          <label className="text-muted-foreground text-[9px] font-semibold uppercase">
            Blur Value
          </label>
          <span className="text-muted-foreground font-mono text-xs">
            {currentBg.blur_value}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={currentBg.blur_value}
          onChange={(e) => {
            handleBackgroundChange({
              ...currentBg,
              blur_value: parseInt(e.target.value),
            })
          }}
          className="accent-primary cursor-pointer"
        />
      </div>
    </div>
  )
}
