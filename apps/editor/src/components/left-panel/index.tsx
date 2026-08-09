import { useState } from 'react';
import { AssetsTab } from './AssetsTab';
import { ToolsTab } from './ToolsTab';
import { SidebarIcon } from '@phosphor-icons/react';

export const LeftPanel = ({
  projectId,
  onCollapse,
}: {
  projectId: string;
  onCollapse?: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'tools'>('assets');

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 bg-[#111] px-2">
        <div className="flex h-full gap-2">
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
              activeTab === 'assets'
                ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            Assets
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-4 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
              activeTab === 'tools'
                ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            Tools
          </button>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="cursor-pointer rounded p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            title="Collapse Left Panel"
          >
            <SidebarIcon size={15} weight="bold" />
          </button>
        )}
      </div>

      {activeTab === 'assets' ? (
        <AssetsTab projectId={projectId} />
      ) : (
        <ToolsTab />
      )}
    </div>
  );
};
