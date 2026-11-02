import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { executeReferenceModel, createArtifact } from "@vareq/core";
import { proposeScenario } from "./groq";

function argsToMap(args: string[]) {
  const result = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) throw new Error("Unexpected argument: " + arg);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error("Missing value for " + arg);
    result.set(arg.slice(2), value);
  }
  return result;
}

async function main() {
  const [command, ...rawArgs] = process.argv.slice(2);
  if (!command || command === "--help" || command === "help") {
    process.stdout.write("Vareq local CLI\n\n  bun run vareq -- run --scenario scenarios/refund-fill-race.json --fixture vulnerable|patched --out work/run.json\n  bun run vareq -- propose --consent groq --scenario scenarios/refund-fill-race.json --out work/ai-proposal.json\n\nRun executes the bounded TypeScript reference model. Propose sends only the selected scenario JSON to Groq and writes a locally validated proposal; it does not execute it.\n");
    return;
  }
  if (command === "propose") {
    await proposeScenario(rawArgs);
    return;
  }
  if (command !== "run") throw new Error("Unknown command: " + command);
  const args = argsToMap(rawArgs);
  const scenarioPath = resolve(args.get("scenario") ?? "scenarios/refund-fill-race.json");
  const fixtureValue = args.get("fixture") ?? "vulnerable";
  if (fixtureValue !== "vulnerable" && fixtureValue !== "patched") throw new Error("--fixture must be vulnerable or patched");
  const out = resolve(args.get("out") ?? "work/" + fixtureValue + "-run.json");
  const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
  scenario.fixtureId = fixtureValue === "vulnerable" ? "reference-vulnerable-v1" : "reference-patched-v1";
  const result = await executeReferenceModel(scenario, fixtureValue);
  const artifact = await createArtifact(result, "local-reference-model");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify({ artifact: out, mode: artifact.mode, invariant: result.invariants[0].status, terminal: result.terminal }, null, 2) + "\n");
  if (result.completion !== "complete") process.exitCode = 2;
  else if (result.invariants.some((invariant) => invariant.status === "violation")) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write((error instanceof Error ? error.message : "Unexpected error") + "\n"); process.exitCode = 2; });
