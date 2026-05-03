import base64
import secrets
import hashlib
from typing import Tuple, Optional
from dataclasses import dataclass
from enum import Enum

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class MediaType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    FILE = "file"

@dataclass
class MediaMetadata:
    content_type: str
    filename: str
    size: int
    media_type: MediaType
    duration: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    thumbnail_b64: Optional[str] = None

class QuantumMediaEncryptor:
    CHUNK_SIZE = 64 * 1024
    
    async def encrypt_media_with_qkd(
        self, 
        file_data: bytes, 
        derived_media_key: bytes,
        media_type: MediaType,
        metadata: MediaMetadata
    ) -> Tuple[str, str]:
        try:
            iv = secrets.token_bytes(12)
            aesgcm = AESGCM(derived_media_key)
            
            ciphertext = aesgcm.encrypt(iv, file_data, None)
            packaged = base64.b64encode(iv + ciphertext).decode('utf-8')
            hmac_tag = base64.b64encode(
                hashlib.sha256(iv + ciphertext).digest()
            ).decode('utf-8')
            
            print(f"Encrypted {media_type.value} '{metadata.filename}' ({len(file_data)} bytes)")
            return packaged, hmac_tag
            
        except Exception as e:
            print(f"Media encryption error: {e}")
            raise

    async def decrypt_media_with_qkd(
        self, 
        encrypted_data_b64: str, 
        derived_media_key: bytes,
        tag_b64: Optional[str] = None
    ) -> bytes:
        try:
            data = base64.b64decode(encrypted_data_b64)
            iv = data[:12]
            ciphertext = data[12:]
            
            aesgcm = AESGCM(derived_media_key)
            plaintext = aesgcm.decrypt(iv, ciphertext, None)
            
            print(f"Decrypted {len(plaintext)} bytes")
            return plaintext
            
        except Exception as e:
            print(f"Media decryption error: {e}")
            raise

media_encryptor = QuantumMediaEncryptor()