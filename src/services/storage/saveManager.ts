import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SaveSlotData } from '@/game/core/types';

const DB_NAME = 'orbital_beyond_db';
const DB_VERSION = 1;
const STORE_SAVES = 'saves';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        db.createObjectStore(STORE_SAVES, { keyPath: 'slotId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSlotToDB(slot: SaveSlotData): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readwrite');
      tx.objectStore(STORE_SAVES).put(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage if IndexedDB is unavailable
    localStorage.setItem(`ob_save_${slot.slotId}`, JSON.stringify(slot));
  }
}

export async function loadSlotFromDB(slotId: string): Promise<SaveSlotData | null> {
  try {
    const db = await openDB();
    return await new Promise<SaveSlotData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readonly');
      const req = tx.objectStore(STORE_SAVES).get(slotId);
      req.onsuccess = () => resolve((req.result as SaveSlotData) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem(`ob_save_${slotId}`);
    return raw ? (JSON.parse(raw) as SaveSlotData) : null;
  }
}

export async function listAllSaveSlots(): Promise<SaveSlotData[]> {
  try {
    const db = await openDB();
    return await new Promise<SaveSlotData[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readonly');
      const req = tx.objectStore(STORE_SAVES).getAll();
      req.onsuccess = () => {
        const list = (req.result as SaveSlotData[]) ?? [];
        resolve(list.sort((a, b) => b.updatedAt - a.updatedAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const result: SaveSlotData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ob_save_')) {
        const raw = localStorage.getItem(key);
        if (raw) result.push(JSON.parse(raw));
      }
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export async function deleteSaveSlotFromDB(slotId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SAVES, 'readwrite');
      tx.objectStore(STORE_SAVES).delete(slotId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem(`ob_save_${slotId}`);
  }
}

/**
 * Cloud Save Adapter prepared for Supabase accounts and online sync.
 * Activates automatically when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are configured.
 */
class SupabaseSyncAdapter {
  private client: SupabaseClient | null = null;

  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (url && key) {
      this.client = createClient(url, key);
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }

  public async syncSlot(slot: SaveSlotData): Promise<boolean> {
    if (!this.client) return false;
    const { data: user } = await this.client.auth.getUser();
    if (!user.user) return false;
    const { error } = await this.client.from('orbital_saves').upsert({
      user_id: user.user.id,
      slot_id: slot.slotId,
      payload: slot,
      updated_at: new Date(slot.updatedAt).toISOString(),
    });
    return !error;
  }
}

export const supabaseSync = new SupabaseSyncAdapter();
