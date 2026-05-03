import SecureMediaRenderer from '@/components/SecureMediaRenderer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { QuantumService } from '@/lib/quantumService';
import { supabase } from '@/utils/supabase/client';
import { File, LogOut, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Message = {
    id: string;
    senderId: string;
    senderEmail: string;
    text: string;
    timestamp: Date;
};

interface ChatLayoutProps {
    user: any;
}

export default function ChatLayout({ user }: ChatLayoutProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isEncrypting, setIsEncrypting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<any>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initializeUser = async () => {
            try {
                const { data: currentUserProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, username, display_name, pqc_public_key')
                    .eq('id', user.id)
                    .single();

                if (profileError) console.error("Error fetching user profile:", profileError);
                else setUserProfile(currentUserProfile);

                const storedPrivateKey = localStorage.getItem(`pqc_private_key_${user.id}`);

                if (!currentUserProfile?.pqc_public_key || !storedPrivateKey) {
                    alert("Error: Your Quantum Keys are missing or are corrupted!");
                    return;
                }

                const { data: allProfiles } = await supabase
                    .from('profiles')
                    .select('id, username, display_name, pqc_public_key')
                    .neq('id', user.id);

                setContacts(allProfiles || []);
                if (allProfiles && allProfiles.length > 0) {
                    setSelectedContact(allProfiles[0]);
                }
            } catch (err) {
                console.error("Initialization error:", err);
            } finally {
                setLoading(false);
            }
        };

        initializeUser();
    }, [user.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    useEffect(() => {
        if (!selectedContact) return;

        const fetchMessageHistory = async () => {
            try {
                const privateKey = localStorage.getItem(`pqc_private_key_${user.id}`);
                if (!privateKey) return;

                const { data: allMessages, error } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${user.id})`)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                const decryptedMessages: Message[] = [];

                for (const msg of allMessages || []) {
                    try {
                        const decryptedText = await QuantumService.decryptMessage(msg, privateKey, user.id);

                        decryptedMessages.push({
                            id: msg.id,
                            senderId: msg.sender_id,
                            senderEmail: msg.sender_id === user.id ? user.email : selectedContact.username,
                            text: decryptedText,
                            timestamp: new Date(msg.created_at),
                        });
                    } catch (err) {
                        console.error("Failed to decrypt message in history:", err);
                    }
                }

                setMessages(decryptedMessages);
            } catch (err) {
                console.error("Error in fetchMessageHistory:", err);
            }
        };

        fetchMessageHistory();
    }, [selectedContact, user.id, user.email]);

    useEffect(() => {
        const channel = supabase
            .channel(`chat_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                async (payload) => {
                    if (
                        (payload.new.receiver_id === user.id && payload.new.sender_id === selectedContact?.id) ||
                        (payload.new.sender_id === user.id && payload.new.receiver_id === selectedContact?.id)
                    ) {
                        const privateKey = localStorage.getItem(`pqc_private_key_${user.id}`);
                        if (!privateKey) return;

                        try {
                            const decryptedText = await QuantumService.decryptMessage(payload.new, privateKey, user.id);

                            setMessages((prev) => {
                                if (prev.some(m => m.id === payload.new.id)) return prev;

                                return [...prev, {
                                    id: payload.new.id,
                                    senderId: payload.new.sender_id,
                                    senderEmail: payload.new.sender_id === user.id ? user.email : selectedContact?.username || 'Unknown',
                                    text: decryptedText,
                                    timestamp: new Date(payload.new.created_at),
                                }];
                            });
                        } catch (err) {
                            console.error("Realtime decryption failed:", err);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user.id, selectedContact]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!inputText.trim() && !selectedFile) || !selectedContact) return;

        setIsEncrypting(true);
        const originalText = inputText;
        const fileToSend = selectedFile;

        try {
            if (fileToSend) {
                await QuantumService.sendSecureMedia(user.id, selectedContact.id, fileToSend);
                setSelectedFile(null);
            } else {
                await QuantumService.sendSecureMessage(user.id, selectedContact.id, originalText);
            }

            setInputText('');
        } catch (err) {
            console.error("Send error:", err);
            alert("Failed to send message/media.");
        } finally {
            setIsEncrypting(false);
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem(`pqc_private_key_${user.id}`);
        await supabase.auth.signOut();
        window.location.reload();
    };

    if (loading) {
        return <div className="flex h-screen justify-center items-center text-slate-400">Initializing Quantum Environment...</div>;
    }

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 justify-center items-center">
            <Card className="w-full max-w-5xl h-[85vh] flex shadow-2xl overflow-hidden border-0 bg-gradient-to-b from-white to-slate-50">
                <div className="w-1/3 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 flex flex-col hidden md:flex">
                    <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <h2 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    Contacts
                                </h2>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 hover:bg-slate-200 rounded-full transition-all duration-200 hover:shadow-md"
                                title="Logout"
                            >
                                <LogOut size={18} className="text-slate-600" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-500">
                            Logged in as: <br />
                            <strong className="text-slate-700">{userProfile?.display_name || userProfile?.username || user.email}</strong>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 p-3">
                        {contacts.map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => {
                                    setSelectedContact(contact);
                                    setMessages([]);
                                }}
                                className={`p-3 flex items-center gap-3 cursor-pointer rounded-lg transition-all duration-300 ${selectedContact?.id === contact.id
                                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                                    : 'hover:bg-white text-slate-800 hover:shadow-md'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${selectedContact?.id === contact.id
                                    ? 'bg-white text-blue-600'
                                    : 'bg-gradient-to-br from-blue-400 to-purple-400 text-white'
                                    }`}>
                                    {(contact.display_name || contact.username)?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">{contact.display_name || contact.username}</p>
                                    {/* <p className={`text-xs ${selectedContact?.id === contact.id ? 'text-blue-100' : 'text-slate-500'}`}>
                                        Online
                                    </p> */}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-white">
                    <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-white via-blue-50 to-white flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                                <ShieldCheck size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">
                                    {selectedContact?.display_name || selectedContact?.username || 'Select a contact'}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                    <ShieldCheck size={16} />
                                    Quantum Encrypted
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-50 to-white space-y-4"
                    >
                        {messages.length === 0 && (
                            <div className="flex h-full items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full mx-auto mb-3 flex items-center justify-center">
                                        <ShieldCheck size={32} className="text-slate-400" />
                                    </div>
                                    <p className="text-slate-400 font-medium">
                                        {selectedContact
                                            ? 'No messages yet. Start the conversation!'
                                            : 'Select a contact to begin'}
                                    </p>
                                </div>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex mb-4 ${msg.senderId === user.id ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                            >
                                <div
                                    className={`max-w-md px-4 py-3 rounded-2xl transition-all duration-300 ${msg.senderId === user.id
                                        ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg'
                                        : 'bg-white text-slate-800 border border-slate-200 shadow-md'
                                        }`}
                                >
                                    {msg.text.includes('"isMedia":true') ? (
                                        <SecureMediaRenderer messageText={msg.text} />
                                    ) : (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    )}

                                    <p
                                        className={`text-xs mt-2 font-medium ${msg.senderId === user.id
                                            ? 'text-blue-100 text-right'
                                            : 'text-slate-400 text-left'
                                            }`}
                                    >
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-5 border-t border-slate-200 bg-gradient-to-r from-white to-slate-50 shadow-lg">
                        {selectedContact ? (
                            <form
                                onSubmit={handleSendMessage}
                                className="flex items-center gap-3"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                />

                                <Button
                                    type="button"
                                    variant="outline"
                                    className={`rounded-full w-12 h-12 p-0 ${selectedFile ? 'border-blue-500 bg-blue-50 text-blue-600' : 'text-slate-500'}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isEncrypting}
                                >
                                    <File size={18} />
                                </Button>

                                <div className="flex-1 relative flex flex-col">
                                    {selectedFile && (
                                        <div className="text-xs text-blue-600 font-semibold mb-1 truncate px-2">
                                            Attached: {selectedFile.name}
                                            <button type="button" className="ml-2 text-red-500 hover:text-red-700" onClick={() => setSelectedFile(null)}>✕</button>
                                        </div>
                                    )}
                                    <Input
                                        type="text"
                                        placeholder={selectedFile ? "Add a caption..." : "Type a secure message..."}
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        disabled={isEncrypting || !!selectedFile} // Disable text if sending file to keep it simple for now
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300 placeholder-slate-400"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isEncrypting || (!inputText.trim() && !selectedFile)}
                                    className="gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full px-6 py-3 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={18} />
                                    {isEncrypting ? 'Encrypting...' : 'Send'}
                                </Button>
                            </form>
                        ) : (
                            <div className="text-center text-slate-400 py-4">
                                Select a contact to start chatting
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}