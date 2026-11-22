import React from 'react';
import { useMessenger } from '../contexts/MessengerContext';
import { ConversationList } from '../components/messenger/ConversationList';
import { ChatThread } from '../components/messenger/ChatThread';
import DashboardLayout from '../components/DashboardLayout';
import { MessageSquare, ShieldCheck } from 'lucide-react';

export default function MessagesPage() {
  const { activeConversationId, setActiveConversationId } = useMessenger();

  return (
    <DashboardLayout title="Messenger">
      <div className="flex w-full h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-8rem)] min-h-[480px] md:min-h-[520px] max-h-[920px] rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Left Column: Golden Proportion 38.2% on desktop, full width single-pane on mobile */}
        <div
          className={`h-full flex-col overflow-hidden border-border bg-card md:flex md:flex-[0_0_38.2%] md:min-w-[300px] md:max-w-[420px] md:border-r ${
            activeConversationId ? 'hidden' : 'flex w-full'
          }`}
        >
          <ConversationList
            onSelectConversation={setActiveConversationId}
            selectedConversationId={activeConversationId}
          />
        </div>

        {/* Right Column: Golden Proportion 61.8% on desktop, full width single-pane on mobile */}
        <div
          className={`h-full min-w-0 flex-col overflow-hidden bg-background md:flex md:flex-[1_1_61.8%] ${
            !activeConversationId ? 'hidden' : 'flex w-full'
          }`}
        >
          {activeConversationId ? (
            <ChatThread
              conversationId={activeConversationId}
              onBack={() => setActiveConversationId(null)}
              showBackButton={true}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center select-none">
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
                <MessageSquare className="size-8" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                BMDC Real-Time Messenger
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Select a Program Group Chat or a direct conversation to start messaging trainees and colleagues.
              </p>
              <div className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                <ShieldCheck className="size-3.5 shrink-0" />
                <span>Audit-compliant &amp; role-scoped</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
