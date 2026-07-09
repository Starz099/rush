import type { Session } from '@/api/bindings';
import { useProjectStore } from '@/store/projectStore';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Message, MessageContent } from '@/components/ui/message';
import { cn } from '@/lib/utils';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport,
  MessageScrollerProvider,
  MessageScrollerItem,
} from '@/components/ui/message-scroller';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { TrashIcon } from '@phosphor-icons/react';
import { listen } from '@tauri-apps/api/event';
import { AGENT_STATUS, type AgentStatus } from '@/types/agent';

const AgentTab = ({ projectId }: { projectId: string }) => {
  const sessions: Session[] = useProjectStore((state) => state.sessions);
  const fetchSessions = useProjectStore((state) => state.fetchSessions);
  const messages = useProjectStore((state) => state.messages);
  const currentSession = useProjectStore((state) => state.currentSession);
  const fetchMessages = useProjectStore((state) => state.fetchMessages);
  const setCurrentSession = useProjectStore((state) => state.setCurrentSession);
  const runAgent = useProjectStore((state) => state.runAgent);
  const deleteSession = useProjectStore((state) => state.deleteSession);

  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{
    status: AgentStatus;
    message: string;
  } | null>(null);

  useEffect(() => {
    const unlistenPromise = listen<{
      sessionId: string;
      status: AgentStatus;
      message: string;
    }>('agent_status', (event) => {
      if (currentSession && event.payload.sessionId === currentSession.id) {
        setAgentStatus({
          status: event.payload.status,
          message: event.payload.message,
        });
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentSession]);

  useEffect(() => {
    const loadSessions = async () => {
      await fetchSessions(projectId);
    };
    loadSessions();
    return () => {};
  }, [projectId, fetchSessions]);

  useEffect(() => {
    const loadMessages = async () => {
      await fetchMessages();
    };
    loadMessages();

    // Listen for real-time agent message creation events from Tauri backend
    const unlistenPromise = listen('agent_message_created', () => {
      loadMessages();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentSession, fetchMessages]);

  const handleSend = async () => {
    if (!prompt.trim() || isSending) return;
    setIsSending(true);
    try {
      const currentPrompt = prompt;
      setPrompt('');
      await runAgent(currentPrompt);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-2">
      {/* Sessions Header with New Session button */}
      <Card className="flex shrink-0 flex-col gap-2 p-2">
        <div className="flex items-center justify-between text-xs font-bold text-white/70">
          <span>Sessions:</span>
          <Button
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => setCurrentSession(null)}
          >
            New Session
          </Button>
        </div>
        <div className="custom-scrollbar flex h-[66px] flex-col gap-1 overflow-y-auto pr-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSession(session)}
              className={`flex cursor-pointer items-center justify-between rounded border-b border-white/5 p-2 transition-colors ${
                currentSession?.id === session.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5'
              }`}
            >
              <div className="mr-2 flex-1 truncate text-[10px]">
                {session.id}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="p-0.5 text-white/40 transition-colors hover:text-red-400"
              >
                <TrashIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Messages */}
      <Card className="relative min-h-0 flex-1 p-2">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport className="no-scrollbar">
              <MessageScrollerContent className="p-(--card-spacing)">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const isTool = message.role === 'tool';
                  return (
                    <MessageScrollerItem key={message.id} scrollAnchor={isUser}>
                      <Message align={isUser ? 'end' : 'start'}>
                        <MessageContent
                          className={cn(
                            'max-w-[85%] rounded-lg p-2.5 text-xs',
                            isUser
                              ? 'ml-auto items-end border border-blue-500/20 bg-blue-600/15 text-right'
                              : isTool
                                ? 'mr-auto items-start border border-yellow-500/10 bg-yellow-500/5 font-mono text-[10px] text-yellow-200/80'
                                : 'mr-auto items-start border border-white/10 bg-white/5',
                          )}
                        >
                          <div className="text-[9px] font-bold tracking-wider text-white/30 uppercase">
                            {message.role}
                          </div>
                          <div
                            className={cn(
                              'leading-relaxed wrap-break-word text-white/90',
                              isTool
                                ? 'font-mono text-[10px]'
                                : 'text-left text-xs',
                            )}
                          >
                            {message.content}
                          </div>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  );
                })}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </Card>

      {/* Agent Thinking Status logs */}
      {agentStatus && agentStatus.status !== AGENT_STATUS.Idle && (
        <div className="flex shrink-0 animate-pulse items-center gap-2 rounded border border-white/10 bg-white/5 p-2 text-[10px] text-white/70">
          <div
            className={`h-1.5 w-1.5 animate-ping rounded-full ${
              agentStatus.status === AGENT_STATUS.Error
                ? 'bg-red-400'
                : 'bg-blue-400'
            }`}
          />
          <span
            className={`font-bold uppercase ${
              agentStatus.status === AGENT_STATUS.Error
                ? 'text-red-400'
                : 'text-blue-400'
            }`}
          >
            {agentStatus.status}:
          </span>
          <span className="flex-1 truncate font-mono">
            {agentStatus.message}
          </span>
        </div>
      )}

      {/* Input box */}
      <Card className="flex shrink-0 gap-2 p-2">
        <Input
          type="text"
          className="w-full text-xs"
          placeholder={
            currentSession ? 'Ask the agent...' : 'Start a new session...'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          disabled={isSending}
        />
        <Button onClick={handleSend} disabled={isSending}>
          {isSending ? '...' : 'Go'}
        </Button>
      </Card>
    </div>
  );
};

export default AgentTab;
