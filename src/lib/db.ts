// Encrypted project storage backed by IndexedDB.
//
// Schema:
//   db: storyscope
//     store: projects { id, name, createdAt, updatedAt, verifier (EncryptedBlob), encryptedPayload (EncryptedBlob) }
//
// The payload contains the full manuscript text + chapter list + analysis results,
// all wrapped in AES-GCM encryption derived from the user passphrase.

import { openDB, type IDBPDatabase } from 'idb';
import {
  encryptJSON,
  decryptJSON,
  makeVerifier,
  checkVerifier,
  type EncryptedBlob,
} from './crypto';
import type { ProjectPayload } from './types';

const DB_NAME = 'storyscope';
const DB_VERSION = 1;
const STORE = 'projects';

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  verifier: EncryptedBlob;
  encryptedPayload: EncryptedBlob;
  // Cached metadata for the project list (NOT sensitive — chapter count and word count only)
  meta: {
    chapterCount: number;
    wordCount: number;
  };
}

let _db: IDBPDatabase | null = null;

async function db(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'id' });
      }
    },
  });
  return _db;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const d = await db();
  const records = await d.getAll(STORE);
  return (records as ProjectRecord[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  const d = await db();
  return d.get(STORE, id);
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  await d.delete(STORE, id);
}

export async function createProject(
  name: string,
  payload: ProjectPayload,
  passphrase: string
): Promise<ProjectRecord> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const record: ProjectRecord = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    verifier: await makeVerifier(passphrase),
    encryptedPayload: await encryptJSON(payload, passphrase),
    meta: {
      chapterCount: payload.chapters.length,
      wordCount: payload.chapters.reduce((s, c) => s + c.wordCount, 0),
    },
  };
  const d = await db();
  await d.put(STORE, record);
  return record;
}

export async function updateProjectPayload(
  id: string,
  payload: ProjectPayload,
  passphrase: string
): Promise<ProjectRecord> {
  const d = await db();
  const existing = (await d.get(STORE, id)) as ProjectRecord | undefined;
  if (!existing) throw new Error('Project not found');
  const valid = await checkVerifier(existing.verifier, passphrase);
  if (!valid) throw new Error('Incorrect passphrase');
  const updated: ProjectRecord = {
    ...existing,
    updatedAt: Date.now(),
    encryptedPayload: await encryptJSON(payload, passphrase),
    meta: {
      chapterCount: payload.chapters.length,
      wordCount: payload.chapters.reduce((s, c) => s + c.wordCount, 0),
    },
  };
  await d.put(STORE, updated);
  return updated;
}

export async function unlockProject(
  id: string,
  passphrase: string
): Promise<ProjectPayload> {
  const d = await db();
  const record = (await d.get(STORE, id)) as ProjectRecord | undefined;
  if (!record) throw new Error('Project not found');
  const valid = await checkVerifier(record.verifier, passphrase);
  if (!valid) throw new Error('Incorrect passphrase');
  return decryptJSON<ProjectPayload>(record.encryptedPayload, passphrase);
}
