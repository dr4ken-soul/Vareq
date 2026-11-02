import { describe, expect, it } from "vitest";
import scenarioFile from "../../../scenarios/refund-fill-race.json";
import { executeReferenceModel, normalizedTrace, validateScenario } from "../src/index";

describe("bounded refund/fill reference case", () => {
  it("reproduces the vulnerable outcome and the operator failed reimbursement", async () => {
    const result = await executeReferenceModel(scenarioFile, "vulnerable");
    expect(result.invariants[0].status).toBe("violation");
    expect(result.terminal).toEqual({ sourceRefunded: true, destinationFilled: true, operatorReimbursed: false });
    expect(result.trace.find((step) => step.kind === "CLAIM")?.status).toBe("rejected");
  });
  it("avoids the same counterexample in the trusted-coordinator fixture", async () => {
    const result = await executeReferenceModel({ ...scenarioFile, fixtureId: "reference-patched-v1" }, "patched");
    expect(result.invariants[0].status).toBe("pass");
    expect(result.trace.find((step) => step.kind === "REQUEST_REFUND")?.status).toBe("rejected");
    expect(result.terminal).toEqual({ sourceRefunded: false, destinationFilled: true, operatorReimbursed: true });
  });
  it("rejects a fixture label that does not match the selected reference model", async () => {
    await expect(executeReferenceModel(scenarioFile, "patched")).rejects.toThrow(/does not match/);
  });
  it("reconstructs the same normalized trace from the same input", async () => {
    const first = await executeReferenceModel(scenarioFile, "vulnerable");
    const second = await executeReferenceModel(JSON.parse(JSON.stringify(scenarioFile)), "vulnerable");
    expect(normalizedTrace(first)).toBe(normalizedTrace(second));
  });
  it("rejects duplicate ids, malformed amounts, cycles and unknown fields", () => {
    expect(() => validateScenario({ ...scenarioFile, actions: [scenarioFile.actions[0], scenarioFile.actions[0]] })).toThrow(/Duplicate action id/);
    expect(() => validateScenario({ ...scenarioFile, actions: [{ ...scenarioFile.actions[0], amount: "1.5" }] })).toThrow();
    expect(() => validateScenario({ ...scenarioFile, actions: [{ ...scenarioFile.actions[0], dependsOn: [{ id: "lock", when: "attempted" }] }] })).toThrow(/cannot depend on itself/);
    expect(() => validateScenario({ ...scenarioFile, unexpected: true })).toThrow();
  });
});
