import { useState, useEffect } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AssetCell } from './AssetCell'
import { assetApi } from '@/api/asset'
import type { Asset } from '@/api/bindings'
import { convertFileSrc } from '@tauri-apps/api/core'

import { useWorkspaceStore } from '@/store/workspaceStore'
import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '../store/timelineStore'

interface AssetSidebarProps {
  projectId: string
}

export const AssetSidebar = ({ projectId }: AssetSidebarProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const selectedAsset = useWorkspaceStore((state) => state.selectedAsset)
  const setSelectedAsset = useWorkspaceStore((state) => state.setSelectedAsset)

  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const fetchAssets = useProjectStore((state) => state.fetchAssets)
  const addAsset = useProjectStore((state) => state.addAsset)
  const removeAsset = useProjectStore((state) => state.removeAsset)
  const updateAsset = useProjectStore((state) => state.updateAsset)
  const saveTimeline = useProjectStore((state) => state.saveTimeline)

  const prepareAsset = useAppStore((state) => state.prepareAsset)

  useEffect(() => {
    let isMounted = true
    const loadAssets = async () => {
      setIsLoading(true)
      await fetchAssets(projectId)
      if (isMounted) setIsLoading(false)
    }
    loadAssets()
    return () => {
      isMounted = false
    }
  }, [projectId, fetchAssets])

  const getMediaDuration = (filePath: string): Promise<number | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve(Math.round(video.duration * 1000))
      }
      video.onerror = () => {
        resolve(null)
      }
      video.src = convertFileSrc(filePath)
    })
  }

  const handleAddAsset = async () => {
    const filePath = window.prompt(
      'Enter absolute file path to an image or video:',
    )
    if (!filePath) return

    try {
      const duration = await getMediaDuration(filePath)
      const newAsset = await assetApi.register(projectId, filePath, duration)
      addAsset(newAsset)
    } catch (error) {
      console.error('Failed to register asset:', error)
      alert('Error registering asset: ' + error)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await assetApi.delete(assetId)
      removeAsset(assetId)
      if (selectedAsset?.id === assetId) setSelectedAsset(null)
    } catch (error) {
      console.error('Failed to delete asset:', error)
      alert('Error deleting asset: ' + error)
    }
  }

  const handleRenameAsset = async (asset: Asset) => {
    const newName = window.prompt('Enter new name for asset:', asset.name)
    if (!newName || newName === asset.name) return
    try {
      await assetApi.rename(asset.id, newName)
      const updated = { ...asset, name: newName }
      updateAsset(updated)
      if (selectedAsset?.id === asset.id) setSelectedAsset(updated)
    } catch (error) {
      console.error('Failed to rename asset:', error)
      alert('Error renaming asset: ' + error)
    }
  }

  const handleAddToTimeline = async (asset: Asset) => {
    if (!activeProject) return

    const isMP4 = asset.file_path.toLowerCase().endsWith('.mp4')
    if (!isMP4) {
      alert(
        'Currently, only MP4 demuxing is supported. Audio and other formats cannot be added to the timeline yet.',
      )
      return
    }

    const timeline = activeProject.timeline_state

    // Determine target tracks for this asset type
    const isVideo = asset.media_type === 'video'
    const isAudio = asset.media_type === 'audio'
    const isImage = asset.media_type === 'image'

    // Duration calculation
    const framerate = activeProject.framerate
    const durationMs = asset.duration_ms || 5000
    const durationFrames = Math.round((durationMs / 1000) * framerate)

    const updatedTracks = timeline.tracks.map((t: any) => {
      const shouldAddToThisTrack =
        (t.track_type === 'video' && (isVideo || isImage)) ||
        (t.track_type === 'audio' && (isVideo || isAudio))

      if (shouldAddToThisTrack) {
        // Find the next available position on THIS specific track
        const lastClip = t.clips[t.clips.length - 1]
        const timelineIn = lastClip ? lastClip.timeline_out : 0
        const timelineOut = timelineIn + durationFrames

        const newClip = {
          id: crypto.randomUUID(),
          asset_id: asset.id,
          timeline_in: timelineIn,
          timeline_out: timelineOut,
          source_in: 0,
          source_out: durationFrames,
        }
        return { ...t, clips: [...t.clips, newClip] }
      }

      return t
    })

    // Verify if any tracks were actually updated
    const tracksUpdated = updatedTracks.some((t, i) => t !== timeline.tracks[i])
    if (!tracksUpdated) {
      alert(`Could not find a suitable track for ${asset.media_type} asset.`)
      return
    }

    await saveTimeline(activeProject.id, { ...timeline, tracks: updatedTracks })

    void prepareAsset(asset.id, asset.file_path)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-xs italic">
          Loading assets...
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
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
                  e.stopPropagation()
                  handleDeleteAsset(asset.id)
                }}
                onRename={(e) => {
                  e.stopPropagation()
                  handleRenameAsset(asset)
                }}
                onAddToTimeline={(e) => {
                  e.stopPropagation()
                  handleAddToTimeline(asset)
                }}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
