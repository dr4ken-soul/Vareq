import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { CodePromise, ContractPromise } from "@polkadot/api-contract";
import { Keyring } from "@polkadot/keyring";
import type { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { hexToU8a } from "@polkadot/util";
import { createPublicClient, http, parseAbiItem, parseEventLogs, type Hex } from "viem";
import { baseSepolia } from "viem/chains";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = resolve(root, "work/portaldot-native-contract-runs");
const nativeRpc = process.env.PORTALDOT_V3_NATIVE_WS_URL?.trim() || "wss://test-node-v3.portaldot.dev";
const baseRpc = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
const LOCKED_EVENT = parseAbiItem("event Locked(bytes32 indexed transferId,address indexed user,uint256 units)");
const REFUNDED_EVENT = parseAbiItem("event Refunded(bytes32 indexed transferId,address indexed user,uint256 units)");
const T_POT = 10n ** 14n;
type Stage = "deploy" | "attest" | "refund" | "fill";
type Mode = "patched" | "vulnerable";
type Args = { stage: Stage; mode: Mode; transferId?: Hex; sourceTransaction?: Hex; refundTransaction?: Hex };
type Receipt = { extrinsicHash: string; blockHash: string; blockNumber: string; signer: string; finalized: true; event: string };
type InstantiateDryRun = {
  result: { isErr: boolean };
  debugMessage: { toHex(): string };
  storageDeposit: { isCharge: boolean; asCharge: { toBigInt(): bigint } };
};

function stop(message: string): never {
  console.error("Native Portaldot contract operation stopped: " + message);
  process.exit(1);
}

function storageDepositLimit(): bigint {
  const raw = process.env.PORTALDOT_NATIVE_MAX_STORAGE_DEPOSIT_TPOT?.trim();
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) {
    stop("Set PORTALDOT_NATIVE_MAX_STORAGE_DEPOSIT_TPOT to a positive whole-tPOT budget in the ignored local .env.");
  }
  return BigInt(raw) * T_POT;
}

function readArgs(): Args {
  const values = new Map<string, string>();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const key = args[i].slice(2);
    if (key === "approve" || key === "broadcast") { values.set(key, "true"); continue; }
    const value = args[i + 1];
    if (!value || value.startsWith("--")) stop("--" + key + " needs a value.");
    values.set(key, value);
    i++;
  }
  const stage = values.get("stage");
  const mode = values.get("mode") || "patched";
  const transferId = values.get("transfer-id") as Hex | undefined;
  const sourceTransaction = values.get("source-transaction") as Hex | undefined;
  const refundTransaction = values.get("refund-transaction") as Hex | undefined;
  if (!["deploy", "attest", "refund", "fill"].includes(stage || "")) stop("Choose --stage deploy, attest, refund, or fill.");
  if (mode !== "patched" && mode !== "vulnerable") stop("Choose --mode patched or vulnerable.");
  if (stage !== "deploy" && (!transferId || !/^0x[0-9a-fA-F]{64}$/.test(transferId))) stop("Live stages need a 32-byte --transfer-id.");
  if (stage === "attest" && (!sourceTransaction || !/^0x[0-9a-fA-F]{64}$/.test(sourceTransaction))) stop("Attest needs --source-transaction for the Base Sepolia lock.");
  if (stage === "refund" && (!refundTransaction || !/^0x[0-9a-fA-F]{64}$/.test(refundTransaction))) stop("Refund needs --refund-transaction for the Base Sepolia refund.");
  if (values.get("approve") !== "true" || values.get("broadcast") !== "true") stop("Every live operation needs both --approve and --broadcast.");
  return { stage: stage as Stage, mode: mode as Mode, transferId, sourceTransaction, refundTransaction };
}

function fixedWs(): string {
  let parsed: URL;
  try { parsed = new URL(nativeRpc); } catch { stop("PORTALDOT_V3_NATIVE_WS_URL is invalid."); }
  if (parsed.protocol !== "wss:" || parsed.hostname !== "test-node-v3.portaldot.dev" || parsed.username || parsed.password) {
    stop("The native Portaldot websocket must use the allowlisted V3 host.");
  }
  return nativeRpc;
}

function fixedBaseRpc(): string {
  let parsed: URL;
  try { parsed = new URL(baseRpc); } catch { stop("BASE_SEPOLIA_RPC_URL is invalid."); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "sepolia.base.org" || parsed.username || parsed.password) {
    stop("Base source reads must use the allowlisted Base Sepolia RPC.");
  }
  return baseRpc;
}

async function loadSigner(role: "OPERATOR" | "ATTESTER"): Promise<KeyringPair> {
  const file = process.env["PORTALDOT_NATIVE_" + role + "_KEYSTORE_PATH"]?.trim();
  const password = process.env["PORTALDOT_NATIVE_" + role + "_KEYSTORE_PASSWORD"];
  if (!file || !password) stop("Set PORTALDOT_NATIVE_" + role + "_KEYSTORE_PATH and PORTALDOT_NATIVE_" + role + "_KEYSTORE_PASSWORD in the ignored local .env.");
  const walletPath = resolve(root, file);
  const relativePath = relative(root, walletPath);
  if (!relativePath || (!isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(".." + sep))) stop("Keep encrypted SS58 wallet exports outside the Vareq repository.");
  let json: unknown;
  try { json = JSON.parse(await readFile(walletPath, "utf8")); }
  catch { stop("Could not read the encrypted " + role.toLowerCase() + " wallet JSON file."); }
  await cryptoWaitReady();
  try {
    const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
    const pair = keyring.addFromJson(json as Parameters<Keyring["addFromJson"]>[0]);
    pair.decodePkcs8(password);
    return pair;
  } catch {
    stop("The " + role.toLowerCase() + " SS58 wallet export or its local password could not be unlocked.");
  }
}

function baseClient() {
  return createPublicClient({ chain: baseSepolia, transport: http(fixedBaseRpc(), { timeout: 20_000 }) });
}

async function verifySourceEvent(kind: "lock" | "refund", mode: Mode, transferId: Hex, transactionHash: Hex) {
  const client = baseClient();
  if (await client.getChainId() !== 84_532) stop("The source RPC is not Base Sepolia.");
  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash: transactionHash }); }
  catch { stop("The Base Sepolia " + kind + " transaction was not found."); }
  if (receipt.status !== "success") stop("The Base Sepolia " + kind + " transaction reverted.");
  const head = await client.getBlockNumber();
  const confirmations = head >= receipt.blockNumber ? head - receipt.blockNumber + 1n : 0n;
  if (confirmations < 5n) stop("The Base Sepolia " + kind + " receipt has " + confirmations.toString() + " confirmation(s); wait for five before attesting.");
  const sourceVariable = mode === "patched" ? "VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS" : "VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS";
  const sourceFixture = process.env[sourceVariable]?.trim().toLowerCase();
  if (!sourceFixture || receipt.to?.toLowerCase() !== sourceFixture) stop("The Base transaction did not target the configured Vareq source fixture.");
  const abiEvent = kind === "lock" ? LOCKED_EVENT : REFUNDED_EVENT;
  const logs = parseEventLogs({ abi: [abiEvent], eventName: abiEvent.name, logs: receipt.logs.filter((log) => log.address.toLowerCase() === sourceFixture), strict: false }) as unknown as Array<{
    args: { transferId?: Hex; user?: string; units?: bigint };
  }>;
  const match = logs.find((entry) => entry.args.transferId?.toLowerCase() === transferId.toLowerCase());
  if (!match?.args.user || match.args.units === undefined) stop("The Base receipt does not contain the expected " + kind + " event for this transfer.");
  return { transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, sourceFixture, user: match.args.user, units: match.args.units };
}

async function assertRuntime(api: ApiPromise) {
  const [chain, specName, specVersion, properties] = await Promise.all([
    api.rpc.system.chain(), api.runtimeVersion.specName, api.runtimeVersion.specVersion, api.rpc.system.properties(),
  ]);
  const tokenSymbols = properties.tokenSymbol.toJSON() as string[];
  const decimals = properties.tokenDecimals.toJSON() as number[];
  if (chain.toString() !== "PortaldotV3 Test" || specName.toString() !== "portaldot-v3" || specVersion.toNumber() !== 3002) {
    stop("Unexpected native runtime: " + chain + ", " + specName + " v" + specVersion + ".");
  }
  if (tokenSymbols[0] !== "tPOT" || decimals[0] !== 14) stop("Native token metadata did not match tPOT/14 decimals.");
  if (!api.tx.contracts?.instantiateWithCode || !api.tx.contracts?.call) stop("The Portaldot native contracts pallet is unavailable.");
}

async function sendFinalized(api: ApiPromise, pair: KeyringPair, tx: any, expectedEvent: string): Promise<Receipt> {
  const payment = await tx.paymentInfo(pair);
  const account = await api.query.system.account(pair.address);
  const free = (account as any).data.free.toBigInt() as bigint;
  const fee = payment.partialFee.toBigInt() as bigint;
  const minimum = (api.consts.balances.existentialDeposit as any).toBigInt() as bigint;
  if (free < fee + minimum) stop(pair.address + " needs more native tPOT; estimated fee " + fee.toString() + " base units, minimum balance " + minimum.toString() + ".");
  console.log("Signer: " + pair.address);
  console.log("Estimated fee: " + (Number(fee) / 1e14).toFixed(6) + " tPOT (plus any contract storage charge).");

  return new Promise<Receipt>((resolvePromise, rejectPromise) => {
    let unsubscribe: (() => void) | undefined;
    const timer = setTimeout(() => { unsubscribe?.(); rejectPromise(new Error("Native transaction did not finalize within three minutes.")); }, 180_000);
    void tx.signAndSend(pair, (result: any) => {
      if (result.dispatchError) {
        clearTimeout(timer);
        const error = result.dispatchError.isModule ? api.registry.findMetaError(result.dispatchError.asModule) : null;
        const message = error ? error.section + "." + error.name : result.dispatchError.toString();
        unsubscribe?.();
        rejectPromise(new Error("Portaldot rejected the transaction: " + message + "."));
        return;
      }
      if (!result.status.isFinalized) return;
      clearTimeout(timer);
      const success = result.events.some(({ event: chainEvent }: any) => chainEvent.section === "system" && chainEvent.method === "ExtrinsicSuccess");
      const decoded = (result.contractEvents || []).map((item: any) => item.event?.identifier).filter(Boolean);
      if (!success || !decoded.includes(expectedEvent)) {
        unsubscribe?.();
        rejectPromise(new Error("Finalized extrinsic did not emit expected native contract event " + expectedEvent + "."));
        return;
      }
      const blockHash = result.status.asFinalized.toHex();
      void api.rpc.chain.getHeader(blockHash).then((header) => resolvePromise({
        extrinsicHash: result.txHash.toHex(),
        blockHash,
        blockNumber: header.number.toString(),
        signer: pair.address,
        finalized: true,
        event: expectedEvent,
      })).catch(rejectPromise).finally(() => unsubscribe?.());
    }).then((stopListening: () => void) => { unsubscribe = stopListening; }).catch((error: unknown) => {
      clearTimeout(timer);
      unsubscribe?.();
      rejectPromise(error);
    });
  });
}

async function readArtifact() {
  const explicit = process.env.PORTALDOT_NATIVE_ARTIFACT_PATH?.trim();
  const candidates = explicit ? [resolve(root, explicit)] : [];
  const directories = [resolve(root, "contracts/portaldot-native/target/ink")];
  if (process.env.CARGO_TARGET_DIR?.trim()) directories.push(resolve(process.env.CARGO_TARGET_DIR.trim(), "ink"));
  directories.push(resolve(root, "target/ink"));
  for (const directory of directories) {
    try {
      for (const file of await readdir(directory)) if (file.endsWith(".contract")) candidates.push(resolve(directory, file));
    } catch { /* try the next cargo-contract output location */ }
  }
  for (const path of candidates) {
    try {
      const artifact = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      if ((artifact as any).source?.wasm?.startsWith("0x")) return artifact;
    } catch { /* try the next candidate */ }
  }
  stop("Build the native contract first. No .contract bundle with embedded Wasm was found in the contract or configured Cargo target output.");
}

function fixtureAddress(mode: Mode): string {
  const suffix = mode.toUpperCase();
  const address = process.env["PORTALDOT_NATIVE_FIXTURE_" + suffix + "_ADDRESS"]?.trim()
    || process.env["VITE_PORTALDOT_NATIVE_FIXTURE_" + suffix + "_ADDRESS"]?.trim()
    || process.env.PORTALDOT_NATIVE_FIXTURE_ADDRESS?.trim()
    || process.env.VITE_PORTALDOT_NATIVE_FIXTURE_ADDRESS?.trim();
  if (!address || !address.startsWith("5")) stop("Deploy the " + mode + " native fixture first and set PORTALDOT_NATIVE_FIXTURE_" + suffix + "_ADDRESS in the local .env.");
  return address;
}

async function updateLocalEnv(mode: Mode, address: string) {
  const path = resolve(root, ".env");
  let content = "";
  try { content = await readFile(path, "utf8"); } catch { /* create the ignored local env file */ }
  const suffix = mode.toUpperCase();
  for (const key of ["PORTALDOT_NATIVE_FIXTURE_" + suffix + "_ADDRESS", "VITE_PORTALDOT_NATIVE_FIXTURE_" + suffix + "_ADDRESS"]) {
    const line = new RegExp("^" + key + "=.*$", "m");
    content = line.test(content) ? content.replace(line, key + "=" + address) : content.trimEnd() + (content.trim() ? "\n" : "") + key + "=" + address + "\n";
  }
  await writeFile(path, content, "utf8");
}

async function main() {
  const args = readArgs();
  const api = await ApiPromise.create({ provider: new WsProvider(fixedWs()), noInitWarn: true });
  try {
    await assertRuntime(api);
    const operator = await loadSigner("OPERATOR");
    const attester = await loadSigner("ATTESTER");
    if (operator.address === attester.address) stop("Native operator and attester must be different SS58 accounts.");

    if (args.stage === "deploy") {
      const bundle = await readArtifact();
      const wasm = (bundle as any).source?.wasm;
      if (typeof wasm !== "string" || !wasm.startsWith("0x")) stop("The .contract bundle does not include embedded Wasm code.");
      const code = new CodePromise(api, bundle as any, hexToU8a(wasm));
      const constructor = (code.tx as Record<string, (...values: any[]) => any>).new;
      if (!constructor) stop("The native artifact has no new constructor.");
      const gasLimit = api.registry.createType("WeightV2", { refTime: "1000000000000", proofSize: "16777216" });
      const maxStorageDeposit = storageDepositLimit();
      const tx = constructor({ gasLimit, storageDepositLimit: maxStorageDeposit }, operator.address, attester.address, args.mode === "patched");
      const callArgs = tx.method.args;
      const dryRun = await api.call.contractsApi.instantiate(
        operator.address,
        callArgs[0],
        gasLimit,
        maxStorageDeposit,
        { Upload: hexToU8a(wasm) },
        callArgs[4],
        callArgs[5],
      ) as unknown as InstantiateDryRun;
      if (dryRun.result.isErr) {
        const detail = new TextDecoder().decode(hexToU8a(dryRun.debugMessage.toHex())).trim();
        stop("Portaldot V3 rejected the native Wasm during read-only deployment preflight" + (detail ? ": " + detail : "."));
      }
      const estimatedStorageDeposit = dryRun.storageDeposit.isCharge ? dryRun.storageDeposit.asCharge.toBigInt() : 0n;
      if (estimatedStorageDeposit > maxStorageDeposit) stop("Dry-run storage deposit exceeds the configured per-transaction tPOT cap.");
      const payment = await tx.paymentInfo(operator);
      const account = await api.query.system.account(operator.address);
      const free = (account as any).data.free.toBigInt() as bigint;
      const fee = payment.partialFee.toBigInt() as bigint;
      const minimum = (api.consts.balances.existentialDeposit as any).toBigInt() as bigint;
      if (free < fee + estimatedStorageDeposit + minimum) stop(operator.address + " does not have enough free tPOT for the dry-run storage deposit, inclusion fee, and minimum balance.");
      console.log("Deploying " + args.mode + " native fixture on Portaldot V3.");
      console.log("Operator: " + operator.address);
      console.log("Attester: " + attester.address);
      console.log("Estimated storage deposit: " + (Number(estimatedStorageDeposit) / 1e14).toFixed(6) + " tPOT (limit " + (Number(maxStorageDeposit) / 1e14).toFixed(0) + ").");
      console.log("Estimated inclusion fee: " + (Number(fee) / 1e14).toFixed(6) + " tPOT.");
      console.log("The deployment uses explicit --approve and --broadcast flags and enforces the configured storage-deposit cap.");
      const deployment = await new Promise<{ address: string; receipt: Receipt }>((resolvePromise, rejectPromise) => {
        let unsubscribe: (() => void) | undefined;
        const timer = setTimeout(() => { unsubscribe?.(); rejectPromise(new Error("Deployment did not finalize within three minutes.")); }, 180_000);
        void tx.signAndSend(operator, (result: any) => {
          if (result.dispatchError) {
            clearTimeout(timer);
            const error = result.dispatchError.isModule ? api.registry.findMetaError(result.dispatchError.asModule) : null;
            unsubscribe?.();
            rejectPromise(new Error(error ? error.section + "." + error.name : result.dispatchError.toString()));
            return;
          }
          if (!result.status.isFinalized) return;
          clearTimeout(timer);
          const success = result.events.some(({ event: chainEvent }: any) => chainEvent.section === "system" && chainEvent.method === "ExtrinsicSuccess");
          const address = result.contract?.address?.toString();
          if (!success || !address) {
            unsubscribe?.();
            rejectPromise(new Error("Deployment finalized without a contracts.Instantiated address."));
            return;
          }
          const blockHash = result.status.asFinalized.toHex();
          void api.rpc.chain.getHeader(blockHash).then((header) => {
            resolvePromise({ address, receipt: { extrinsicHash: result.txHash.toHex(), blockHash, blockNumber: header.number.toString(), signer: operator.address, finalized: true, event: "contracts.Instantiated" } });
          }).catch(rejectPromise).finally(() => unsubscribe?.());
        }).then((stopListening: () => void) => { unsubscribe = stopListening; }).catch(rejectPromise);
      });
      await updateLocalEnv(args.mode, deployment.address);
      await mkdir(evidenceDir, { recursive: true });
      await writeFile(resolve(evidenceDir, args.mode + "-deployment.json"), JSON.stringify({
        schemaVersion: 1, network: "portaldot-v3-native", mode: args.mode, contractAddress: deployment.address,
        operator: operator.address, attester: attester.address, deployment: deployment.receipt,
        limitation: "The native contract deployment is real; Base inclusion is supplied by an explicit trusted SS58 attester, not proven by a light client.",
      }, null, 2) + "\n", "utf8");
      console.log("Native contract: " + deployment.address);
      console.log("Finalized deployment extrinsic: " + deployment.receipt.extrinsicHash);
      console.log("The local .env address variables were updated. Private keys remain local.");
      return;
    }

    if (!args.transferId) stop("Missing transfer ID.");
    const address = fixtureAddress(args.mode);
    const artifact = await readArtifact();
    const contract = new ContractPromise(api, artifact as any, address);
    let receipt: Receipt;
    let source: Record<string, unknown> | undefined;

    if (args.stage === "attest") {
      const locked = await verifySourceEvent("lock", args.mode, args.transferId, args.sourceTransaction!);
      const tx = (contract.tx as Record<string, (...values: any[]) => any>).attest_source_lock(
        { gasLimit: api.registry.createType("WeightV2", { refTime: "500000000000", proofSize: "8388608" }), storageDepositLimit: storageDepositLimit() },
        hexToU8a(args.transferId), hexToU8a(locked.transactionHash), hexToU8a(locked.blockHash),
        hexToU8a(locked.sourceFixture), hexToU8a(locked.user), locked.units,
      );
      receipt = await sendFinalized(api, attester, tx, "SourceLockAttested");
      source = { chainId: 84532, ...locked };
    } else if (args.stage === "refund") {
      const refunded = await verifySourceEvent("refund", args.mode, args.transferId, args.refundTransaction!);
      const tx = (contract.tx as Record<string, (...values: any[]) => any>).attest_source_refund(
        { gasLimit: api.registry.createType("WeightV2", { refTime: "500000000000", proofSize: "8388608" }), storageDepositLimit: storageDepositLimit() },
        hexToU8a(args.transferId), hexToU8a(refunded.transactionHash),
      );
      receipt = await sendFinalized(api, attester, tx, "SourceRefundAttested");
      source = { chainId: 84532, ...refunded };
    } else {
      const tx = (contract.tx as Record<string, (...values: any[]) => any>).fill(
        { gasLimit: api.registry.createType("WeightV2", { refTime: "500000000000", proofSize: "8388608" }), storageDepositLimit: storageDepositLimit() },
        hexToU8a(args.transferId),
      );
      receipt = await sendFinalized(api, operator, tx, "DestinationFilled");
    }

    await mkdir(evidenceDir, { recursive: true });
    const file = resolve(evidenceDir, args.mode + "-" + args.transferId.slice(2).toLowerCase() + ".json");
    let evidence: Record<string, any> = {};
    try { evidence = JSON.parse(await readFile(file, "utf8")); } catch { /* first stage */ }
    evidence.schemaVersion = 1;
    evidence.network = "portaldot-v3-native";
    evidence.mode = args.mode;
    evidence.transferId = args.transferId;
    evidence.contractAddress = address;
    evidence[args.stage] = receipt;
    if (source) evidence.baseSepolia = source;
    evidence.limitation = "Base receipts are verified off-chain by the trusted SS58 attester. The Portaldot call is a real native contracts-pallet transaction; no assets move and no Base light-client proof is claimed.";
    await writeFile(file, JSON.stringify(evidence, null, 2) + "\n", "utf8");
    console.log(receipt.event + " finalized on Portaldot: " + receipt.extrinsicHash);
    console.log("Containing block hash: " + receipt.blockHash);
    console.log("Local evidence: " + file);
    if (args.stage === "attest") console.log("Base Sepolia lock verified: " + (source as any)?.transactionHash);
  } finally {
    await api.disconnect();
  }
}

main().catch((error: unknown) => stop(error instanceof Error ? error.message : "Unexpected native contract error."));
