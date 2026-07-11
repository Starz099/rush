import type { StateCreator } from 'zustand';
import type { Session, Message } from '@/api/bindings';
import { agentApi } from '@/api/agent';
import { projectApi } from '@/api/project';

export interface AgentSlice {
  sessions: Session[];
  messages: Message[];
  currentSession: Session | null;
  fetchSessions: (projectId: string) => Promise<void>;
  fetchMessages: () => Promise<void>;
  setCurrentSession: (session: Session | null) => void;
  runAgent: (prompt: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export const createAgentSlice: StateCreator<AgentSlice> = (set, get) => ({
  sessions: [],
  messages: [],
  currentSession: null,

  setCurrentSession: (session) => set({ currentSession: session }),

  fetchSessions: async (projectId) => {
    try {
      const sessions = await agentApi.getSessions(projectId);
      set({ sessions });
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  },

  fetchMessages: async () => {
    try {
      const currentSession = get().currentSession;

      if (currentSession == null) {
        set({ messages: [] });
        return;
      }

      const messages: Message[] = await agentApi.getMessages(currentSession.id);
      set({ messages });
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  },

  runAgent: async (prompt: string) => {
    try {
      const activeProject = (get() as any).activeProject;
      if (!activeProject) throw new Error('No active project found');

      let currentSession = get().currentSession;
      let sessionId = currentSession ? currentSession.id : '';

      // If starting a fresh chat session, create the session FIRST in the DB!
      if (!currentSession) {
        const session = await agentApi.createSession(activeProject.id);
        currentSession = session;
        set({ currentSession: session });
        sessionId = session.id;

        // Fetch sessions list so the UI shows the new session immediately
        await get().fetchSessions(activeProject.id);
      }

      // Optimistically append the user's message
      if (currentSession) {
        const optimisticUserMessage: Message = {
          id: `temp-user-${Date.now()}`,
          session_id: currentSession.id,
          role: 'user',
          content: prompt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({
          messages: [...state.messages, optimisticUserMessage],
        }));
      }

      // Retrieve LLM settings from localStorage
      const apiUrl = localStorage.getItem('rush_api_url') || null;
      const apiKey = localStorage.getItem('rush_api_key') || null;
      const model = localStorage.getItem('rush_model_id') || null;

      // Call Tauri run_agent command
      await agentApi.runAgent(
        activeProject.id,
        sessionId,
        prompt,
        apiUrl,
        apiKey,
        model,
      );

      // Fetch the updated project timeline from the database to synchronize UI state
      const updatedProject = await projectApi.getById(activeProject.id);
      (set as any)({ activeProject: updatedProject });

      // Synchronize playhead position with the timelineStore
      const { useAppStore } = await import('@/store/timelineStore');
      useAppStore
        .getState()
        .setPlayhead(updatedProject.timeline_state.playhead_position);

      // Re-fetch messages to render the actual database user and agent messages in the viewport
      await get().fetchMessages();
    } catch (err) {
      console.error('Failed to run Agent: ', err);
    }
  },

  deleteSession: async (sessionId) => {
    try {
      const activeProject = (get() as any).activeProject;
      if (!activeProject) throw new Error('No active project found');

      await agentApi.deleteSession(sessionId);

      const currentSession = get().currentSession;
      if (currentSession && currentSession.id === sessionId) {
        set({ currentSession: null, messages: [] });
      }

      await get().fetchSessions(activeProject.id);
    } catch (err) {
      console.error('Failed to delete session: ', err);
    }
  },
});
