import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/store/projectStore'
import { Button } from '@/components/ui/button'
import { CaretLeftIcon } from '@phosphor-icons/react'

const Workspace = () => {
  const navigate = useNavigate()
  const activeProject = useProjectStore((state) => state.activeProject)

  useEffect(() => {
    if (!activeProject) {
      navigate('/')
    }
  }, [activeProject, navigate])

  if (!activeProject) return null

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate('/')}
            title="Back to Home"
          >
            <CaretLeftIcon weight="bold" />
          </Button>
          <div className="bg-border h-4 w-[1px]" />
          <h1 className="text-sm font-medium">{activeProject.name}</h1>
          <span className="text-muted-foreground text-[10px] tracking-widest uppercase">
            {activeProject.viewport_width}x{activeProject.viewport_height} @{' '}
            {activeProject.framerate}fps
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 items-center justify-center overflow-hidden p-8">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold">Workspace initialized</h2>
          <p className="text-muted-foreground">
            Project:{' '}
            <span className="text-foreground">{activeProject.name}</span>
          </p>
          <p className="text-muted-foreground">
            ID:{' '}
            <span className="text-foreground font-mono text-xs">
              {activeProject.id}
            </span>
          </p>
        </div>
      </main>
    </div>
  )
}

export default Workspace
