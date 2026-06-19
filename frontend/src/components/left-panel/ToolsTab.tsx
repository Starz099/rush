import { CursorClickIcon, ScissorsIcon, CropIcon } from '@phosphor-icons/react'
import { useWorkspaceStore } from '@/store/workspaceStore'

export const ToolsTab = () => {
  const activeTool = useWorkspaceStore((state) => state.activeTool)
  const setActiveTool = useWorkspaceStore((state) => state.setActiveTool)

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Editing Tools
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {/* Select Tool Button */}
        <button
          onClick={() => setActiveTool('select')}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
            activeTool === 'select'
              ? 'border-blue-500 bg-blue-500/10 text-white'
              : 'border-white/5 bg-white/[0.01] text-white/60 hover:border-white/10 hover:bg-white/[0.02]'
          }`}
        >
          <CursorClickIcon className="mt-0.5 size-4 shrink-0 text-blue-400" />
          <div>
            <div className="text-xs font-medium">Select Tool</div>
            <div className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
              Select and drag clips to reposition them on the timeline tracks.
            </div>
          </div>
        </button>

        {/* Split Tool Button */}
        <button
          onClick={() => setActiveTool('split')}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
            activeTool === 'split'
              ? 'border-red-500 bg-red-500/10 text-white'
              : 'border-white/5 bg-white/[0.01] text-white/60 hover:border-white/10 hover:bg-white/[0.02]'
          }`}
        >
          <ScissorsIcon className="mt-0.5 size-4 shrink-0 text-red-400" />
          <div>
            <div className="text-xs font-medium">Split Tool</div>
            <div className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
              Click on any clip in the timeline to split it at the cursor
              position.
            </div>
          </div>
        </button>

        {/* Trim Tool Button */}
        <button
          onClick={() => setActiveTool('trim')}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
            activeTool === 'trim'
              ? 'border-green-500 bg-green-500/10 text-white'
              : 'border-white/5 bg-white/[0.01] text-white/60 hover:border-white/10 hover:bg-white/[0.02]'
          }`}
        >
          <CropIcon className="mt-0.5 size-4 shrink-0 text-green-400" />
          <div>
            <div className="text-xs font-medium">Trim Handles Tool</div>
            <div className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
              Hover on clip edges to reveal handles and drag to trim starting or
              ending frames.
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
