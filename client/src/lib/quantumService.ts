import { Buffer } from 'buffer';
import { supabase } from '../utils/supabase/client';
import {
    decapsulateSecret, decryptMessage, decryptQKDKey,
    deriveMessageKey, encapsulateSecret,
    encryptFileLocal,
    encryptMessage, encryptQKDKeyWithPublicKey
} from './crypto';

const sessionCache = new Map<string, any>();

export const QuantumService = {
    async sendSecureMessage(senderId: string, receiverId: string, text: string) {
        const sessionId = [senderId, receiverId].sort().join('_');
        let session = sessionCache.get(sessionId);

        if (!session) {
            const [{ data: receiverProfile }, { data: senderProfile }] = await Promise.all([
                supabase.from('profiles').select('pqc_public_key').eq('id', receiverId).single(),
                supabase.from('profiles').select('pqc_public_key').eq('id', senderId).single()
            ]);

            if (!receiverProfile?.pqc_public_key) throw new Error("Recipient has no PQC key");
            if (!senderProfile?.pqc_public_key) throw new Error("Sender has no PQC key");

            const { encapsulatedCiphertext, sharedSecret } = await encapsulateSecret(receiverProfile.pqc_public_key);

            const senderWrappedSharedSecret = await encryptQKDKeyWithPublicKey(sharedSecret, senderProfile.pqc_public_key);

            session = {
                pqcSharedSecret: sharedSecret,
                pqcKeyBundle: encapsulatedCiphertext,
                senderWrappedSecret: senderWrappedSharedSecret,
                receiverPublicKey: receiverProfile.pqc_public_key,
                senderPublicKey: senderProfile.pqc_public_key,
                qkdMasterKeyB64: null,
                encryptedQkdKey: null,
                senderEncryptedQkdKey: null
            };
            sessionCache.set(sessionId, session);
        }

        const { iv, ciphertext } = await encryptMessage(text, session.pqcSharedSecret);

        const response = await fetch('http://localhost:8000/quantum/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: senderId,
                receiver_id: receiverId,
                ciphertext: ciphertext,
                message_type: 'text'
            }),
        });

        if (!response.ok) throw new Error("Gateway failed to seal QKD layer");
        const sealedData = await response.json();

        if (session.qkdMasterKeyB64 !== sealedData.master_qkd_key_b64) {
            console.log("Wrapping new QKD Key from Gateway...");
            const qkdKeyBytes = new Uint8Array(Buffer.from(sealedData.master_qkd_key_b64, 'base64'));

            session.encryptedQkdKey = await encryptQKDKeyWithPublicKey(qkdKeyBytes, session.receiverPublicKey);
            session.senderEncryptedQkdKey = await encryptQKDKeyWithPublicKey(qkdKeyBytes, session.senderPublicKey);
            session.qkdMasterKeyB64 = sealedData.master_qkd_key_b64;
        }

        const payload = {
            sender_id: senderId,
            receiver_id: receiverId,
            pqc_key_bundle: session.pqcKeyBundle,
            sender_plaintext_pqc_bundle: session.senderWrappedSecret,
            aes_iv: iv,
            content: sealedData.content,
            message_type: 'text',
            encrypted_qkd_key: session.encryptedQkdKey,
            sender_encrypted_qkd_key: session.senderEncryptedQkdKey,
            qkd_key_id: sealedData.session_id
        };

        const { data, error } = await supabase.from("messages").insert(payload).select().single();
        if (error) throw error;

        return data;
    },

    async sendSecureMedia(senderId: string, receiverId: string, file: File) {
        const { encryptedBlob, mediaKeyBase64, ivBase64 } = await encryptFileLocal(file);

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.enc`;
        const filePath = `${senderId}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('secure_media')
            .upload(filePath, encryptedBlob);

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
            .from('secure_media')
            .getPublicUrl(filePath);

        const mediaPointer = JSON.stringify({
            isMedia: true,
            fileName: file.name,
            mimeType: file.type,
            url: publicUrlData.publicUrl,
            mediaKey: mediaKeyBase64,
            iv: ivBase64
        });

        return await this.sendSecureMessage(senderId, receiverId, mediaPointer);
    },

    async decryptMessage(message: any, privateKeyBase64: string, currentUserId?: string) {
        try {
            let encryptedQkdKey = message.encrypted_qkd_key;
            if (currentUserId && message.sender_id === currentUserId && message.sender_encrypted_qkd_key) {
                encryptedQkdKey = message.sender_encrypted_qkd_key;
            }
            if (!encryptedQkdKey) throw new Error("Message missing encrypted QKD key");

            const qkdMasterKeyBytes = await decryptQKDKey(encryptedQkdKey, privateKeyBase64);

            const rawData = new Uint8Array(Buffer.from(message.content, 'base64'));
            const salt = rawData.slice(0, 16);
            const qkdIv = rawData.slice(16, 28);
            const doubleEncrypted = rawData.slice(28);

            const derivedMessageKey = await deriveMessageKey(qkdMasterKeyBytes, salt);

            const decryptedOuterBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: qkdIv },
                derivedMessageKey,
                doubleEncrypted
            );
            const pqcBlob = Buffer.from(decryptedOuterBuffer).toString('utf-8');

            let sharedSecret: Uint8Array;

            if (currentUserId && message.sender_id === currentUserId) {
                if (!message.sender_plaintext_pqc_bundle) throw new Error("Missing sender bundle (Old message format)");

                sharedSecret = await decryptQKDKey(message.sender_plaintext_pqc_bundle, privateKeyBase64);
            } else {
                if (!message.pqc_key_bundle) throw new Error("Missing receiver bundle");

                sharedSecret = await decapsulateSecret(message.pqc_key_bundle, privateKeyBase64);
            }

            return await decryptMessage(
                pqcBlob,
                message.aes_iv,
                sharedSecret
            );
        } catch (err) {
            console.error(`Message ${message.id} decryption failed:`, err);
            throw err;
        }
    }
};