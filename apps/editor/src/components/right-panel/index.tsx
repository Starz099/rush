import { useState } from 'react';
import PropertiesTab from './PropertiesTab';
import AgentTab from './AgentTab';

export const RightPanel = ({ projectId }: { projectId: string }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'agent'>('agent');

  return (
    <div className="flex h-full flex-col">
      {/* Sidebar Tabs */}
      <div className="flex h-10 shrink-0 border-b border-white/5 bg-[#111]">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
            activeTab === 'properties'
              ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
              : 'text-white/40 hover:text-white/80'
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab('agent')}
          className={`flex-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
            activeTab === 'agent'
              ? 'border-primary text-primary border-b-2 bg-white/[0.02]'
              : 'text-white/40 hover:text-white/80'
          }`}
        >
          Agent
        </button>
      </div>

      {activeTab === 'properties' ? (
        <PropertiesTab />
      ) : (
        <AgentTab projectId={projectId} />
      )}
    </div>
  );
};
