import { Button } from '@/components/ui/button';
import { decryptFileLocal } from '@/lib/crypto';
import { AlertCircle, Download, File as FileIcon, Loader2, Music } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SecureMediaRendererProps {
    messageText: string;
}

export default function SecureMediaRenderer({ messageText }: SecureMediaRendererProps) {
    const [mediaObjectUrl, setMediaObjectUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mediaInfo, setMediaInfo] = useState<any>(null);

    useEffect(() => {
        let objectUrl: string | null = null;

        const processMedia = async () => {
            try {
                const pointer = JSON.parse(messageText);
                if (!pointer.isMedia) throw new Error("Not a media pointer");

                setMediaInfo(pointer);

                const response = await fetch(pointer.url);
                if (!response.ok) throw new Error("Failed to download encrypted file");
                const encryptedBlob = await response.blob();

                const decryptedBlob = await decryptFileLocal(
                    encryptedBlob,
                    pointer.mediaKey,
                    pointer.iv,
                    pointer.mimeType
                );

                objectUrl = URL.createObjectURL(decryptedBlob);
                setMediaObjectUrl(objectUrl);
            } catch (err) {
                console.error("Media rendering failed:", err);
                setError("Failed to load secure media");
            } finally {
                setLoading(false);
            }
        };

        processMedia();

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [messageText]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg text-slate-500 animate-pulse">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-medium">Decrypting media...</span>
            </div>
        );
    }

    if (error || !mediaInfo) {
        return (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-500 border border-red-100">
                <AlertCircle size={18} />
                <span className="text-sm font-medium">{error || "Invalid media"}</span>
            </div>
        );
    }

    const { mimeType, fileName } = mediaInfo;

    if (mimeType.startsWith('image/')) {
        return (
            <div className="mt-2 relative group rounded-lg overflow-hidden border border-slate-200">
                <img
                    src={mediaObjectUrl!}
                    alt={fileName}
                    className="max-w-full max-h-64 object-contain rounded-lg"
                    loading="lazy"
                />
            </div>
        );
    }

    if (mimeType.startsWith('video/')) {
        return (
            <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-black">
                <video
                    controls
                    src={mediaObjectUrl!}
                    className="max-w-full max-h-64 rounded-lg"
                />
            </div>
        );
    }

    if (mimeType.startsWith('audio/')) {
        return (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                    <Music size={20} />
                </div>
                <audio controls src={mediaObjectUrl!} className="h-10 w-48" />
            </div>
        );
    }

    return (
        <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                    <FileIcon size={20} />
                </div>
                <div className="truncate">
                    <p className="text-sm font-bold text-slate-700 truncate">{fileName}</p>
                    <p className="text-xs text-slate-500 uppercase">{mimeType.split('/')[1] || 'FILE'}</p>
                </div>
            </div>
            <a href={mediaObjectUrl!} download={fileName}>
                <Button size="sm" variant="outline" className="shrink-0 gap-2 hover:bg-blue-50 hover:text-blue-600">
                    <Download size={14} />
                    Save
                </Button>
            </a>
        </div>
    );
}