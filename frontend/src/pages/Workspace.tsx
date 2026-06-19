import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjectStore } from '@/store/projectStore'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import type { Project } from '@/types/project'
import { projectApi } from '@/api/project'
import { LeftPanel } from '@/components/left-panel'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TimelinePanel } from '@/components/TimelinePanel'
import { PropertiesSidebar } from '@/components/PropertiesSidebar'
import { CaretLeftIcon } from '@phosphor-icons/react'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const Workspace = () => {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const activeProject = useProjectStore((state) => state.activeProject)
  const setActiveProject = useProjectStore((state) => state.setActiveProject)
  const fetchAssets = useProjectStore((state) => state.fetchAssets)
  const saveTimeline = useProjectStore((state) => state.saveTimeline)
  const [project, setProject] = useState<Project | null>(activeProject)
  const [isLoading, setIsLoading] = useState(true)
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)

  const handleExport = async () => {
    if (!project) return

    const outputPath = window.prompt(
      'Enter absolute output file path (e.g. C:/videos/output.mp4):',
      '',
    )
    if (!outputPath) return

    setIsRendering(true)
    setRenderProgress(0)

    let unlisten: (() => void) | null = null

    try {
      const { listen } = await import('@tauri-apps/api/event')
      unlisten = await listen<{ progress: number }>(
        'render-progress',
        (event) => {
          setRenderProgress(event.payload.progress)
        },
      )

      await projectApi.export(project.id, outputPath)
      alert('Project exported successfully!')
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed: ' + error)
    } finally {
      setIsRendering(false)
      if (unlisten) {
        unlisten()
      }
    }
  }

  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }

    let isMounted = true

    const loadData = async () => {
      setIsLoading(true)

      try {
        const loadedProject = await projectApi.getById(projectId)

        if (!isMounted) return

        setProject(loadedProject)
        setActiveProject(loadedProject)
        await fetchAssets(projectId)
      } catch (error) {
        if (!isMounted) return

        console.error('Failed to load project data:', error)
        navigate('/')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [navigate, projectId, setActiveProject])

  if (isLoading || !project) {
    return (
      <div className="bg-background text-foreground flex h-screen items-center justify-center">
        Loading workspace...
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => navigate('/')}
            title="Back to Home"
          >
            <CaretLeftIcon weight="bold" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">{project.name}</h1>
          <Badge variant="outline" className="h-5 py-0 text-[10px]">
            {project.viewport_width}x{project.viewport_height} @{' '}
            {project.framerate}fps
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isRendering}
            onClick={handleExport}
          >
            {isRendering
              ? `Exporting (${Math.round(renderProgress)}%)`
              : 'Export'}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              project && saveTimeline(project.id, project.timeline_state)
            }
          >
            Save
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left Sidebar */}
        <ResizablePanel maxSize={15} className="border-r">
          <LeftPanel projectId={projectId!} />
        </ResizablePanel>

        <ResizableHandle />

        {/* Center Content */}
        <ResizablePanel maxSize={60} className="flex flex-col bg-black/10">
          <ResizablePanelGroup orientation="vertical" className="flex-1">
            <ResizablePanel maxSize={60} className="border-b">
              <PreviewPanel />
            </ResizablePanel>

            <ResizablePanel maxSize={40} className="border-t">
              <TimelinePanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Sidebar */}
        <ResizablePanel maxSize={25} className="border-l">
          <PropertiesSidebar />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default Workspace
