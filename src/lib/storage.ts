// Archiviazione dei media: file cifrati (AES-256-GCM) su disco locale.
// I file non hanno URL pubblico: si leggono solo tramite /api/media/[id], che verifica i permessi
// e registra l'accesso. Per ambienti senza disco persistente (es. Vercel) va aggiunto un driver
// S3 compatibile che implementi la stessa interfaccia (vedi docs/DEPLOY.md).
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageDriver {
  put(data: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

function encryptionKey(): Buffer {
  const raw = process.env.MEDIA_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("MEDIA_ENCRYPTION_KEY mancante o non valida: servono 32 byte in base64.");
  return key;
}

const baseDir = () => path.resolve(process.env.MEDIA_DIR ?? "./storage");
const safePath = (key: string) => {
  if (!/^[a-f0-9-]{36}\.bin$/.test(key)) throw new Error("Chiave di archiviazione non valida.");
  return path.join(baseDir(), key);
};

export const localEncryptedStorage: StorageDriver = {
  async put(data) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const key = `${randomUUID()}.bin`;
    await mkdir(baseDir(), { recursive: true });
    await writeFile(safePath(key), Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
    return key;
  },
  async get(key) {
    const file = await readFile(safePath(key));
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), file.subarray(0, 12));
    decipher.setAuthTag(file.subarray(12, 28));
    return Buffer.concat([decipher.update(file.subarray(28)), decipher.final()]);
  },
  async remove(key) {
    await unlink(safePath(key)).catch(() => undefined);
  },
};

export const storage: StorageDriver = localEncryptedStorage;

export const ALLOWED_MEDIA: Record<string, "VIDEO" | "FOTO"> = {
  "video/mp4": "VIDEO",
  "video/quicktime": "VIDEO",
  "video/webm": "VIDEO",
  "image/jpeg": "FOTO",
  "image/png": "FOTO",
  "image/webp": "FOTO",
};

export const maxMediaBytes = () => Number(process.env.MEDIA_MAX_MB ?? 200) * 1024 * 1024;
