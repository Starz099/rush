import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DotsThreeVerticalIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  GearIcon,
} from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useProjectStore } from '@/store/projectStore';
import { projectApi } from '@/api/project';
import {
  RESOLUTIONS,
  FPS_OPTIONS,
  DEFAULT_PROJECT_CONFIG,
} from '@/constants/project';
import type { Project, ResolutionValue, FPSValue } from '@/types/project';

const Home = () => {
  const navigate = useNavigate();
  // Store state and actions
  const projects = useProjectStore((state) => state.projects);
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const createProject = useProjectStore((state) => state.createProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const renameProject = useProjectStore((state) => state.renameProject);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);

  const [isOpen, setIsOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [resolution, setResolution] = useState<ResolutionValue>(
    DEFAULT_PROJECT_CONFIG.RESOLUTION,
  );
  const [fps, setFps] = useState<FPSValue>(DEFAULT_PROJECT_CONFIG.FPS);

  const [resolutions, setResolutions] = useState(RESOLUTIONS);
  const [fpsOptions, setFpsOptions] = useState(FPS_OPTIONS);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // Settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');

  // Load settings on modal open or mount
  useEffect(() => {
    const savedUrl =
      localStorage.getItem('rush_api_url') ||
      'https://openrouter.ai/api/v1/chat/completions';
    const savedKey = localStorage.getItem('rush_api_key') || '';
    const savedModel =
      localStorage.getItem('rush_model_id') ||
      'nvidia/nemotron-3-ultra-550b-a55b:free';

    setApiUrl(savedUrl);
    setApiKey(savedKey);
    setModelId(savedModel);
  }, [isSettingsOpen]);

  const handleSaveSettings = () => {
    localStorage.setItem('rush_api_url', apiUrl);
    localStorage.setItem('rush_api_key', apiKey);
    localStorage.setItem('rush_model_id', modelId);
    setIsSettingsOpen(false);
  };

  const handleCreate = async () => {
    try {
      await createProject(projectName, resolution, fps);
      setIsOpen(false);
      setProjectName('');
      setResolution(DEFAULT_PROJECT_CONFIG.RESOLUTION);
      setFps(DEFAULT_PROJECT_CONFIG.FPS);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleRename = async () => {
    if (!editingProject) return;
    try {
      await renameProject(editingProject.id, newProjectName);
      setIsRenameOpen(false);
    } catch (error) {
      console.error('Failed to rename project:', error);
    }
  };

  const handleDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(deletingProject.id);
      setIsDeleteOpen(false);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    projectApi
      .getPresets()
      .then((presets) => {
        if (presets.resolutions && presets.resolutions.length > 0) {
          setResolutions(presets.resolutions);
        }
        if (presets.fpsOptions && presets.fpsOptions.length > 0) {
          setFpsOptions(presets.fpsOptions);
        }
      })
      .catch((err) => {
        console.error('Failed to load presets from backend:', err);
      });
  }, []);

  return (
    <div className="bg-background text-foreground relative flex h-screen items-center justify-center overflow-hidden p-4">
      <BackgroundBeams />
      <Card className="relative z-10 w-full max-w-[400px]">
        <CardContent className="flex flex-col gap-5 p-4">
          <div className="flex w-full gap-2">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="flex-1">
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
                      onValueChange={(val) =>
                        setResolution(val as ResolutionValue)
                      }
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
                    <Select
                      value={fps}
                      onValueChange={(val) => setFps(val as FPSValue)}
                    >
                      <SelectTrigger id="fps">
                        <SelectValue placeholder="Select framerate" />
                      </SelectTrigger>
                      <SelectContent>
                        {fpsOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCreate}>Create Project</Button>
              </DialogContent>
            </Dialog>

            {/* Settings Dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="shrink-0 px-3"
                  title="AI Settings"
                >
                  <GearIcon weight="bold" className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>AI Agent Configurations</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="api-url">API Provider URL</Label>
                    <Input
                      id="api-url"
                      placeholder="https://openrouter.ai/api/v1/chat/completions"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                    />
                    <span className="text-muted-foreground/60 text-[10px]">
                      OpenAI-compatible endpoint (e.g. OpenRouter, LM Studio,
                      etc.)
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <span className="text-muted-foreground/60 text-[10px]">
                      Required for hosted API endpoints like OpenRouter or
                      OpenAI.
                    </span>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="model-id">Model ID / Name</Label>
                    <Input
                      id="model-id"
                      placeholder="nvidia/nemotron-3-ultra-550b-a55b:free"
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                    />
                    <span className="text-muted-foreground/60 text-[10px]">
                      The identifier of the LLM model to request.
                    </span>
                  </div>
                </div>
                <Button onClick={handleSaveSettings}>Save Settings</Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* Rename Project Dialog */}
          <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Rename Project</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="rename-name">New Project Name</Label>
                  <Input
                    id="rename-name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  />
                </div>
              </div>
              <Button onClick={handleRename}>Save Changes</Button>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Delete Project</DialogTitle>
              </DialogHeader>
              <div className="text-muted-foreground py-4 text-sm">
                Are you sure you want to delete{' '}
                <span className="text-foreground font-semibold">
                  {deletingProject?.name}
                </span>
                ? This action cannot be undone.
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete Project
                </Button>
              </div>
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
                  onClick={() => {
                    setActiveProject(project);
                    navigate(`/workspace/${project.id}`);
                  }}
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
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingProject(project);
                        setNewProjectName(project.name);
                        setIsRenameOpen(true);
                      }}
                    >
                      <PencilSimpleIcon data-icon="inline-start" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        setDeletingProject(project);
                        setIsDeleteOpen(true);
                      }}
                    >
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
  );
};

export default Home;
