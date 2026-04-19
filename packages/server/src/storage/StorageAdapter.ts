import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

/** Abstract storage interface — swap in DB adapter if needed */
export interface StorageAdapter {
  read<T>(collection: string, id: string): Promise<T | null>;
  write<T>(collection: string, id: string, data: T): Promise<void>;
  list(collection: string): Promise<string[]>;
  delete(collection: string, id: string): Promise<boolean>;
  append<T>(collection: string, id: string, item: T): Promise<void>;
  readAll<T>(collection: string, id: string): Promise<T[]>;
}

/** File-based JSON storage implementation */
export class FileStorage implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string = env.dataDir) {
    this.baseDir = baseDir;
    this.ensureDir(baseDir);
  }

  private collectionPath(collection: string, id: string): string {
    return path.join(this.baseDir, collection, `${id}.json`);
  }

  private collectionDir(collection: string): string {
    return path.join(this.baseDir, collection);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async read<T>(collection: string, id: string): Promise<T | null> {
    const filePath = this.collectionPath(collection, id);
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async write<T>(collection: string, id: string, data: T): Promise<void> {
    const dir = this.collectionDir(collection);
    this.ensureDir(dir);
    const filePath = this.collectionPath(collection, id);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async list(collection: string): Promise<string[]> {
    const dir = this.collectionDir(collection);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const filePath = this.collectionPath(collection, id);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }

  /** Append item to a JSON array file */
  async append<T>(collection: string, id: string, item: T): Promise<void> {
    const existing = await this.readAll<T>(collection, id);
    existing.push(item);
    // Keep only last 10,000 items to prevent unbounded growth
    const trimmed = existing.slice(-10000);
    await this.write(collection, id, trimmed);
  }

  /** Read all items from a JSON array file */
  async readAll<T>(collection: string, id: string): Promise<T[]> {
    const data = await this.read<T[]>(collection, id);
    return data ?? [];
  }
}

// Singleton
export const storage = new FileStorage();
