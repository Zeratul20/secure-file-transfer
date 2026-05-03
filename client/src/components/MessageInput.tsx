import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { File as FileIcon, Send } from 'lucide-react';
import { useRef } from 'react';

interface MessageInputProps {
    inputText: string;
    setInputText: (text: string) => void;
    selectedFile: File | null;
    setSelectedFile: (file: File | null) => void;
    isEncrypting: boolean;
    onSendMessage: (e: React.FormEvent) => void;
}

export function MessageInput({
    inputText, setInputText, selectedFile, setSelectedFile, isEncrypting, onSendMessage
}: MessageInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="p-5 border-t border-slate-200 bg-gradient-to-r from-white to-slate-50 shadow-lg">
            <form onSubmit={onSendMessage} className="flex items-center gap-3">
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
                    <FileIcon size={18} />
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
                        disabled={isEncrypting || !!selectedFile}
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
        </div>
    );
}