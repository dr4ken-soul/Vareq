import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { validateScenario } from "@vareq/core";

const actionKinds = ["LOCK", "ISSUE_FILL_PERMIT", "DELAY_DELIVERY", "ADVANCE_LOGICAL_TIME", "REQUEST_REFUND", "DELIVER_FILL", "CLAIM"];
const jsonSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: ["1.0.0"] },
    scenarioId: { type: "string" },
    title: { type: "string" },
    origin: { type: "string", enum: ["curated"] },
    seed: { type: "string" },
    fixtureId: { type: "string", enum: ["reference-vulnerable-v1", "reference-patched-v1"] },
    adapterVersion: { type: "string", enum: ["1.0.0"] },
    refundAfterTick: { type: "integer" },
    hypothesis: { type: "string" },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: actionKinds },
          transferId: { type: ["string", "null"] },
          amount: { type: ["string", "null"] },
          toTick: { type: ["integer", "null"] },
          tick: { type: "integer" },
          dependsOn: {
            type: "array",
            maxItems: 20,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                when: { type: "string", enum: ["attempted", "succeeded"] },
              },
              required: ["id", "when"],
              additionalProperties: false,
            },
          },
        },
        required: ["id", "kind", "transferId", "amount", "toTick", "tick", "dependsOn"],
        additionalProperties: false,
      },
    },
  },
  required: ["schemaVersion", "scenarioId", "title", "origin", "seed", "fixtureId", "adapterVersion", "refundAfterTick", "hypothesis", "actions"],
  additionalProperties: false,
};

function parseArgs(args: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith("--")) throw new Error("Unexpected argument: " + key);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error("Missing value for " + key);
    result.set(key.slice(2), value);
  }
  return result;
}

function normalizeAction(action: Record<string, unknown>) {
  const common = {
    id: action.id,
    kind: action.kind,
    tick: action.tick,
    dependsOn: action.dependsOn,
  };
  switch (action.kind) {
    case "LOCK":
      if (typeof action.transferId !== "string" || typeof action.amount !== "string" || action.toTick !== null) throw new Error("AI proposal has invalid LOCK fields");
      return { ...common, transferId: action.transferId, amount: action.amount };
    case "ADVANCE_LOGICAL_TIME":
      if (typeof action.toTick !== "number" || action.transferId !== null || action.amount !== null) throw new Error("AI proposal has invalid ADVANCE_LOGICAL_TIME fields");
      return { ...common, toTick: action.toTick };
    case "ISSUE_FILL_PERMIT":
    case "DELAY_DELIVERY":
    case "REQUEST_REFUND":
    case "DELIVER_FILL":
    case "CLAIM":
      if (typeof action.transferId !== "string" || action.amount !== null || action.toTick !== null) throw new Error("AI proposal has invalid " + String(action.kind) + " fields");
      return { ...common, transferId: action.transferId };
    default:
      throw new Error("AI proposal uses an unsupported action");
  }
}

export async function proposeScenario(rawArgs: string[]) {
  const args = parseArgs(rawArgs);
  if (args.get("consent") !== "groq") throw new Error("Before sending scenario data to Groq, rerun with --consent groq after reviewing the input.");
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY is empty. Add it to the ignored local .env file or environment before using AI proposals.");
  const inputPath = resolve(args.get("scenario") ?? "scenarios/refund-fill-race.json");
  const outputPath = resolve(args.get("out") ?? "work/ai-proposal.json");
  const inputText = await readFile(inputPath, "utf8");
  if (Buffer.byteLength(inputText, "utf8") > 64_000) throw new Error("Scenario input exceeds the 64 KB proposal limit.");
  const base = validateScenario(JSON.parse(inputText));
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_completion_tokens: 3_000,
        temperature: 0.2,
        messages: [
          { role: "system", content: "Suggest one bounded bridge timing scenario as JSON data only. Use only the listed action kinds. Preserve declared actors and the stated refund window. Never generate source code, raw addresses, signatures, RPC URLs, calldata or new action kinds. The scenario is an untrusted proposal and will be validated locally." },
          { role: "user", content: JSON.stringify({ scenario: base, allowedActionKinds: actionKinds }) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "vareq_scenario", strict: true, schema: jsonSchema } },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Groq proposal timed out after 15 seconds.");
    throw new Error("Groq is unavailable; no scenario was written.");
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    if (response.status === 429) throw new Error("Groq rate limit reached. Wait for the provider retry window and try again.");
    throw new Error("Groq proposal failed with HTTP " + response.status + "; no provider response body was saved.");
  }
  const completion = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  };
  const message = completion.choices?.[0]?.message;
  if (message?.refusal) throw new Error("Groq declined the proposal. No scenario was written.");
  if (typeof message?.content !== "string" || message.content.length > 64_000) throw new Error("Groq returned no bounded scenario content.");
  let candidate: Record<string, unknown>;
  try { candidate = JSON.parse(message.content) as Record<string, unknown>; }
  catch { throw new Error("Groq returned unreadable JSON. No scenario was written."); }
  if (!Array.isArray(candidate.actions) || candidate.actions.length > 20) throw new Error("Groq response exceeds the 20-action limit.");
  const normalized = {
    ...candidate,
    origin: "ai",
    actions: candidate.actions.map((action) => normalizeAction(action as Record<string, unknown>)),
  };
  const proposal = validateScenario(normalized);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(proposal, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify({ output: outputPath, origin: proposal.origin, model: completion.model ?? model, actionCount: proposal.actions.length, status: "validated-proposal-not-executed" }, null, 2) + "\n");
}
