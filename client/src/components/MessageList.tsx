import SecureMediaRenderer from '@/components/SecureMediaRenderer';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';

export type Message = {
    id: string;
    senderId: string;
    senderEmail: string;
    text: string;
    timestamp: Date;
};

interface MessageListProps {
    messages: Message[];
    userId: string;
    selectedContact: any;
}

export function MessageList({ messages, userId, selectedContact }: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-50 to-white space-y-4">
            {messages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full mx-auto mb-3 flex items-center justify-center">
                            <ShieldCheck size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-400 font-medium">
                            {selectedContact ? 'No messages yet. Start the conversation!' : 'Select a contact to begin'}
                        </p>
                    </div>
                </div>
            )}

            {messages.map((msg) => (
                <div key={msg.id} className={`flex mb-4 ${msg.senderId === userId ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                    <div className={`max-w-md px-4 py-3 rounded-2xl transition-all duration-300 ${msg.senderId === userId
                        ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-md'
                        }`}>
                        {msg.text.includes('"isMedia":true') ? (
                            <SecureMediaRenderer messageText={msg.text} />
                        ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}

                        <p className={`text-xs mt-2 font-medium ${msg.senderId === userId ? 'text-blue-100 text-right' : 'text-slate-400 text-left'
                            }`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}