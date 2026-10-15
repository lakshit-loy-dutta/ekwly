import { supabase } from '../supabase';
import { showToast } from '../utils';

export interface QueuedMutation {
  table: string;
  action: 'UPSERT' | 'DELETE' | 'UPDATE';
  payload: any;
  matchData?: any;
  timestamp: number;
}

const QUEUE_KEY = 'ekwly_mutation_queue';
let activeFlushPromise: Promise<void> | null = null;

export const enqueueMutation = (
  table: string,
  action: 'UPSERT' | 'DELETE' | 'UPDATE',
  payload: any,
  matchData?: any
) => {
  if (typeof window === 'undefined') return;
  const queue: QueuedMutation[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ table, action, payload, matchData, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const processOfflineQueue = (): Promise<void> => {
  if (typeof window === 'undefined' || !navigator.onLine) return Promise.resolve();
  if (activeFlushPromise) return activeFlushPromise;

  const queue: QueuedMutation[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return Promise.resolve();

  activeFlushPromise = (async () => {
    showToast('Back online! Syncing data...', 'success');
    try {
      for (const task of queue) {
        try {
          if (task.action === 'UPSERT') {
            await supabase
              .from(task.table)
              .upsert(task.payload, task.matchData ? { onConflict: task.matchData } : undefined);
          } else if (task.action === 'DELETE') {
            await supabase.from(task.table).delete().match(task.matchData);
          } else if (task.action === 'UPDATE') {
            await supabase.from(task.table).update(task.payload).match(task.matchData);
          }
        } catch (e) {
          console.error('Queue sync failed for task:', task, e);
        }
      }
      localStorage.removeItem(QUEUE_KEY);
    } finally {
      activeFlushPromise = null;
    }
  })();

  return activeFlushPromise;
};
