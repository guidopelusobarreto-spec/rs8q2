// Almacenamiento: IndexedDB en el navegador; memoria en las pruebas. Misma interfaz.
export const COLLECTIONS = ['profiles', 'customProducts', 'lots', 'plans', 'administrations', 'pct', 'reminders',
  'weights', 'habits', 'incidents', 'events', 'audit', 'settings', 'templates'];
export const DB_NAME = 'registro-sustancias';
export const DB_VERSION = 2;

export class MemoryStore {
  constructor() { this.data = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()])); }
  async all(c) { return [...this.data[c].values()].map((r) => structuredClone(r)); }
  async get(c, id) { const r = this.data[c].get(id); return r ? structuredClone(r) : undefined; }
  async put(c, rec) { this.data[c].set(rec.id, structuredClone(rec)); return rec; }
  async del(c, id) { this.data[c].delete(id); }
  async clear(c) { this.data[c].clear(); }
}

export class IDBStore {
  static open(name = DB_NAME) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const c of COLLECTIONS) if (!db.objectStoreNames.contains(c)) {
          const os = db.createObjectStore(c, { keyPath: 'id' });
          if (c !== 'settings') os.createIndex('profileId', 'profileId');
        }
      };
      req.onsuccess = () => resolve(new IDBStore(req.result));
      req.onerror = () => reject(req.error);
    });
  }
  constructor(db) { this.db = db; }
  _tx(c, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(c, mode);
      const r = fn(tx.objectStore(c));
      tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transacción cancelada'));
    });
  }
  all(c) { return this._tx(c, 'readonly', (s) => s.getAll()); }
  get(c, id) { return this._tx(c, 'readonly', (s) => s.get(id)); }
  async put(c, rec) { await this._tx(c, 'readwrite', (s) => s.put(rec)); return rec; }
  del(c, id) { return this._tx(c, 'readwrite', (s) => s.delete(id)); }
  clear(c) { return this._tx(c, 'readwrite', (s) => s.clear()); }
}
