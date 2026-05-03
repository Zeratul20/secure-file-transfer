import type { Conversation, Profile } from '@/lib/supabaseClient';
import { createContext, ReactNode, useState } from 'react';

interface ChatContextType {
    activeConversationId: string | null;
    activeConversationType: '1-1' | 'group' | null;
    currentUser: Profile | null;
    conversations: Conversation[];
    setActiveConversation: (id: string, type: '1-1' | 'group') => void;
    setCurrentUser: (user: Profile | null) => void;
    setConversations: (conversations: Conversation[]) => void;
    addConversation: (conversation: Conversation) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [activeConversationType, setActiveConversationType] = useState<'1-1' | 'group' | null>(null);
    const [currentUser, setCurrentUserState] = useState<Profile | null>(null);
    const [conversations, setConversationsState] = useState<Conversation[]>([]);

    const setActiveConversation = (id: string, type: '1-1' | 'group') => {
        setActiveConversationId(id);
        setActiveConversationType(type);
    };

    const setCurrentUser = (user: Profile | null) => {
        setCurrentUserState(user);
    };

    const setConversations = (convs: Conversation[]) => {
        setConversationsState(convs);
    };

    const addConversation = (conversation: Conversation) => {
        setConversationsState((prev) => {
            const exists = prev.some((c) => c.id === conversation.id);
            if (exists) {
                return prev.map((c) => (c.id === conversation.id ? conversation : c));
            }
            return [conversation, ...prev];
        });
    };

    return (
        <ChatContext.Provider
            value={{
                activeConversationId,
                activeConversationType,
                currentUser,
                conversations,
                setActiveConversation,
                setCurrentUser,
                setConversations,
                addConversation,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}