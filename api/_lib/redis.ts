import { Redis } from "@upstash/redis";
import { ApiError } from "./http.js";

let client: Redis | undefined;

export function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new ApiError(503, "Atomic AI challenge storage is not configured.");
  if (!client) client = new Redis({ url, token, automaticDeserialization: false });
  return client;
}

export type ScenarioChallenge = {
  subject: string;
  wallet: string;
  origin: string;
  digest: string;
  message: string;
  expiresAt: number;
};

export async function putChallenge(id: string, value: ScenarioChallenge): Promise<void> {
  try {
    const result = await getRedis().set("vareq:challenge:" + id, JSON.stringify(value), { ex: 300, nx: true });
    if (result !== "OK") throw new ApiError(503, "A challenge could not be stored. Request a new one.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Atomic AI challenge storage is unavailable.");
  }
}

export async function readChallenge(id: string): Promise<ScenarioChallenge | null> {
  try {
    const value = await getRedis().get<string>("vareq:challenge:" + id);
    if (typeof value !== "string") return null;
    const parsed = JSON.parse(value) as ScenarioChallenge;
    if (!parsed.subject || !parsed.wallet || !parsed.origin || !parsed.digest || !parsed.message || !parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Atomic AI challenge storage is unavailable.");
  }
}

export async function consumeChallenge(id: string, expected: ScenarioChallenge): Promise<boolean> {
  const script = [
    "local value = redis.call('GET', KEYS[1])",
    "if not value or value ~= ARGV[1] then return 0 end",
    "redis.call('DEL', KEYS[1])",
    "return 1",
  ].join("\n");
  try {
    const raw = await getRedis().eval<unknown[], number>(
      script,
      ["vareq:challenge:" + id],
      [JSON.stringify(expected)],
    );
    return Number(raw) === 1;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Atomic AI challenge storage is unavailable.");
  }
}

export async function reserveProposalQuota(subject: string, wallet: string): Promise<void> {
  const script = [
    "local walletCount = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "local dailyCount = tonumber(redis.call('GET', KEYS[2]) or '0')",
    "local minuteCount = tonumber(redis.call('GET', KEYS[3]) or '0')",
    "if walletCount >= 3 or dailyCount >= 60 or minuteCount >= 3 then return 0 end",
    "local a = redis.call('INCR', KEYS[1]); if a == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "local b = redis.call('INCR', KEYS[2]); if b == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end",
    "local c = redis.call('INCR', KEYS[3]); if c == 1 then redis.call('EXPIRE', KEYS[3], ARGV[2]) end",
    "return 1",
  ].join("\n");
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minute = Math.floor(now.getTime() / 60_000);
  const secondsUntilUtcReset = Math.max(60, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000));
  const subjectKey = await digestKey(subject + ":" + wallet.toLowerCase());
  try {
    const result = await getRedis().eval<unknown[], number>(
      script,
      [
        "vareq:quota:wallet:" + subjectKey + ":" + day,
        "vareq:quota:app:" + day,
        "vareq:quota:minute:" + minute,
      ],
      [secondsUntilUtcReset, 120],
    );
    if (Number(result) !== 1) throw new ApiError(429, "Vareq AI proposal limits have been reached. Try again later.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Atomic AI quota storage is unavailable.");
  }
}

async function digestKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
