import type { Action, Scenario } from "./schema";

export const SCHEDULER_VERSION = "1.0.0" as const;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + canonical(object[key])).join(",") + "}";
}

async function orderKey(seed: string, scenarioId: string, actionId: string): Promise<string> {
  const message = new TextEncoder().encode("vareq-scheduler-v1\u0000" + seed + "\u0000" + scenarioId + "\u0000" + actionId);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", message);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function scheduleActions(scenario: Scenario): Promise<Action[]> {
  const pending = new Map(scenario.actions.map((action) => [action.id, action]));
  const completed = new Map<string, "succeeded" | "rejected">();
  const ordered: Action[] = [];
  let logicalTick = 0;
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((action) => action.dependsOn.every((dep) => {
      const status = completed.get(dep.id);
      return status !== undefined && (dep.when === "attempted" || status === "succeeded");
    }));
    if (ready.length === 0) throw new Error("Scenario dependencies cannot be satisfied; check prerequisites and bounds");
    const eligibleTick = Math.max(logicalTick, Math.min(...ready.map((action) => action.tick)));
    const sameTick = ready.filter((action) => action.tick <= eligibleTick);
    const ranked = await Promise.all(sameTick.map(async (action) => ({ action, key: await orderKey(scenario.seed, scenario.scenarioId, action.id) })));
    ranked.sort((a, b) => a.key.localeCompare(b.key) || a.action.id.localeCompare(b.action.id));
    const action = ranked[0].action;
    logicalTick = Math.max(logicalTick, action.tick);
    ordered.push(action);
    completed.set(action.id, "succeeded");
    pending.delete(action.id);
  }
  return ordered;
}

export function canonicalJson(value: unknown): string { return canonical(value); }