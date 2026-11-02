import { canonicalJson, SCHEDULER_VERSION } from "./scheduler";
import type { RunArtifact, RunResult } from "./schema";

export async function createArtifact(result: RunResult, mode: RunArtifact["mode"] = "local-reference-model"): Promise<RunArtifact> {
  const reconstruction = { scenario: result.scenario, fixture: result.fixture, schedulerVersion: SCHEDULER_VERSION, adapterVersion: "1.0.0", modelVersion: "1.0.0" };
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(reconstruction)));
  const inputDigest = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    schemaVersion: "1.0.0", runId: "run-" + inputDigest.slice(0, 12), title: result.scenario.title,
    mode, origin: result.scenario.origin, createdAt: new Date().toISOString(), inputDigest,
    schedulerVersion: SCHEDULER_VERSION, adapterVersion: "1.0.0", fixture: result.fixture,
    seed: result.scenario.seed, scenario: result.scenario, trace: result.trace, invariants: result.invariants,
    completion: result.completion, terminal: result.terminal, evidence: [],
    limitations: [
      "This is a bounded reference-model execution, not EVM execution or a public-testnet transaction.",
      "The patched outcome assumes a single coordinator durably records one decision per transfer and never equivocates.",
      "Passing this scenario is not an audit, formal proof, or guarantee that a bridge is safe."
    ]
  };
}

export function normalizedTrace(result: RunResult): string {
  return canonicalJson({ trace: result.trace, invariants: result.invariants, terminal: result.terminal });
}

export function assertSupportedArtifact(input: unknown): asserts input is RunArtifact {
  if (!input || typeof input !== "object") throw new Error("Run artefact must be an object");
  const artifact = input as Partial<RunArtifact>;
  if (artifact.schemaVersion !== "1.0.0") throw new Error("Unsupported artefact version: " + String(artifact.schemaVersion ?? "missing"));
  if (!Array.isArray(artifact.trace) || artifact.trace.length > 100) throw new Error("Trace must contain at most 100 steps");
  if (JSON.stringify(input).length > 512_000) throw new Error("Artefact exceeds 512 KB");
}