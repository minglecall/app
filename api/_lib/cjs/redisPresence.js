/**
 * Upstash Redis presence helpers for Vercel CJS router.
 * Routine heartbeats write here only — not profiles.last_seen_at.
 */
const { Redis } = require('@upstash/redis');

const PRESENCE_TTL_SEC = 75;
let redis;

function getRedis() {
  if (redis !== undefined) return redis;
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) {
    redis = null;
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

function isRedisConfigured() {
  return Boolean(getRedis());
}

function presenceKey(userId) {
  return `presence:${String(userId)}`;
}

function callStateKey(callId) {
  return `call:${String(callId)}`;
}

async function setPresence(userId, status, ttlSec = PRESENCE_TTL_SEC) {
  const client = getRedis();
  if (!client || !userId) return false;
  const s = status === 'busy' || status === 'offline' ? status : 'online';
  await client.set(presenceKey(userId), s, { ex: ttlSec });
  return true;
}

async function deletePresence(userId) {
  const client = getRedis();
  if (!client || !userId) return;
  await client.del(presenceKey(userId));
}

async function mgetPresence(userIds) {
  const client = getRedis();
  const out = {};
  if (!client) return out;
  const ids = Array.from(
    new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, 200);
  if (!ids.length) return out;
  const values = await client.mget(...ids.map(presenceKey));
  ids.forEach((id, i) => {
    const v = values && values[i];
    out[id] = v === 'online' || v === 'busy' || v === 'offline' ? v : 'offline';
  });
  return out;
}

async function setCallState(callId, state, ttlSec = 4 * 60 * 60) {
  const client = getRedis();
  if (!client || !callId) return;
  await client.set(callStateKey(callId), JSON.stringify(state), { ex: ttlSec });
}

async function getCallState(callId) {
  const client = getRedis();
  if (!client || !callId) return null;
  const raw = await client.get(callStateKey(callId));
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function deleteCallState(callId) {
  const client = getRedis();
  if (!client || !callId) return;
  await client.del(callStateKey(callId));
}

module.exports = {
  PRESENCE_TTL_SEC,
  isRedisConfigured,
  setPresence,
  deletePresence,
  mgetPresence,
  setCallState,
  getCallState,
  deleteCallState,
};
