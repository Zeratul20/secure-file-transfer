import localforage from 'localforage';

let unlockedPrivateKey: string | null = null;

const keyStore = localforage.createInstance({
    name: "QuantumSafeVault",
    storeName: "user_pqc_keys"
});

const ITERATIONS = 600000;

async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: ITERATIONS,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function saveAndLockPrivateKey(userId: string, password: string, privateKeyStr: string): Promise<void> {
    const enc = new TextEncoder();
    const privateKeyBytes = enc.encode(privateKeyStr);

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const aesKey = await deriveKeyFromPassword(password, salt);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        privateKeyBytes
    );

    await keyStore.setItem(`vault_${userId}`, {
        salt: Array.from(salt),
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(ciphertextBuffer))
    });

    unlockedPrivateKey = privateKeyStr;
    console.log("Private key generated and sealed securely.");
}

export async function unlockVault(userId: string, password: string): Promise<string | null> {
    try {
        const storedData: any = await keyStore.getItem(`vault_${userId}`);
        if (!storedData) {
            console.warn("No private key found on this devic!");
            return null;
        }

        const salt = new Uint8Array(storedData.salt);
        const iv = new Uint8Array(storedData.iv);
        const ciphertext = new Uint8Array(storedData.ciphertext);

        const aesKey = await deriveKeyFromPassword(password, salt);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            ciphertext
        );

        const dec = new TextDecoder();
        unlockedPrivateKey = dec.decode(decryptedBuffer);

        console.log("Private key unlocked successfully.");
        return unlockedPrivateKey;
    } catch (e) {
        console.error("Failed to unlock. Incorrect password or corrupted data.");
        return null;
    }
}
export function lockVault(): void {
    unlockedPrivateKey = null;
    console.log("Memory wiped. Vault locked.");
}