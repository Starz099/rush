import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/store/projectStore';
import { projectApi } from '@/api/project';

export const useLoadProject = (projectId: string | undefined) => {
  const navigate = useNavigate();
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const fetchAssets = useProjectStore((state) => state.fetchAssets);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      navigate('/');
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);

      try {
        const loadedProject = await projectApi.getById(projectId);

        if (!isMounted) return;

        setActiveProject(loadedProject);

        // Sync playhead position to timelineStore
        const { useAppStore } = await import('@/store/timelineStore');
        useAppStore
          .getState()
          .setPlayhead(loadedProject.timeline_state.playhead_position);

        await fetchAssets(projectId);
      } catch (error) {
        if (!isMounted) return;

        console.error('Failed to load project data:', error);
        navigate('/');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [navigate, projectId, setActiveProject, fetchAssets]);

  return { isLoading };
};
