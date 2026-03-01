/**
 * Offline store‑creation queue backed by IndexedDB.
 *
 * Queued entries hold every field that would go to Supabase plus
 * an optional compressed image as an ArrayBuffer (small enough to
 * survive in IDB without issues).
 *
 * Flow:
 *   1. User creates a store while offline → `enqueueStore(data)`
 *   2. When back online → `processOfflineQueue()` uploads image
 *      (if any), inserts into Supabase, and removes the queue entry.
 */

const DB_NAME = "storevis_offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_stores";

// ── Helpers ─────────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const req = store[method](...args);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Add a store payload to the offline queue.
 *
 * @param {Object} payload
 * @param {string} payload.name
 * @param {string} payload.name_search
 * @param {string} payload.address_detail
 * @param {string} payload.ward
 * @param {string} payload.district
 * @param {string} payload.note
 * @param {string} payload.phone
 * @param {number} payload.latitude
 * @param {number} payload.longitude
 * @param {ArrayBuffer|null} payload.imageBuffer  – compressed JPEG as ArrayBuffer
 * @param {string|null}     payload.imageName     – e.g. "1716000000_abc.jpg"
 */
export async function enqueueStore(payload) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await idbRequest(tx.objectStore(STORE_NAME), "add", {
    ...payload,
    createdAt: Date.now(),
  });
  db.close();
}

/**
 * Return all pending stores (for UI display or sync).
 */
export async function getPendingStores() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const items = await idbRequest(tx.objectStore(STORE_NAME), "getAll");
  db.close();
  return items;
}

/**
 * Get the number of pending stores.
 */
export async function getPendingCount() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const count = await idbRequest(tx.objectStore(STORE_NAME), "count");
  db.close();
  return count;
}

/**
 * Remove a single queue entry by id.
 */
export async function removePendingStore(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await idbRequest(tx.objectStore(STORE_NAME), "delete", id);
  db.close();
}

/**
 * Process the entire offline queue:
 *   – Upload image (if any) → insert into Supabase → remove from queue.
 *
 * Returns { synced: number, failed: number }
 */
export async function processOfflineQueue() {
  const { supabase } = await import("@/lib/supabaseClient");
  const { appendStoreToCache, invalidateStoreCache } = await import(
    "@/lib/storeCache"
  );
  const removeVietnameseTones = (await import("@/helper/removeVietnameseTones"))
    .default;

  const items = await getPendingStores();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      let imageFilename = null;

      // Upload image if present
      if (item.imageBuffer) {
        const blob = new Blob([item.imageBuffer], { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("file", blob, item.imageName || "offline.jpg");
        formData.append(
          "fileName",
          item.imageName ||
            `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`
        );
        formData.append("useUniqueFileName", "true");

        const uploadRes = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const uploadResult = await uploadRes.json();
        imageFilename = uploadResult.name;
      }

      const { data: insertedRows, error: insertError } = await supabase
        .from("stores")
        .insert([
          {
            name: item.name,
            name_search:
              item.name_search || removeVietnameseTones(item.name),
            address_detail: item.address_detail,
            ward: item.ward,
            district: item.district,
            note: item.note || "",
            phone: item.phone || "",
            image_url: imageFilename,
            latitude: item.latitude,
            longitude: item.longitude,
          },
        ])
        .select();

      if (insertError) throw insertError;

      // Update local cache
      const newStore = insertedRows?.[0];
      if (newStore) {
        await appendStoreToCache(newStore);
      } else {
        await invalidateStoreCache();
      }

      // Remove from queue
      await removePendingStore(item.id);
      synced++;
    } catch (err) {
      console.error("[OfflineQueue] Failed to sync store:", item.name, err);
      failed++;
    }
  }

  return { synced, failed };
}
