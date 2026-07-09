import { useState, useEffect } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AssetCell } from './AssetCell';
import { assetApi } from '@/api/asset';
import type { Asset } from '@/api/bindings';
import { convertFileSrc } from '@tauri-apps/api/core';
import { fpsToNumeric } from '@/helpers/fps';

import { useWorkspaceStore } from '@/store/workspaceStore';
import { useProjectStore } from '@/store/projectStore';
import { useAppStore } from '@/store/timelineStore';
import { isVideoTrack, isAudioTrack } from '@/constants/trackConfig';
import { open } from '@tauri-apps/plugin-dialog';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
interface AssetsTabProps {
  projectId: string;
}

export const AssetsTab = ({ projectId }: AssetsTabProps) => {
  const [isLoading, setIsLoading] = useState(true);

  const selectedAsset = useWorkspaceStore((state) => state.selectedAsset);
  const setSelectedAsset = useWorkspaceStore((state) => state.setSelectedAsset);
  const selectedTrackId = useWorkspaceStore((state) => state.selectedTrackId);

  const activeProject = useProjectStore((state) => state.activeProject);
  const assets = useProjectStore((state) => state.assets);
  const fetchAssets = useProjectStore((state) => state.fetchAssets);
  const addAsset = useProjectStore((state) => state.addAsset);
  const removeAsset = useProjectStore((state) => state.removeAsset);
  const renameAsset = useProjectStore((state) => state.renameAsset);
  const saveTimeline = useProjectStore((state) => state.saveTimeline);

  const prepareAsset = useAppStore((state) => state.prepareAsset);

  useEffect(() => {
    let isMounted = true;
    const loadAssets = async () => {
      setIsLoading(true);
      await fetchAssets(projectId);
      if (isMounted) setIsLoading(false);
    };
    loadAssets();
    return () => {
      isMounted = false;
    };
  }, [projectId, fetchAssets]);

  const getMediaDuration = (filePath: string): Promise<number | null> => {
    return new Promise((resolve) => {
      // Use audio element for all probes as it's lighter and handles mp3 better
      const media = document.createElement('audio');
      media.preload = 'metadata';
      media.onloadedmetadata = () => {
        resolve(Math.round(media.duration * 1000));
      };
      media.onerror = () => {
        resolve(null);
      };
      media.src = convertFileSrc(filePath);
    });
  };

  const handleAddAsset = async () => {
    const filePaths = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: 'Supported Media',
          extensions: ['mp4', 'mp3'],
        },
      ],
    });
    if (!filePaths || filePaths.length === 0) return;

    for (const filePath of filePaths) {
      try {
        const duration = await getMediaDuration(filePath);
        const newAsset = await assetApi.register(projectId, filePath, duration);
        addAsset(newAsset);
      } catch (error) {
        console.error(`Failed to register asset ${filePath}:`, error);
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }

        if (permissionGranted) {
          sendNotification({
            title: 'Asset Import Failed',
            body: `Could not load: ${filePath.split(/[/\\]/).pop()}`,
          });
        }
      }
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await assetApi.delete(assetId);
      removeAsset(assetId);
      if (selectedAsset?.id === assetId) setSelectedAsset(null);
    } catch (error) {
      console.error('Failed to delete asset:', error);
      alert('Error deleting asset: ' + error);
    }
  };

  const handleRenameAsset = async (asset: Asset) => {
    const newName = window.prompt('Enter new name for asset:', asset.name);
    if (!newName || newName === asset.name) return;
    try {
      await renameAsset(asset.id, newName);
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset({ ...asset, name: newName });
      }
    } catch (error) {
      console.error('Failed to rename asset:', error);
      alert('Error renaming asset: ' + error);
    }
  };

  const handleAddToTimeline = async (asset: Asset) => {
    if (!activeProject) return;

    const timeline = activeProject.timeline_state;

    // Determine target tracks for this asset type
    const isVideo = asset.media_type === 'video';
    const isAudio =
      asset.media_type === 'audio' ||
      asset.file_path.toLowerCase().endsWith('.mp3');
    const isImage = asset.media_type === 'image';

    // Duration calculation (Convert ms to project frames)
    const framerate = fpsToNumeric(activeProject.framerate);
    const durationMs = asset.duration_ms || 5000;
    const durationFrames = Math.round((durationMs / 1000) * framerate);

    const isCompatible = (t: any) =>
      (isVideoTrack(t) && (isVideo || isImage)) || (isAudioTrack(t) && isAudio);

    // Find target track (selected first, otherwise first compatible)
    let targetTrack = timeline.tracks.find(
      (t: any) => t.id === selectedTrackId,
    );
    if (!targetTrack || !isCompatible(targetTrack)) {
      targetTrack = timeline.tracks.find(isCompatible);
    }

    let updatedTracks = [...timeline.tracks];

    // If no compatible track exists, create one!
    if (!targetTrack) {
      const trackType = isVideo || isImage ? 'video' : 'audio';
      const typeName = trackType === 'video' ? 'Video' : 'Audio';
      const typeCount = timeline.tracks.filter(
        (t: any) => t.track_type?.toLowerCase() === trackType,
      ).length;

      targetTrack = {
        id: `${trackType}-${Date.now()}`,
        name: `${typeName} ${typeCount + 1}`,
        track_type: trackType,
        clips: [],
        transitions: [],
        is_muted: false,
        is_locked: false,
      };

      updatedTracks.push(targetTrack);
    }

    // Find last media clip to place the new clip consecutively
    const nonGapClips = targetTrack.clips.filter((c: any) => {
      const isEffectTrack = targetTrack.track_type?.toLowerCase() === 'effects';
      const isGap = isEffectTrack
        ? !c.asset_id &&
          !c.transform &&
          (c.speed_factor === undefined ||
            c.speed_factor === null ||
            c.speed_factor === 1.0)
        : !c.asset_id;
      return !isGap;
    });

    const lastClip = nonGapClips[nonGapClips.length - 1];
    const timelineIn = lastClip ? lastClip.timeline_out : 0;
    const timelineOut = timelineIn + durationFrames;

    const newClip = {
      id: crypto.randomUUID(),
      asset_id: asset.id,
      timeline_in: timelineIn,
      timeline_out: timelineOut,
      source_in: 0,
      source_out: durationFrames,
    };

    updatedTracks = updatedTracks.map((t: any) => {
      if (t.id === targetTrack.id) {
        return {
          ...t,
          clips: [...t.clips, newClip],
        };
      }
      return t;
    });

    await saveTimeline(activeProject.id, {
      ...timeline,
      tracks: updatedTracks,
    });

    if (isVideo) {
      void prepareAsset(asset.id, asset.file_path);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-xs italic">
          Loading assets...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Assets
        </h2>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={handleAddAsset}
          title="Add Asset"
        >
          <PlusIcon weight="bold" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {assets.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-xs">
              No assets yet. Click + to add.
            </p>
          ) : (
            assets.map((asset) => (
              <AssetCell
                key={asset.id}
                asset={asset}
                isSelected={selectedAsset?.id === asset.id}
                onClick={() => setSelectedAsset(asset)}
                onDelete={(e) => {
                  e.stopPropagation();
                  handleDeleteAsset(asset.id);
                }}
                onRename={(e) => {
                  e.stopPropagation();
                  handleRenameAsset(asset);
                }}
                onAddToTimeline={(e) => {
                  e.stopPropagation();
                  handleAddToTimeline(asset);
                }}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
