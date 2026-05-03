import { Buffer } from 'buffer';
import { createMlKem1024 } from 'crystals-kyber-js';

const getPkc = async () => await createMlKem1024();

export async function generatePQCKeyPair() {
    const pkc = await getPkc();
    const [pk, sk] = await pkc.generateKeyPair();
    return {
        publicKey: Buffer.from(pk).toString('base64'),
        privateKey: Buffer.from(sk).toString('base64'),
    };
}

export async function encapsulateSecret(receiverPublicKeyBase64: string) {
    const pkc = await getPkc();
    const pk = Buffer.from(receiverPublicKeyBase64, 'base64');

    const [ct, ss] = await pkc.encap(pk);

    return {
        encapsulatedCiphertext: Buffer.from(ct).toString('base64'),
        sharedSecret: ss,
    };
}

export async function decapsulateSecret(ciphertextBase64: string, privateKeyBase64: string) {
    const pkc = await getPkc();
    const ct = Buffer.from(ciphertextBase64, 'base64');
    const sk = Buffer.from(privateKeyBase64, 'base64');

    const ss = pkc.decap(ct, sk);
    return ss;
}

export async function importAESKey(rawKeyBytes: Uint8Array): Promise<CryptoKey> {
    const keyBuffer = rawKeyBytes.buffer.slice(
        rawKeyBytes.byteOffset,
        rawKeyBytes.byteOffset + rawKeyBytes.byteLength
    );

    return await window.crypto.subtle.importKey(
        'raw',
        new Uint8Array(keyBuffer) as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptMessage(plaintext: string, sharedSecret: Uint8Array) {
    const key = await importAESKey(sharedSecret);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plaintext);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedText
    );

    return {
        iv: Buffer.from(iv).toString('base64'),
        ciphertext: Buffer.from(encryptedBuffer).toString('base64'),
    };
}

export async function decryptMessage(
    ciphertext: string | Uint8Array,
    ivBase64: string,
    sharedSecret: Uint8Array
) {
    const key = await importAESKey(sharedSecret);

    const iv = new Uint8Array(Buffer.from(ivBase64, 'base64'));

    const ciphertextBuffer = typeof ciphertext === 'string'
        ? new Uint8Array(Buffer.from(ciphertext, 'base64'))
        : new Uint8Array(ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertextBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
}

export async function encryptQKDKeyWithPublicKey(qkdKeyBytes: Uint8Array, publicKeyBase64: string): Promise<string> {
    const pkc = await getPkc();
    const pk = Buffer.from(publicKeyBase64, 'base64');

    const [ct, ss] = await pkc.encap(pk);

    const key = await importAESKey(ss);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new Uint8Array(qkdKeyBytes) as BufferSource
    );

    const combined = Buffer.concat([
        Buffer.from(ct),
        Buffer.from(iv),
        Buffer.from(encryptedBuffer)
    ]);

    return combined.toString('base64');
}

export async function decryptQKDKey(encryptedQKDKeyBase64: string, privateKeyBase64: string): Promise<Uint8Array> {

    const fullData = new Uint8Array(Buffer.from(encryptedQKDKeyBase64, 'base64'));

    const KYBER_CIPHERTEXT_SIZE = 1568;
    const IV_SIZE = 12;

    const kyberCiphertextBytes = fullData.slice(0, KYBER_CIPHERTEXT_SIZE);
    const iv = fullData.slice(KYBER_CIPHERTEXT_SIZE, KYBER_CIPHERTEXT_SIZE + IV_SIZE);
    const encryptedQKD = fullData.slice(KYBER_CIPHERTEXT_SIZE + IV_SIZE);

    const kyberCiphertextBase64 = Buffer.from(kyberCiphertextBytes).toString('base64');

    const sharedSecret = await decapsulateSecret(
        kyberCiphertextBase64,
        privateKeyBase64
    );

    const key = await importAESKey(sharedSecret);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedQKD
    );

    return new Uint8Array(decryptedBuffer);
}

export async function deriveMessageKey(masterKey: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(masterKey) as BufferSource,
        { name: "HKDF" },
        false,
        ["deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(salt) as BufferSource,
            info: new TextEncoder().encode("qkd_gateway_message_derivation")
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encryptFileLocal(file: File | Blob) {
    const arrayBuffer = await file.arrayBuffer();

    const mediaKey = window.crypto.getRandomValues(new Uint8Array(32));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const cryptoKey = await importAESKey(mediaKey);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        arrayBuffer
    );

    return {
        encryptedBlob: new Blob([ciphertextBuffer], { type: 'application/octet-stream' }),
        mediaKeyBase64: Buffer.from(mediaKey).toString('base64'),
        ivBase64: Buffer.from(iv).toString('base64')
    };
}

export async function decryptFileLocal(encryptedBlob: Blob, mediaKeyBase64: string, ivBase64: string, mimeType: string) {
    const arrayBuffer = await encryptedBlob.arrayBuffer();

    const mediaKey = new Uint8Array(Buffer.from(mediaKeyBase64, 'base64'));
    const iv = new Uint8Array(Buffer.from(ivBase64, 'base64'));

    const cryptoKey = await importAESKey(mediaKey);
    const plaintextBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        arrayBuffer
    );

    return new Blob([plaintextBuffer], { type: mimeType });
}