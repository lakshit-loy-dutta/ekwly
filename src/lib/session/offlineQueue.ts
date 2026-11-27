import { supabase } from '../supabase';
import { showToast, utils } from '../utils';

export type QueuePayload = object | object[] | null;
export type QueueMatch = string | Record<string, unknown> | undefined;

export interface QueuedMutation {
  id: string;
  table: string;
  action: 'UPSERT' | 'DELETE' | 'UPDATE';
  payload: QueuePayload;
  matchData?: QueueMatch;
  timestamp: number;
  retries?: number;
}

const QUEUE_KEY = 'ekwly_mutation_queue';
const MAX_RETRIES = 3;
let activeFlushPromise: Promise<void> | null = null;

function readQueue(): QueuedMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]): void {
  if (typeof window === 'undefined') return;
  if (queue.length === 0) {
    localStorage.removeItem(QUEUE_KEY);
  } else {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

export const enqueueMutation = (
  table: string,
  action: 'UPSERT' | 'DELETE' | 'UPDATE',
  payload: QueuePayload,
  matchData?: QueueMatch
) => {
  if (typeof window === 'undefined') return;
  const queue = readQueue();
  queue.push({
    id: utils.generateId(),
    table,
    action,
    payload,
    matchData,
    timestamp: Date.now(),
    retries: 0,
  });
  writeQueue(queue);
};

export const processOfflineQueue = (): Promise<void> => {
  if (typeof window === 'undefined' || !navigator.onLine) return Promise.resolve();
  if (activeFlushPromise) return activeFlushPromise;

  const snapshot = readQueue();
  if (snapshot.length === 0) return Promise.resolve();

  activeFlushPromise = (async () => {
    showToast('Back online! Syncing offline changes...', 'success');
    const resolvedIds = new Set<string>();
    const retryUpdates = new Map<string, number>();
    let rejectedCount = 0;

    try {
      for (const task of snapshot) {
        try {
          let dbError: { code?: string; message?: string } | null = null;

          if (task.action === 'UPSERT') {
            const onConflict = typeof task.matchData === 'string' ? task.matchData : undefined;
            const { error } = await supabase
              .from(task.table)
              .upsert(
                task.payload as Record<string, unknown>,
                onConflict ? { onConflict } : undefined
              );
            dbError = error;
          } else if (task.action === 'DELETE') {
            const matchObj =
              task.matchData && typeof task.matchData === 'object' ? task.matchData : {};
            const { error } = await supabase.from(task.table).delete().match(matchObj);
            dbError = error;
          } else if (task.action === 'UPDATE') {
            const matchObj =
              task.matchData && typeof task.matchData === 'object' ? task.matchData : {};
            const { error } = await supabase
              .from(task.table)
              .update(task.payload as Record<string, unknown>)
              .match(matchObj);
            dbError = error;
          }

          if (!dbError) {
            resolvedIds.add(task.id);
          } else {
            // Permanent Postgres constraint, lock-guard, or RLS rejection -> drop rather than infinite-retry
            const isPermanentError = Boolean(
              dbError.code && (/^(22|23|42|P0)/.test(dbError.code) || dbError.code === 'PGRST301')
            );
            const nextRetries = (task.retries || 0) + 1;
            if (isPermanentError || nextRetries >= MAX_RETRIES) {
              console.error('Dropping rejected offline mutation:', task, dbError);
              resolvedIds.add(task.id);
              rejectedCount += 1;
            } else {
              retryUpdates.set(task.id, nextRetries);
            }
          }
        } catch (err) {
          console.error('Network failure during queue sync:', task, err);
          const nextRetries = (task.retries || 0) + 1;
          if (nextRetries >= MAX_RETRIES) {
            resolvedIds.add(task.id);
            rejectedCount += 1;
          } else {
            retryUpdates.set(task.id, nextRetries);
          }
        }
      }

      // Re-read current storage so any mutations enqueued mid-flush are preserved intact
      const latestQueue = readQueue();
      const remainingQueue = latestQueue
        .filter((t) => !resolvedIds.has(t.id))
        .map((t) => (retryUpdates.has(t.id) ? { ...t, retries: retryUpdates.get(t.id) } : t));
      writeQueue(remainingQueue);

      if (rejectedCount > 0) {
        showToast(
          `${rejectedCount} offline edit${rejectedCount === 1 ? '' : 's'} could not be applied (room locked or changed).`,
          'error'
        );
      }
    } finally {
      activeFlushPromise = null;
    }
  })();

  return activeFlushPromise;
};
