import { useState } from 'react'
import {
  DotsThreeVerticalIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  ShareIcon,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
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

const projects = [
  { title: 'Summer Travel Vlog', meta: 'Edited 2 hours ago · 4:32' },
  { title: 'Product Launch Teaser', meta: 'Edited yesterday · 1:08' },
  { title: 'Podcast Episode 14', meta: 'Edited 3 days ago · 52:17' },
]

const resolutions = [
  { label: '1080p (16:9)', value: '1080p', width: 1920, height: 1080 },
  { label: '4K UHD (16:9)', value: '4k', width: 3840, height: 2160 },
  {
    label: 'Vertical / Shorts (9:16)',
    value: 'vertical',
    width: 1080,
    height: 1920,
  },
]

const fps_options = [24, 30, 60]

const Home = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [resolution, setResolution] = useState('1080p')
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [fps, setFps] = useState('30')

  const handleResolutionChange = (val: string) => {
    setResolution(val)
    const preset = resolutions.find((r) => r.value === val)
    if (preset && val !== 'custom') {
      setWidth(preset.width)
      setHeight(preset.height)
    }
  }

  const handleCreate = () => {
    console.log('Creating project:', {
      projectName,
      resolution,
      width,
      height,
      fps,
    })
    setIsOpen(false)
    // Reset form
    setProjectName('')
    setResolution('1080p')
    setWidth(1920)
    setHeight(1080)
    setFps('30')
  }

  return (
    <div className="bg-background text-foreground flex h-screen items-center justify-center p-4">
      <Card className="w-full max-w-[400px]">
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
                    onValueChange={handleResolutionChange}
                  >
                    <SelectTrigger id="resolution">
                      <SelectValue placeholder="Select resolution" />
                    </SelectTrigger>
                    <SelectContent>
                      {resolutions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="fps">Framerate (FPS)</Label>
                  <Select value={fps} onValueChange={setFps}>
                    <SelectTrigger id="fps">
                      <SelectValue placeholder="Select framerate" />
                    </SelectTrigger>
                    <SelectContent>
                      {fps_options.map((option) => (
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
                key={project.title}
                className="group hover:bg-muted/60 flex items-center gap-4 px-3 py-4 transition-all duration-100 hover:scale-[1.01]"
              >
                <Button
                  aria-label={`Open ${project.title}`}
                  size="icon-sm"
                  variant="ghost"
                >
                  <PlayIcon weight="regular" className="translate-x-[0.5px]" />
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-[15px] leading-5 font-medium">
                    {project.title}
                  </div>
                  <div className="text-muted-foreground truncate text-[12px] leading-4">
                    {project.meta}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`${project.title} options`}
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
