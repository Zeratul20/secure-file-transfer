import { ShieldCheck } from 'lucide-react';

interface ChatHeaderProps {
    selectedContact: any;
}

export function ChatHeader({ selectedContact }: ChatHeaderProps) {
    return (
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
    );
}