import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export interface ActiveTask {
  id: string;
  taskType: string;
  assetId: string | null;
  progress: number;
  message: string;
  status: string;
}

export const useBackgroundTasks = () => {
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);

  useEffect(() => {
    const unlistenPromise = listen<{
      assetId: string | null;
      taskType: string;
      progress: number;
      status: 'started' | 'progressing' | 'completed' | 'error';
      message: string;
    }>('asset_process_status', (event) => {
      const payload = event.payload;
      const taskId = `${payload.taskType}-${payload.assetId || 'global'}`;

      setActiveTasks((prev) => {
        if (payload.status === 'completed' || payload.status === 'error') {
          const exists = prev.some((t) => t.id === taskId);
          const next = exists
            ? prev.map((t) => {
                if (t.id === taskId) {
                  return {
                    ...t,
                    progress: 100,
                    status: payload.status,
                    message: payload.message,
                  };
                }
                return t;
              })
            : [
                ...prev,
                {
                  id: taskId,
                  taskType: payload.taskType,
                  assetId: payload.assetId,
                  progress: 100,
                  message: payload.message,
                  status: payload.status,
                },
              ];

          setTimeout(() => {
            setActiveTasks((current) => current.filter((t) => t.id !== taskId));
          }, 3000);

          return next;
        } else {
          const exists = prev.some((t) => t.id === taskId);
          if (exists) {
            return prev.map((t) => {
              if (t.id === taskId) {
                return {
                  ...t,
                  progress: payload.progress,
                  message: payload.message,
                  status: payload.status,
                };
              }
              return t;
            });
          } else {
            return [
              ...prev,
              {
                id: taskId,
                taskType: payload.taskType,
                assetId: payload.assetId,
                progress: payload.progress,
                message: payload.message,
                status: payload.status,
              },
            ];
          }
        }
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return { activeTasks };
};
