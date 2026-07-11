import { useState } from 'react';
import { AssetsTab } from './AssetsTab';
import { ToolsTab } from './ToolsTab';

export const LeftPanel = ({ projectId }: { projectId: string }) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'tools'>('assets');

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="flex h-10 shrink-0 border-b border-white/5 bg-[#111]">
        <button
          onClick={() => setActiveTab('assets')}
          className={`flex-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
            activeTab === 'assets'
              ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
              : 'text-white/40 hover:text-white/80'
          }`}
        >
          Assets
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
            activeTab === 'tools'
              ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
              : 'text-white/40 hover:text-white/80'
          }`}
        >
          Tools
        </button>
      </div>

      {activeTab === 'assets' ? (
        <AssetsTab projectId={projectId} />
      ) : (
        <ToolsTab />
      )}
    </div>
  );
};
