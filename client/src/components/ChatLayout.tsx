import { Card } from '@/components/ui/card';
import { useChatMessages } from '@/hooks/useChatMessages';
import { QuantumService } from '@/lib/quantumService';
import { supabase } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { ChatHeader } from './ChatHeader';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { Sidebar } from './Sidebar';

interface ChatLayoutProps {
    user: any;
}

export default function ChatLayout({ user }: ChatLayoutProps) {
    const [inputText, setInputText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isEncrypting, setIsEncrypting] = useState(false);

    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any | null>(null);

    const messages = useChatMessages(user.id, selectedContact);

    useEffect(() => {
        const initializeUser = async () => {
            try {
                let { data: currentUserProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, username, display_name, pqc_public_key')
                    .eq('id', user.id)
                    .single();

                if (profileError) console.error("Error fetching user profile:", profileError);
                else setUserProfile(currentUserProfile);

                let storedPrivateKey = localStorage.getItem(`pqc_private_key_${user.id}`);
                if (!currentUserProfile?.pqc_public_key) {
                    let retries = 10;
                    while (retries-- > 0) {
                        const { data: refreshedProfile, error: refreshedError } = await supabase
                            .from('profiles')
                            .select('id, username, display_name, pqc_public_key')
                            .eq('id', user.id)
                            .single();

                        if (refreshedProfile?.pqc_public_key) {
                            setUserProfile(refreshedProfile);
                            currentUserProfile = { ...refreshedProfile }
                            console.log("Successfully refreshed user profile with public key.");
                            break;
                        }

                        console.log("Waiting for database trigger to create user profile...", 10 - retries);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                if (!storedPrivateKey) {
                    let retries = 10;
                    while (retries-- > 0) {
                        storedPrivateKey = localStorage.getItem(`pqc_private_key_${user.id}`);
                        if (storedPrivateKey) break;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                if (!currentUserProfile?.pqc_public_key || !storedPrivateKey) {
                    alert("Error: Quantum Keys are missing or are corrupted!");
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
                console.error("Initn error:", err);
            } finally {
                setLoading(false);
            }
        };

        initializeUser();
    }, [user.id]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!inputText.trim() && !selectedFile) || !selectedContact) return;

        setIsEncrypting(true);
        try {
            if (selectedFile) {
                await QuantumService.sendSecureMedia(user.id, selectedContact.id, selectedFile);
                setSelectedFile(null);
            } else {
                await QuantumService.sendSecureMessage(user.id, selectedContact.id, inputText);
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

    const handleSelectContact = (contact: any) => {
        setSelectedContact(contact);
    };

    if (loading) {
        return (
            <div className="flex h-screen justify-center items-center text-slate-400 bg-slate-900">
                Initializing Quantum Environment...
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 justify-center items-center">
            <Card className="w-full max-w-5xl h-[85vh] flex shadow-2xl overflow-hidden border-0 bg-gradient-to-b from-white to-slate-50">

                <Sidebar
                    userProfile={userProfile}
                    contacts={contacts}
                    selectedContact={selectedContact}
                    onSelectContact={handleSelectContact}
                    onLogout={handleLogout}
                />

                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                    <ChatHeader selectedContact={selectedContact} />

                    <MessageList
                        messages={messages}
                        userId={user.id}
                        selectedContact={selectedContact}
                    />

                    {selectedContact ? (
                        <MessageInput
                            inputText={inputText}
                            setInputText={setInputText}
                            selectedFile={selectedFile}
                            setSelectedFile={setSelectedFile}
                            isEncrypting={isEncrypting}
                            onSendMessage={handleSendMessage}
                        />
                    ) : (
                        <div className="text-center text-slate-400 py-4 border-t border-slate-200">
                            Select a contact to start chatting
                        </div>
                    )}
                </div>

            </Card>
        </div>
    );
}