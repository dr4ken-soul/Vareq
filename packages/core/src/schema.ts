import { z } from "zod";

const Id = z.string().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/);
const Tick = z.number().int().min(0).max(1_000_000);
const Dependency = z.object({ id: Id, when: z.enum(["attempted", "succeeded"]) }).strict();
const BaseAction = { id: Id, tick: Tick, dependsOn: z.array(Dependency).max(20) };

export const ActionSchema = z.discriminatedUnion("kind", [
  z.object({ ...BaseAction, kind: z.literal("LOCK"), transferId: Id, amount: z.string().regex(/^[1-9][0-9]{0,35}$/) }).strict(),
  z.object({ ...BaseAction, kind: z.literal("ISSUE_FILL_PERMIT"), transferId: Id }).strict(),
  z.object({ ...BaseAction, kind: z.literal("DELAY_DELIVERY"), transferId: Id }).strict(),
  z.object({ ...BaseAction, kind: z.literal("ADVANCE_LOGICAL_TIME"), toTick: Tick }).strict(),
  z.object({ ...BaseAction, kind: z.literal("REQUEST_REFUND"), transferId: Id }).strict(),
  z.object({ ...BaseAction, kind: z.literal("DELIVER_FILL"), transferId: Id }).strict(),
  z.object({ ...BaseAction, kind: z.literal("CLAIM"), transferId: Id }).strict(),
]);

export const ScenarioSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  scenarioId: Id,
  title: z.string().trim().min(1).max(80),
  origin: z.enum(["ai", "curated", "human-authored"]),
  seed: z.string().regex(/^(0|[1-9][0-9]{0,19})$/).refine((n) => BigInt(n) <= 18_446_744_073_709_551_615n, "seed must be an unsigned 64-bit integer"),
  fixtureId: z.enum(["reference-vulnerable-v1", "reference-patched-v1"]),
  adapterVersion: z.literal("1.0.0"),
  refundAfterTick: Tick,
  actions: z.array(ActionSchema).min(1).max(20),
  hypothesis: z.string().trim().max(500),
}).strict();

export type Action = z.infer<typeof ActionSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type FixtureKind = "vulnerable" | "patched";

export type TraceStep = {
  stepId: string;
  logicalTick: number;
  actionId: string;
  actor: "user" | "coordinator" | "operator" | "scheduler";
  kind: Action["kind"];
  status: "succeeded" | "rejected";
  summary: string;
  state: { locked: boolean; sourceRefunded: boolean; destinationFilled: boolean; operatorReimbursed: boolean };
};

export type RunResult = {
  fixture: FixtureKind;
  scenario: Scenario;
  trace: TraceStep[];
  invariants: Array<{ id: string; status: "pass" | "violation" | "incomplete"; reason: string; supportingStepIds: string[] }>;
  terminal: { sourceRefunded: boolean; destinationFilled: boolean; operatorReimbursed: boolean };
  completion: "complete" | "incomplete";
};

export type RunArtifact = {
  schemaVersion: "1.0.0";
  runId: string;
  title: string;
  mode: "browser-model" | "local-reference-model" | "local-evm" | "public-testnet";
  origin: Scenario["origin"];
  createdAt: string;
  inputDigest: string;
  schedulerVersion: "1.0.0";
  adapterVersion: "1.0.0";
  fixture: FixtureKind;
  seed: string;
  scenario: Scenario;
  trace: TraceStep[];
  invariants: RunResult["invariants"];
  completion: RunResult["completion"];
  terminal: RunResult["terminal"];
  evidence: [];
  limitations: string[];
};

export function validateScenario(value: unknown): Scenario {
  const parsed = ScenarioSchema.parse(value);
  const ids = new Set<string>();
  for (const action of parsed.actions) {
    if (ids.has(action.id)) throw new Error("Duplicate action id: " + action.id);
    ids.add(action.id);
  }
  for (const action of parsed.actions) {
    for (const dependency of action.dependsOn) {
      if (dependency.id === action.id) throw new Error("Action " + action.id + " cannot depend on itself");
      if (!ids.has(dependency.id)) throw new Error("Unknown dependency " + dependency.id + " in action " + action.id);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(parsed.actions.map((action) => [action.id, action]));
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Dependency cycle includes action " + id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of byId.get(id)!.dependsOn) visit(dep.id);
    visiting.delete(id);
    visited.add(id);
  };
  for (const action of parsed.actions) visit(action.id);
  if (!parsed.actions.some((action) => action.kind === "LOCK")) throw new Error("Scenario must contain a LOCK action");
  return parsed;
}