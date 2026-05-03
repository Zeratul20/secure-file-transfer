import { LogOut } from 'lucide-react';

interface SidebarProps {
    userProfile: any;
    contacts: any[];
    selectedContact: any;
    onSelectContact: (contact: any) => void;
    onLogout: () => void;
}

export function Sidebar({ userProfile, contacts, selectedContact, onSelectContact, onLogout }: SidebarProps) {
    return (
        <div className="w-1/3 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 hidden md:flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Contacts
                    </h2>
                    <button
                        onClick={onLogout}
                        className="p-2 hover:bg-slate-200 rounded-full transition-all duration-200 hover:shadow-md"
                        title="Logout"
                    >
                        <LogOut size={18} className="text-slate-600" />
                    </button>
                </div>
                <div className="text-xs text-slate-500">
                    Logged in as: <br />
                    <strong className="text-slate-700">
                        {userProfile?.display_name || userProfile?.username || 'Loading...'}
                    </strong>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 p-3">
                {contacts.map((contact) => (
                    <div
                        key={contact.id}
                        onClick={() => onSelectContact(contact)}
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
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}