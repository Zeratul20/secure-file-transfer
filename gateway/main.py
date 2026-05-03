import os
import base64
import secrets
import asyncio
import json
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from dotenv import load_dotenv

from qkd_engine import BB84Simulator
from media_encryption import media_encryptor, MediaType, MediaMetadata

load_dotenv()

MAX_POOL_SIZE = 5
qkd_simulator = BB84Simulator(num_qubits=128)
key_queue: asyncio.Queue = asyncio.Queue(maxsize=MAX_POOL_SIZE)

active_qkd_sessions = {}
SESSION_EXPIRY_SECONDS = 3600 * 24

async def replenish_key_pool():
    while True:
        try:
            new_key_b64 = await asyncio.to_thread(qkd_simulator.generate_key)
            new_key_bytes = base64.b64decode(new_key_b64)
            await key_queue.put(new_key_bytes)
            print(f"Added new key. Current pool size: {key_queue.qsize()}")
        except Exception as e:
            print(f"QKD Engine Error: {e}")
            await asyncio.sleep(2)

async def get_qkd_key() -> bytes:
    if key_queue.empty():
        print("Key pool empty! Simulating key on demand")
        new_key_b64 = await asyncio.to_thread(qkd_simulator.generate_key)
        return base64.b64decode(new_key_b64)
    return await key_queue.get()

async def get_or_create_session_key(session_id: str) -> bytes:
    now = time.time()
    session = active_qkd_sessions.get(session_id)
    
    if not session or (now - session["created_at"] > SESSION_EXPIRY_SECONDS):
        print(f"new QKD Master Session for {session_id}...")
        qkd_key = await get_qkd_key()
        active_qkd_sessions[session_id] = {
            "key": qkd_key,
            "created_at": now
        }
    return active_qkd_sessions[session_id]["key"]

def derive_message_key(master_key: bytes, salt: bytes) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32, # AES-256 -> 32 bytes
        salt=salt,
        info=b"qkd_gateway_message_derivation",
    )
    return hkdf.derive(master_key)

def get_session_id(sender_id: str, receiver_id: Optional[str], group_id: Optional[str]) -> str:
    if group_id:
        return f"group_{group_id}"
    participants = sorted([sender_id, receiver_id])
    return f"dm_{participants[0]}_{participants[1]}"

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting QKD Generator...")
    pool_task = asyncio.create_task(replenish_key_pool())
    yield
    print("Shutting down QKD Generator...")
    pool_task.cancel()

app = FastAPI(title="Quantum-Safe Gateway", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

class QuantumMessageRequest(BaseModel):
    sender_id: str
    receiver_id: Optional[str] = None
    group_id: Optional[str] = None
    ciphertext: str
    message_type: str = "text"
    
@app.get("/ping")
def keep_alive():
    return {"status": "awake", "message": "Render server is alive!"}

@app.post("/quantum/send")
async def process_quantum_message(msg: QuantumMessageRequest):
    try:
        if bool(msg.receiver_id) == bool(msg.group_id):
            raise HTTPException(status_code=400, detail="Must specify receiver_id ior group_id")
        
        session_id = get_session_id(msg.sender_id, msg.receiver_id, msg.group_id)
        master_qkd_key = await get_or_create_session_key(session_id)
        
        message_salt = secrets.token_bytes(16)
        
        message_key = derive_message_key(master_qkd_key, message_salt)

        aesgcm = AESGCM(message_key)
        message_iv = secrets.token_bytes(12)
        double_encrypted = aesgcm.encrypt(message_iv, msg.ciphertext.encode('utf-8'), None)
        
        final_payload = message_salt + message_iv + double_encrypted
        final_content_b64 = base64.b64encode(final_payload).decode('utf-8')

        return {
            "status": "quantum_sealed",
            "session_id": session_id,
            "content": final_content_b64,
            "master_qkd_key_b64": base64.b64encode(master_qkd_key).decode('utf-8') 
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Gateway Encryption Failure")


@app.post("/quantum/receive")
async def receive_message(payload: dict):
    try:
        content_b64 = payload.get("content")
        master_qkd_key_b64 = payload.get("master_qkd_key")
        
        if not content_b64 or not master_qkd_key_b64:
            raise HTTPException(status_code=400, detail="Missing payload data")

        master_qkd_key = base64.b64decode(master_qkd_key_b64)
        raw_data = base64.b64decode(content_b64)
        
        message_salt = raw_data[:16]
        message_iv = raw_data[16:28]
        ciphertext = raw_data[28:]

        message_key = derive_message_key(master_qkd_key, message_salt)
        aesgcm = AESGCM(message_key)
        
        pqc_blob = aesgcm.decrypt(message_iv, ciphertext, None).decode('utf-8')
        
        return {"status": "qkd_unsealed", "pqc_blob": pqc_blob}
    
    except Exception as e:
        print(f"Unseal Error: {e}")
        raise HTTPException(status_code=500, detail="QKD Unsealing Failed")

class MediaDecryptionHKDFRequest(BaseModel):
    encrypted_data_b64: str
    master_qkd_key_b64: str
    media_salt_b64: str
    tag_b64: Optional[str] = None
    media_type: str = "file"

@app.post("/media/encrypt")
async def encrypt_media(
    file: UploadFile = File(...), 
    metadata_json: str = Form(None)
):
    try:
        metadata_dict = json.loads(metadata_json) if metadata_json else {}
        
        sender_id = metadata_dict.get("sender_id")
        receiver_id = metadata_dict.get("receiver_id")
        group_id = metadata_dict.get("group_id")
        media_type = metadata_dict.get("media_type", "file")
        
        if not sender_id:
            raise HTTPException(status_code=400, detail="sender_id is required")
        if not receiver_id and not group_id:
            raise HTTPException(status_code=400, detail="receiver_id or group_id is required")

        file_data = await file.read()
        
        session_id = get_session_id(sender_id, receiver_id, group_id)
        master_qkd_key = await get_or_create_session_key(session_id)
        
        media_salt = secrets.token_bytes(16)
        media_key = derive_message_key(master_qkd_key, media_salt)
        
        media_metadata = MediaMetadata(
            content_type=file.content_type or "application/octet-stream",
            filename=file.filename,
            size=len(file_data),
            media_type=MediaType(media_type),
            duration=metadata_dict.get("duration"),
            width=metadata_dict.get("width"),
            height=metadata_dict.get("height"),
            thumbnail_b64=metadata_dict.get("thumbnail_b64"),
        )
        
        encrypted_data_b64, tag_b64 = await media_encryptor.encrypt_media_with_qkd(
            file_data, media_key, MediaType(media_type), media_metadata
        )

        print(f"File '{file.filename}' encrypted")
        return {
            "status": "media_encrypted",
            "session_id": session_id,
            "filename": file.filename,
            "size": len(file_data),
            "media_type": media_type,
            "content": encrypted_data_b64,
            "authentication_tag": tag_b64,
            "media_salt_b64": base64.b64encode(media_salt).decode('utf-8'),
            "master_qkd_key_b64": base64.b64encode(master_qkd_key).decode('utf-8') 
        }
    except Exception as e:
        print(f"Media encryption error: {e}")
        raise HTTPException(status_code=500, detail="Media encryption failed")

@app.post("/media/decrypt")
async def decrypt_media(request: MediaDecryptionHKDFRequest):
    try:
        master_qkd_key = base64.b64decode(request.master_qkd_key_b64)
        media_salt = base64.b64decode(request.media_salt_b64)

        media_key = derive_message_key(master_qkd_key, media_salt)

        decrypted_data = await media_encryptor.decrypt_media_with_qkd(
            request.encrypted_data_b64,
            media_key,
            request.tag_b64
        )
        
        decrypted_b64 = base64.b64encode(decrypted_data).decode('utf-8')
        
        print(f"File decrypted ({len(decrypted_data)} bytes)")
        return {
            "status": "media_decrypted",
            "data": decrypted_b64,
            "size": len(decrypted_data),
        }
    except Exception as e:
        print(f" Media decryption error: {e}")
        raise HTTPException(status_code=500, detail="Media decryption failed")
    
@app.get("/quantum/status")
async def get_quantum_status():
    now = time.time()
    expired_sessions = [sid for sid, data in active_qkd_sessions.items() if now - data["created_at"] > SESSION_EXPIRY_SECONDS]
    for sid in expired_sessions:
        del active_qkd_sessions[sid]

    return {
        "system": "Quantum-Safe Gateway",
        "status": "online",
        "qkd_pool_size": key_queue.qsize(),
        "max_pool_size": MAX_POOL_SIZE,
        "active_qkd_sessions": len(active_qkd_sessions),
        "quantcrypt_enabled": getattr(media_encryptor, "quantcrypt_enabled", False),
        "encryption_algorithms": [
            "AES-256-GCM (Message Derived)", 
            "HKDF-SHA256 (Session Derivation)",
            "Post-Quantum Kyber-1024"
        ],
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)