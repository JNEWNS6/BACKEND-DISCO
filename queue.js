// queue.js
import pkg from 'bullmq';
const { Queue, Worker, QueueScheduler } = pkg;
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { verifyPromo } from './utils/verifyPromo.js';

// Handle TLS automatically if REDIS_URL starts with rediss://
const isTLS = process.env.REDIS_URL?.startsWith('rediss://');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
});

// Optional schedulers (recommended)
const promoScheduler = new QueueScheduler('promoVerification', { connection });
const billingScheduler = new QueueScheduler('billingOps', { connection });

export const promoQueue = new Queue('promoVerification', { connection });
export const billingQueue = new Queue('billingOps', { connection });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Worker: Promo Verification ---
new Worker(
  'promoVerification',
  async job => {
    const { domain, code } = job.data;
    const result = await verifyPromo(domain, code);
    return { domain, code, ...result };
  },
  { connection }
);

// --- Worker: Billing / Deactivation ---
new Worker(
  'billingOps',
  async job => {
    if (job.name === 'deactivateOfferAfterGrace') {
      const { offerId } = job.data;
      const { rows } = await pool.query(
        'SELECT billing_suspended_at, active FROM offers WHERE id=$1',
        [offerId]
      );
      const rec = rows[0];
      if (rec?.active && rec?.billing_suspended_at) {
        await pool.query('UPDATE offers SET active=false, paid=false WHERE id=$1', [offerId]);
        return { offerId, deactivated: true };
      }
      return { offerId, deactivated: false };
    }
    return { ok: true };
  },
  { connection }
);

export async function scheduleDeactivation(offerId, delayMs) {
  return billingQueue.add(
    'deactivateOfferAfterGrace',
    { offerId },
    { delay: delayMs, removeOnComplete: true, removeOnFail: true }
  );
}
