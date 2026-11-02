import { afterEach, describe, expect, it, vi } from "vitest";
import challengeRoute from "../api/wallet-challenges.js";
import receiptRoute from "../api/testnet/receipts.js";
import { proposeWithGroq } from "../api/_lib/scenario.js";
import { validateScenario, type Scenario } from "../packages/core/src/schema.js";
import baseJson from "../scenarios/refund-fill-race.json";

const base = validateScenario(baseJson) as Scenario;
const testHash = "0x" + "a".repeat(64);

function actionForProvider(action: Scenario["actions"][number]) {
  const common = { id: action.id, kind: action.kind, tick: action.tick, dependsOn: action.dependsOn };
  if (action.kind === "LOCK") return { ...common, transferId: action.transferId, amount: action.amount, toTick: null };
  if (action.kind === "ADVANCE_LOGICAL_TIME") return { ...common, transferId: null, amount: null, toTick: action.toTick };
  return { ...common, transferId: action.transferId, amount: null, toTick: null };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hosted backend safety gates", () => {
  it("keeps the challenge endpoint closed while AI is disabled", async () => {
    vi.stubEnv("VITE_ENABLE_AI", "false");
    vi.stubEnv("VITE_SITE_URL", "http://localhost:5173");
    vi.stubEnv("VERCEL_ENV", "development");
    const response = await challengeRoute.fetch(new Request("http://localhost:5173/api/wallet-challenges", {
      method: "POST",
      headers: { origin: "http://localhost:5173", "content-type": "application/json" },
      body: JSON.stringify({ walletAddress: "0x" + "1".repeat(40), scenario: base }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("disabled") });
  });

  it("keeps public receipt lookup closed while testnet is unverified", async () => {
    vi.stubEnv("VITE_ENABLE_TESTNET", "false");
    vi.stubEnv("VITE_SITE_URL", "http://localhost:5173");
    vi.stubEnv("VERCEL_ENV", "development");
    const response = await receiptRoute.fetch(new Request(
      "http://localhost:5173/api/testnet/receipts?network=base-sepolia&txHash=" + testHash,
      { headers: { origin: "http://localhost:5173" } },
    ));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("disabled") });
  });

  it("accepts only bounded Groq proposals that preserve the selected fixture", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    const candidate = {
      ...base,
      origin: "curated",
      title: "AI proposal for refund timing",
      actions: base.actions.map(actionForProvider),
    };
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: "openai/gpt-oss-120b",
      choices: [{ message: { content: JSON.stringify(candidate) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", mockedFetch);

    const proposal = await proposeWithGroq(base);
    expect(proposal.scenario.origin).toBe("ai");
    expect(proposal.scenario.fixtureId).toBe(base.fixtureId);
    expect(proposal.model).toBe("openai/gpt-oss-120b");
    expect(mockedFetch).toHaveBeenCalledOnce();
  });

  it("rejects a provider proposal that changes the bounded transfer amount", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const candidate = {
      ...base,
      origin: "curated",
      actions: base.actions.map((action) => {
        const converted = actionForProvider(action);
        if (converted.kind === "LOCK") return { ...converted, amount: "999999" };
        return converted;
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(candidate) } }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    await expect(proposeWithGroq(base)).rejects.toThrow("changed the bounded transfer fixture");
  });

  it("checks chain identity and reports a real RPC receipt without inventing evidence", async () => {
    vi.stubEnv("VITE_ENABLE_TESTNET", "true");
    vi.stubEnv("VITE_SITE_URL", "http://localhost:5173");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org");
    const rpcFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0x14a34" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: {
        transactionHash: testHash,
        blockNumber: "0x10",
        blockHash: "0x" + "b".repeat(64),
        from: "0x" + "1".repeat(40),
        to: null,
        status: "0x1",
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "0x14" }), { status: 200 }));
    vi.stubGlobal("fetch", rpcFetch);
    const response = await receiptRoute.fetch(new Request(
      "http://localhost:5173/api/testnet/receipts?network=base-sepolia&txHash=" + testHash,
      { headers: { origin: "http://localhost:5173" } },
    ));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      network: "base-sepolia",
      chainId: 84532,
      transactionHash: testHash,
      status: "success",
      receipt: { blockNumber: "16", confirmations: "5" },
      evidenceMode: "public-testnet",
    });
    expect(rpcFetch).toHaveBeenCalledTimes(3);
  });
});
