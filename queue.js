import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { verifyPromo } from './utils/verifyPromo.js';

const connection = new IORedis(process.env.REDIS_URL);
export const promoQueue = new Queue('promoVerification', { connection });
export const billingQueue = new Queue('billingOps', { connection });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

new Worker('promoVerification', async job => {
  const { domain, code } = job.data;
  const valid = await verifyPromo(domain, code);
  return { domain, code, valid };
}, { connection });

new Worker('billingOps', async job => {
  if (job.name === 'deactivateOfferAfterGrace') {
    const { offerId } = job.data;
    const { rows } = await pool.query('SELECT billing_suspended_at, active FROM offers WHERE id=$1', [offerId]);
    const rec = rows[0];
    if (rec?.active && rec?.billing_suspended_at) {
      await pool.query('UPDATE offers SET active=false, paid=false WHERE id=$1', [offerId]);
      return { offerId, deactivated: true };
    }
    return { offerId, deactivated: false };
  }
  return { ok: true };
}, { connection });

export async function scheduleDeactivation(offerId, delayMs){
  return billingQueue.add('deactivateOfferAfterGrace', { offerId }, { delay: delayMs, removeOnComplete: true, removeOnFail: true });
}