import { useState, useEffect } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AssetCell } from './AssetCell'
import { assetApi } from '@/api/asset'
import type { Asset } from '@/api/bindings'

import { useWorkspaceStore } from '@/store/workspaceStore'

interface AssetSidebarProps {
  projectId: string
}

export const AssetSidebar = ({ projectId }: AssetSidebarProps) => {
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const selectedAsset = useWorkspaceStore((state) => state.selectedAsset)
  const setSelectedAsset = useWorkspaceStore((state) => state.setSelectedAsset)

  useEffect(() => {
    let isMounted = true

    const loadAssets = async () => {
      setIsLoading(true)
      try {
        const loadedAssets = await assetApi.getAll(projectId)
        if (isMounted) {
          setAssets(loadedAssets)
        }
      } catch (error) {
        console.error('Failed to load assets:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAssets()
    return () => {
      isMounted = false
    }
  }, [projectId])

  const handleAddAsset = async () => {
    const filePath = window.prompt(
      'Enter absolute file path to an image or video:',
    )
    if (!filePath) return

    try {
      const newAsset = await assetApi.register(projectId, filePath)
      setAssets((prev) => [...prev, newAsset])
    } catch (error) {
      console.error('Failed to register asset:', error)
      alert('Error registering asset: ' + error)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await assetApi.delete(assetId)
      setAssets((prev) => prev.filter((asset) => asset.id !== assetId))
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null)
      }
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
      const updatedAsset = { ...asset, name: newName }
      setAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? updatedAsset : a)),
      )
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(updatedAsset)
      }
    } catch (error) {
      console.error('Failed to rename asset:', error)
      alert('Error renaming asset: ' + error)
    }
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
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
