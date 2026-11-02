import { ScenarioSchema, validateScenario, type Scenario } from "../../packages/core/src/schema.ts";
import { ApiError } from "./http";

const actionKinds = [
  "LOCK",
  "ISSUE_FILL_PERMIT",
  "DELAY_DELIVERY",
  "ADVANCE_LOGICAL_TIME",
  "REQUEST_REFUND",
  "DELIVER_FILL",
  "CLAIM",
] as const;

const responseSchema = {
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
  required: [
    "schemaVersion",
    "scenarioId",
    "title",
    "origin",
    "seed",
    "fixtureId",
    "adapterVersion",
    "refundAfterTick",
    "hypothesis",
    "actions",
  ],
  additionalProperties: false,
} as const;

type ProviderAction = Record<string, unknown>;

function normalizeAction(action: ProviderAction) {
  const common = { id: action.id, kind: action.kind, tick: action.tick, dependsOn: action.dependsOn };
  switch (action.kind) {
    case "LOCK":
      if (typeof action.transferId !== "string" || typeof action.amount !== "string" || action.toTick !== null) {
        throw new ApiError(502, "Groq returned an unsupported scenario. No proposal was accepted.");
      }
      return { ...common, transferId: action.transferId, amount: action.amount };
    case "ADVANCE_LOGICAL_TIME":
      if (typeof action.toTick !== "number" || action.transferId !== null || action.amount !== null) {
        throw new ApiError(502, "Groq returned an unsupported scenario. No proposal was accepted.");
      }
      return { ...common, toTick: action.toTick };
    case "ISSUE_FILL_PERMIT":
    case "DELAY_DELIVERY":
    case "REQUEST_REFUND":
    case "DELIVER_FILL":
    case "CLAIM":
      if (typeof action.transferId !== "string" || action.amount !== null || action.toTick !== null) {
        throw new ApiError(502, "Groq returned an unsupported scenario. No proposal was accepted.");
      }
      return { ...common, transferId: action.transferId };
    default:
      throw new ApiError(502, "Groq returned an unsupported action. No proposal was accepted.");
  }
}

function assertBoundedProposal(base: Scenario, proposal: Scenario): void {
  if (proposal.fixtureId !== base.fixtureId || proposal.refundAfterTick !== base.refundAfterTick) {
    throw new ApiError(502, "Groq changed a locked fixture setting. No proposal was accepted.");
  }
  const baseLock = base.actions.find((action) => action.kind === "LOCK");
  const proposedLocks = proposal.actions.filter((action) => action.kind === "LOCK");
  if (!baseLock || proposedLocks.length !== 1 || proposedLocks[0].kind !== "LOCK" ||
      proposedLocks[0].transferId !== baseLock.transferId || proposedLocks[0].amount !== baseLock.amount) {
    throw new ApiError(502, "Groq changed the bounded transfer fixture. No proposal was accepted.");
  }
  for (const action of proposal.actions) {
    if (action.kind !== "ADVANCE_LOGICAL_TIME" && action.transferId !== baseLock.transferId) {
      throw new ApiError(502, "Groq changed the allowed transfer. No proposal was accepted.");
    }
  }
}

export function parseProposalInput(value: unknown): Scenario {
  const scenario = validateScenario(ScenarioSchema.parse(value));
  if (scenario.origin === "ai") {
    throw new ApiError(400, "Start from a curated or human-authored scenario.");
  }
  return scenario;
}

export async function proposeWithGroq(base: Scenario): Promise<{ scenario: Scenario; model: string }> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new ApiError(503, "Groq proposals are not configured.");
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  if (model !== "openai/gpt-oss-120b" && model !== "openai/gpt-oss-20b") {
    throw new ApiError(503, "The configured Groq model is not on Vareq's approved model list.");
  }

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: 3_000,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Propose one bounded bridge timing scenario as JSON data only. Use only the listed action kinds. Preserve the declared transfer, amount, fixture and refund window. Never generate source code, addresses, signatures, RPC URLs, calldata or new action kinds. This proposal is untrusted data and will not be executed automatically.",
          },
          { role: "user", content: JSON.stringify({ scenario: base, allowedActionKinds: actionKinds }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "vareq_scenario", strict: true, schema: responseSchema },
        },
      }),
    });
  } catch {
    throw new ApiError(503, "Groq is unavailable or the proposal request timed out.");
  }

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new ApiError(
        429,
        "Groq is rate limited. Wait for the provider retry window and try again.",
        retryAfter ? { "retry-after": retryAfter } : undefined,
      );
    }
    throw new ApiError(503, "Groq could not complete the proposal. No scenario was accepted.");
  }

  let completion: {
    model?: string;
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  };
  try {
    completion = await response.json() as typeof completion;
  } catch {
    throw new ApiError(502, "Groq returned an unreadable response. No scenario was accepted.");
  }
  const message = completion.choices?.[0]?.message;
  if (message?.refusal) throw new ApiError(422, "Groq declined this proposal.");
  if (typeof message?.content !== "string" || message.content.length > 64_000) {
    throw new ApiError(502, "Groq returned no bounded proposal.");
  }

  let candidate: Record<string, unknown>;
  try {
    candidate = JSON.parse(message.content) as Record<string, unknown>;
  } catch {
    throw new ApiError(502, "Groq returned invalid JSON. No scenario was accepted.");
  }
  if (!Array.isArray(candidate.actions) || candidate.actions.length > 20) {
    throw new ApiError(502, "Groq returned too many actions. No scenario was accepted.");
  }
  const normalized = {
    ...candidate,
    origin: "ai",
    actions: candidate.actions.map((action) => normalizeAction(action as ProviderAction)),
  };

  let proposal: Scenario;
  try {
    proposal = validateScenario(ScenarioSchema.parse(normalized));
  } catch {
    throw new ApiError(502, "Groq's proposal failed Vareq's independent validation.");
  }
  assertBoundedProposal(base, proposal);
  return { scenario: proposal, model: completion.model ?? model };
}

export async function scenarioDigest(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
