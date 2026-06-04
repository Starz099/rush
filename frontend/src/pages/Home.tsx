import { useEffect, useState, useCallback } from 'react'
import {
  DotsThreeVerticalIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  ShareIcon,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { BackgroundBeams } from '@/components/ui/background-beams'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { projectApi } from '@/api/project'
import {
  RESOLUTIONS,
  FPS_OPTIONS,
  DEFAULT_PROJECT_CONFIG,
} from '@/constants/project'
import type {
  Project,
  ResolutionValue,
  ProjectWidth,
  ProjectHeight,
  FPSValue,
} from '@/types/project'

const Home = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectName, setProjectName] = useState('')
  const [resolution, setResolution] = useState<ResolutionValue>(
    DEFAULT_PROJECT_CONFIG.RESOLUTION,
  )
  const [width, setWidth] = useState<ProjectWidth>(DEFAULT_PROJECT_CONFIG.WIDTH)
  const [height, setHeight] = useState<ProjectHeight>(
    DEFAULT_PROJECT_CONFIG.HEIGHT,
  )
  const [fps, setFps] = useState<FPSValue>(DEFAULT_PROJECT_CONFIG.FPS)

  const applyResolutionPreset = (val: string) => {
    const preset = RESOLUTIONS.find((r) => r.value === val)
    if (preset) {
      setResolution(preset.value)
      setWidth(preset.width)
      setHeight(preset.height)
    }
  }

  const fetchProjects = useCallback(async () => {
    try {
      const projectsData = await projectApi.getAll()
      setProjects(projectsData)
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }, [])

  const handleCreate = async () => {
    try {
      await projectApi.create(projectName, width, height, parseInt(fps))
      setIsOpen(false)
      // Reset form
      setProjectName('')
      setResolution(DEFAULT_PROJECT_CONFIG.RESOLUTION)
      setWidth(DEFAULT_PROJECT_CONFIG.WIDTH)
      setHeight(DEFAULT_PROJECT_CONFIG.HEIGHT)
      setFps(DEFAULT_PROJECT_CONFIG.FPS)
      // Refresh list
      fetchProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="bg-background text-foreground relative flex h-screen items-center justify-center overflow-hidden p-4">
      <BackgroundBeams />
      <Card className="relative z-10 w-full max-w-[400px]">
        <CardContent className="flex flex-col gap-5 p-4">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="w-full">
                <PlusIcon weight="bold" data-icon="inline-start" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="My Awesome Video"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="resolution">Resolution</Label>
                  <Select
                    value={resolution}
                    onValueChange={applyResolutionPreset}
                  >
                    <SelectTrigger id="resolution">
                      <SelectValue placeholder="Select resolution" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOLUTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="fps">Framerate (FPS)</Label>
                  <Select
                    value={fps}
                    onValueChange={(val) => setFps(val as FPSValue)}
                  >
                    <SelectTrigger id="fps">
                      <SelectValue placeholder="Select framerate" />
                    </SelectTrigger>
                    <SelectContent>
                      {FPS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option.toString()}>
                          {option} FPS
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate}>Create Project</Button>
            </DialogContent>
          </Dialog>

          <div className="flex flex-col">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group hover:bg-muted/60 flex items-center gap-4 px-3 py-4 transition-all duration-100 hover:scale-[1.01]"
              >
                <Button
                  aria-label={`Open ${project.name}`}
                  size="icon-sm"
                  variant="ghost"
                >
                  <PlayIcon weight="regular" className="translate-x-[0.5px]" />
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-[15px] leading-5 font-medium">
                    {project.name}
                  </div>

                  <div className="text-muted-foreground truncate text-[12px] leading-4">
                    {project.viewport_width}x{project.viewport_height} @{' '}
                    {project.framerate} FPS
                  </div>
                  <div className="text-muted-foreground truncate text-[12px] leading-4">
                    last updated at: {project.updated_at}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`${project.name} options`}
                      className="group-hover:bg-muted opacity-0 transition-all group-hover:opacity-100"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <DotsThreeVerticalIcon weight="bold" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <PencilSimpleIcon data-icon="inline-start" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ShareIcon data-icon="inline-start" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <TrashIcon data-icon="inline-start" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Home
