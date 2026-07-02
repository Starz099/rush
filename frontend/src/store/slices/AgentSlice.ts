import type { StateCreator } from 'zustand';
import type { Session, Message } from '@/api/bindings';
import { agentApi } from '@/api/agent';

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

      const currentSession = get().currentSession;
      const sessionId = currentSession ? currentSession.id : '';

      // Optimistically append the user's message if a session already exists
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

      // Call Tauri run_agent command
      await agentApi.runAgent(activeProject.id, sessionId, prompt);

      // If starting a fresh chat session, fetch sessions and select the newest one
      if (!currentSession) {
        await get().fetchSessions(activeProject.id);
        const updatedSessions = get().sessions;
        if (updatedSessions.length > 0) {
          set({ currentSession: updatedSessions[0] });
        }
      }

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
