import type { Message } from '@/components/MessageList';
import { QuantumService } from '@/lib/quantumService';
import { supabase } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

export function useChatMessages(userId: string, selectedContact: any) {
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        if (!selectedContact) {
            setMessages([]);
            return;
        }

        const fetchMessageHistory = async () => {
            try {
                const privateKey = localStorage.getItem(`pqc_private_key_${userId}`);
                if (!privateKey) return;

                const { data: allMessages, error } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`and(sender_id.eq.${userId},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${userId})`)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                const decryptedMessages: Message[] = [];
                for (const msg of allMessages || []) {
                    try {
                        const decryptedText = await QuantumService.decryptMessage(msg, privateKey, userId);
                        decryptedMessages.push({
                            id: msg.id,
                            senderId: msg.sender_id,
                            senderEmail: msg.sender_id === userId ? 'You' : selectedContact.username,
                            text: decryptedText,
                            timestamp: new Date(msg.created_at),
                        });
                    } catch (err) {
                        console.error("Failed to decrypt message:", err);
                    }
                }
                setMessages(decryptedMessages);
            } catch (err) {
                console.error("History fetch error:", err);
            }
        };

        fetchMessageHistory();
    }, [selectedContact, userId]);

    useEffect(() => {
        if (!selectedContact) return;

        const channel = supabase
            .channel(`chat_${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
                if (
                    (payload.new.receiver_id === userId && payload.new.sender_id === selectedContact.id) ||
                    (payload.new.sender_id === userId && payload.new.receiver_id === selectedContact.id)
                ) {
                    const privateKey = localStorage.getItem(`pqc_private_key_${userId}`);
                    if (!privateKey) return;

                    try {
                        const decryptedText = await QuantumService.decryptMessage(payload.new, privateKey, userId);
                        setMessages((prev) => {
                            if (prev.some(m => m.id === payload.new.id)) return prev;
                            return [...prev, {
                                id: payload.new.id,
                                senderId: payload.new.sender_id,
                                senderEmail: payload.new.sender_id === userId ? 'You' : selectedContact.username,
                                text: decryptedText,
                                timestamp: new Date(payload.new.created_at),
                            }];
                        });
                    } catch (err) {
                        console.error("Realtime decryption failed:", err);
                    }
                }
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, selectedContact]);

    return messages;
}