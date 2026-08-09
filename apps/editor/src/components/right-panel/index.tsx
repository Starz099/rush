import { useState } from 'react';
import PropertiesTab from './PropertiesTab';
import AgentTab from './AgentTab';
import { SidebarIcon } from '@phosphor-icons/react';

export const RightPanel = ({
  projectId,
  onCollapse,
}: {
  projectId: string;
  onCollapse?: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'agent'>('agent');

  return (
    <div className="flex h-full flex-col">
      {/* Sidebar Tabs */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 bg-[#111] px-2">
        <div className="flex h-full gap-2">
          <button
            onClick={() => setActiveTab('properties')}
            className={`px-4 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
              activeTab === 'properties'
                ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            Properties
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-4 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
              activeTab === 'agent'
                ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            Agent
          </button>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="cursor-pointer rounded p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            title="Collapse Right Panel"
          >
            <SidebarIcon size={15} weight="bold" />
          </button>
        )}
      </div>

      {activeTab === 'properties' ? (
        <PropertiesTab />
      ) : (
        <AgentTab projectId={projectId} />
      )}
    </div>
  );
};
