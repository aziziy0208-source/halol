import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { del as blobDelete, get as blobGet, put as blobPut } from "@vercel/blob";
import { serverEnv } from "@/lib/env";

/**
 * Private object storage for certificate PDFs/previews and signatory images.
 * Nothing in here is ever exposed under a public URL: files are streamed by
 * authenticated route handlers (admin) or the verification page (issued PDFs only).
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** null if the object does not exist. */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,500}$/;

export function assertValidKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

class FileSystemStorage implements ObjectStorage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertValidKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Key escapes storage root");
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

class S3Storage implements ObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    assertValidKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return result.Body ? Buffer.from(await result.Body.transformToByteArray()) : null;
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * Vercel Blob with access "private": objects have no public URL, every read needs
 * the store credentials Vercel adds when the store is connected to the project
 * (BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID + the deployment's OIDC token).
 */
class VercelBlobStorage implements ObjectStorage {
  constructor(private readonly token: string | undefined) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertValidKey(key);
    await blobPut(key, body, {
      access: "private",
      contentType,
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }

  async get(key: string): Promise<Buffer | null> {
    assertValidKey(key);
    // useCache false: always the current object (keys can be overwritten, e.g. re-rendered files).
    const result = await blobGet(key, { access: "private", token: this.token, useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await blobDelete(key, { token: this.token });
  }
}

let instance: ObjectStorage | undefined;

export function storage(): ObjectStorage {
  if (instance) return instance;
  const env = serverEnv();
  if (env.STORAGE_DRIVER === "fs") {
    instance = new FileSystemStorage(path.resolve(env.STORAGE_DIR));
  } else if (env.STORAGE_DRIVER === "vercel-blob") {
    if (!env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
      throw new Error("Vercel Blob storage needs BLOB_READ_WRITE_TOKEN (connect a Blob store to the project)");
    }
    instance = new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN);
  } else {
    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 storage needs S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
    }
    const client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true, // Garage/MinIO style: http://host:3900/<bucket>/<key>
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
    instance = new S3Storage(client, env.S3_BUCKET);
  }
  return instance;
}

/** Storage keys of an issued certificate revision. */
export function certificateFileKeys(certificateNumber: string, revision: number) {
  const base = `certificates/${certificateNumber}/rev-${revision}`;
  // webPreview: derived, smaller rendition for the public verification page.
  return { pdf: `${base}/certificate.pdf`, preview: `${base}/preview.png`, webPreview: `${base}/preview.webp` };
}
