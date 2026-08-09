import { useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

export const useWorkspaceHotkeys = () => {
  const deleteClip = useProjectStore((state) => state.deleteClip);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selClipId = useWorkspaceStore.getState().selectedClipId;
        const selTrackId = useWorkspaceStore.getState().selectedTrackId;
        if (selClipId && selTrackId) {
          deleteClip(selTrackId, selClipId);
          useWorkspaceStore.getState().clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteClip]);
};
