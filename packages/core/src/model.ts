import { validateScenario, type FixtureKind, type RunResult, type Scenario, type TraceStep } from "./schema";
import { scheduleActions } from "./scheduler";

export async function executeReferenceModel(input: unknown, fixture: FixtureKind): Promise<RunResult> {
  const scenario: Scenario = validateScenario(input);
  const expectedFixtureId = fixture === "vulnerable" ? "reference-vulnerable-v1" : "reference-patched-v1";
  if (scenario.fixtureId !== expectedFixtureId) {
    throw new Error("Scenario fixture " + scenario.fixtureId + " does not match the selected " + fixture + " model");
  }
  const ordered = await scheduleActions(scenario);
  const state = {
    locked: false, sourceRefunded: false, destinationFilled: false, operatorReimbursed: false,
    fillPermit: false, deliveryDelayed: false, coordinatorDecision: "none" as "none" | "fill" | "refund", logicalTick: 0,
  };
  const trace: TraceStep[] = [];
  const statuses = new Map<string, "succeeded" | "rejected">();
  for (const action of ordered) {
    const failedDependency = action.dependsOn.find((dep) => dep.when === "succeeded" && statuses.get(dep.id) !== "succeeded");
    let status: TraceStep["status"] = "succeeded";
    let summary = "Action applied.";
    const reject = (reason: string) => { status = "rejected"; summary = reason; };
    if (failedDependency) reject("Skipped because " + failedDependency.id + " did not succeed.");
    else switch (action.kind) {
      case "LOCK":
        if (state.locked) reject("Transfer is already locked."); else { state.locked = true; summary = "User locked " + action.amount + " reference units."; }
        break;
      case "ISSUE_FILL_PERMIT":
        if (!state.locked) reject("A fill permit requires a locked transfer.");
        else if (fixture === "patched" && state.coordinatorDecision !== "none") reject("Coordinator already recorded a conflicting decision.");
        else { state.fillPermit = true; if (fixture === "patched") state.coordinatorDecision = "fill"; summary = "Coordinator issued a destination fill permit."; }
        break;
      case "DELAY_DELIVERY":
        if (!state.fillPermit) reject("There is no fill permit to delay."); else { state.deliveryDelayed = true; summary = "Fill permit delivery is held until a later logical tick."; }
        break;
      case "ADVANCE_LOGICAL_TIME":
        if (action.toTick < state.logicalTick) reject("Logical time cannot move backwards."); else { state.logicalTick = action.toTick; summary = "Logical time advanced to tick " + action.toTick + "."; }
        break;
      case "REQUEST_REFUND":
        if (!state.locked) reject("No locked transfer is available to refund.");
        else if (state.logicalTick < scenario.refundAfterTick) reject("Refund window has not opened.");
        else if (state.sourceRefunded) reject("Transfer was already refunded.");
        else if (fixture === "patched" && state.coordinatorDecision === "fill") reject("Refund permit refused: fill decision is already durably recorded.");
        else { if (fixture === "patched") state.coordinatorDecision = "refund"; state.sourceRefunded = true; summary = "Source refund completed."; }
        break;
      case "DELIVER_FILL":
        if (!state.fillPermit) reject("Destination has no valid fill permit.");
        else { state.deliveryDelayed = false; state.destinationFilled = true; summary = "Destination fill completed using the previously issued permit."; }
        break;
      case "CLAIM":
        if (!state.destinationFilled) reject("Operator claim requires an observed destination fill.");
        else if (state.sourceRefunded) reject("Source already refunded; operator reimbursement failed.");
        else { state.operatorReimbursed = true; summary = "Operator reimbursement completed after the destination fill."; }
        break;
    }
    statuses.set(action.id, status);
    trace.push({
      stepId: "step-" + String(trace.length + 1).padStart(2, "0"),
      logicalTick: state.logicalTick,
      actionId: action.id,
      actor: action.kind === "LOCK" || action.kind === "REQUEST_REFUND" ? "user" : action.kind === "DELIVER_FILL" || action.kind === "CLAIM" ? "operator" : action.kind === "ADVANCE_LOGICAL_TIME" ? "scheduler" : "coordinator",
      kind: action.kind, status, summary,
      state: { locked: state.locked, sourceRefunded: state.sourceRefunded, destinationFilled: state.destinationFilled, operatorReimbursed: state.operatorReimbursed },
    });
  }
  const bothSettled = state.sourceRefunded && state.destinationFilled;
  const invariantSteps = trace.filter((step) => step.state.sourceRefunded || step.state.destinationFilled).map((step) => step.stepId);
  return {
    fixture, scenario, trace,
    invariants: [{ id: "no-double-settlement", status: bothSettled ? "violation" : "pass", reason: bothSettled ? "The source refunded the transfer and the destination also filled it." : "The source was not refunded while a destination fill also completed within this run.", supportingStepIds: invariantSteps }],
    terminal: { sourceRefunded: state.sourceRefunded, destinationFilled: state.destinationFilled, operatorReimbursed: state.operatorReimbursed },
    completion: "complete",
  };
}
