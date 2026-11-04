import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbiItem,
  parseEventLogs,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "contracts/src/LiveCrossChainFixtures.sol");
const manifestPath = resolve(root, "work/live-testnet-deployments.json");
const runsDir = resolve(root, "work/live-testnet-runs");
const SOURCE_LOCK_EVENT = parseAbiItem("event Locked(bytes32 indexed transferId,address indexed user,uint256 units)");
const SOURCE_REFUND_EVENT = parseAbiItem("event Refunded(bytes32 indexed transferId,address indexed user,uint256 units)");

const networks = {
  base: {
    name: "Base Sepolia",
    id: 84_532,
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    rpcHost: "sepolia.base.org",
    currency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    explorerTx: "https://sepolia.basescan.org/tx/",
  },
  portaldot: {
    name: "Portaldot V3 Testnet",
    id: 420_420_777,
    rpcEnv: "PORTALDOT_V3_EVM_RPC_URL",
    rpcHost: "test-evm-rpc-v3.portaldot.dev",
    currency: { name: "tPOTv3", symbol: "tPOT", decimals: 14 },
    explorerTx: null,
  },
} as const;

type Mode = "vulnerable" | "patched";
type Stage = "authorize" | "settle";
type RecordRef = { address: Address; transactionHash: Hex; blockNumber: string };
type Deployments = {
  schemaVersion: number;
  status: string;
  chainIds: { base: number; portaldot: number };
  operatorAddress: Address;
  attesterAddress: Address;
  contracts: Record<Mode, { source?: RecordRef; destination?: RecordRef }>;
};
type InternalRun = {
  schemaVersion: 1;
  mode: Mode;
  transferId: Hex;
  user: Address;
  units: string;
  sourceFixture: Address;
  destinationFixture: Address;
  sourceLock: Hex;
  sourceAuthorization: Hex;
  permitSignature: Hex;
  createdAt: string;
  operatorAddress: Address;
  attesterAddress: Address;
};

function stop(message: string): never {
  console.error(`Live operator run stopped: ${message}`);
  process.exit(1);
}

function readArgs(): { stage: Stage; mode: Mode; transferId: Hex; sourceLock?: Hex; approved: boolean } {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const name = args[i].slice(2);
    if (name === "approve") { values.set(name, "true"); continue; }
    const value = args[i + 1];
    if (!value || value.startsWith("--")) stop(`--${name} needs a value.`);
    values.set(name, value);
    i++;
  }
  const stage = values.get("stage");
  const mode = values.get("mode");
  const transferId = values.get("transfer-id");
  const sourceLock = values.get("source-lock");
  if (stage !== "authorize" && stage !== "settle") stop("Choose --stage authorize or --stage settle.");
  if (mode !== "vulnerable" && mode !== "patched") stop("Choose --mode vulnerable or --mode patched.");
  if (!transferId || !/^0x[0-9a-fA-F]{64}$/.test(transferId)) stop("--transfer-id must be a 32-byte 0x-prefixed hash from the user's lock action.");
  if (sourceLock && !/^0x[0-9a-fA-F]{64}$/.test(sourceLock)) stop("--source-lock must be a 32-byte transaction hash.");
  if (stage === "authorize" && !sourceLock) stop("--stage authorize requires the user's confirmed --source-lock transaction hash.");
  if (values.get("approve") !== "true") stop("Live transactions require the operator's explicit --approve flag on every stage.");
  return { stage, mode, transferId: transferId as Hex, sourceLock: sourceLock as Hex | undefined, approved: true };
}

function rpcUrl(network: keyof typeof networks): string {
  const config = networks[network];
  const value = process.env[config.rpcEnv]?.trim();
  if (!value) stop(`${config.rpcEnv} is missing.`);
  let parsed: URL;
  try { parsed = new URL(value); } catch { stop(`${config.rpcEnv} is not a valid URL.`); }
  if (parsed.protocol !== "https:" || parsed.hostname !== config.rpcHost || parsed.username || parsed.password) {
    stop(`${config.rpcEnv} must use the fixed HTTPS host ${config.rpcHost}.`);
  }
  return value;
}

function readKey(name: string): Hex {
  const value = process.env[name]?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    stop(`${name} must be a separate disposable EVM test key in 0x plus 64 hexadecimal characters, stored only in the ignored local .env.`);
  }
  return value as Hex;
}

function makeClients(network: keyof typeof networks, url: string, account: ReturnType<typeof privateKeyToAccount>) {
  const config = networks[network];
  const chain = defineChain({
    id: config.id,
    name: config.name,
    nativeCurrency: config.currency,
    rpcUrls: { default: { http: [url] } },
  });
  return {
    chain,
    publicClient: createPublicClient({ chain, transport: http(url, { timeout: 20_000 }) }),
    walletClient: createWalletClient({ account, chain, transport: http(url, { timeout: 20_000 }) }),
  };
}

async function compileAbis(): Promise<{ source: Abi; destination: Abi }> {
  const content = await readFile(sourcePath, "utf8");
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources: { "LiveCrossChainFixtures.sol": { content } },
    settings: { outputSelection: { "*": { "*": ["abi"] } } },
  }))) as {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts?: Record<string, Record<string, { abi: readonly unknown[] }>>;
  };
  const errors = output.errors?.filter((entry) => entry.severity === "error") ?? [];
  if (errors.length) stop(`Solidity compilation failed:\n${errors.map((entry) => entry.formattedMessage).join("\n")}`);
  const compiled = output.contracts?.["LiveCrossChainFixtures.sol"];
  const source = compiled?.TestnetSourceFixture?.abi;
  const destination = compiled?.TestnetDestinationFixture?.abi;
  if (!source || !destination) stop("Solidity compiler did not return both live fixture ABIs.");
  return { source: source as Abi, destination: destination as Abi };
}

async function readDeployments(): Promise<Deployments> {
  let data: Deployments;
  try { data = JSON.parse(await readFile(manifestPath, "utf8")) as Deployments; }
  catch { return stop("Run `bun run testnet:deploy:crosschain` and keep its local deployment manifest before operating."); }
  if (data.status !== "complete" || data.chainIds.base !== networks.base.id || data.chainIds.portaldot !== networks.portaldot.id) {
    stop("The local deployment manifest is incomplete or has unexpected chain IDs.");
  }
  return data;
}

function runFile(mode: Mode, transferId: Hex, suffix: "internal" | "public"): string {
  return resolve(runsDir, `${mode}-${transferId.slice(2).toLowerCase()}.${suffix}.json`);
}

async function savePublicArtifact(run: InternalRun, fields: Record<string, unknown>) {
  const out = {
    schemaVersion: 1,
    evidenceMode: "observed-testnet-transactions",
    mode: run.mode,
    chainIds: { source: networks.base.id, destination: networks.portaldot.id },
    transferId: run.transferId,
    userAddress: run.user,
    operatorAddress: run.operatorAddress,
    attesterAddress: run.attesterAddress,
    sourceFixture: run.sourceFixture,
    destinationFixture: run.destinationFixture,
    sourceLock: { transactionHash: run.sourceLock, explorerUrl: networks.base.explorerTx + run.sourceLock },
    sourceFillAuthorization: { transactionHash: run.sourceAuthorization, explorerUrl: networks.base.explorerTx + run.sourceAuthorization },
    observedAt: new Date().toISOString(),
    limitations: [
      "The fixtures store valueless integer units and move no token or real asset.",
      "The attester is a trusted manual signer, not a light client, bridge, or proof of cross-chain finality.",
      "Public testnet ordering and inclusion are not deterministic.",
    ],
    ...fields,
  };
  await mkdir(runsDir, { recursive: true });
  await writeFile(runFile(run.mode, run.transferId, "public"), JSON.stringify(out, null, 2) + "\n", "utf8");
}

async function main() {
  const { stage, mode, transferId, sourceLock } = readArgs();
  const manifest = await readDeployments();
  const sourceRecord = manifest.contracts[mode].source;
  const destinationRecord = manifest.contracts[mode].destination;
  if (!sourceRecord || !destinationRecord) stop(`The ${mode} source/destination contracts are missing from the deployment manifest.`);

  const operator = privateKeyToAccount(readKey("OPERATOR_PRIVATE_KEY"));
  const attester = privateKeyToAccount(readKey("ATTESTER_PRIVATE_KEY"));
  if (
    operator.address.toLowerCase() !== manifest.operatorAddress.toLowerCase() ||
    attester.address.toLowerCase() !== manifest.attesterAddress.toLowerCase()
  ) stop("The local operator/attester keys do not match the roles configured in the deployed fixtures.");

  const baseRpc = rpcUrl("base");
  const portaldotRpc = rpcUrl("portaldot");
  const base = makeClients("base", baseRpc, operator);
  const portaldot = makeClients("portaldot", portaldotRpc, operator);
  const [baseChainId, portaldotChainId] = await Promise.all([base.publicClient.getChainId(), portaldot.publicClient.getChainId()]);
  if (baseChainId !== networks.base.id || portaldotChainId !== networks.portaldot.id) stop("RPC chain identity changed; no action was sent.");
  const [baseOperatorBalance, destinationOperatorBalance] = await Promise.all([
    base.publicClient.getBalance({ address: operator.address }),
    portaldot.publicClient.getBalance({ address: operator.address }),
  ]);
  if (baseOperatorBalance === 0n || destinationOperatorBalance === 0n) stop("The operator needs test gas on both networks; no action was sent.");

  const { source: sourceAbi, destination: destinationAbi } = await compileAbis();
  let run: InternalRun;

  if (stage === "authorize") {
    const receipt = await base.publicClient.getTransactionReceipt({ hash: sourceLock! });
    if (receipt.status !== "success" || receipt.to?.toLowerCase() !== sourceRecord.address.toLowerCase()) {
      stop("The supplied lock transaction is not a successful call to this mode's Base Sepolia source fixture.");
    }
    const matchingLog = (parseEventLogs({ abi: [SOURCE_LOCK_EVENT], eventName: "Locked", logs: receipt.logs, strict: false }) as unknown as Array<{
      args: { transferId?: Hex; user?: Address; units?: bigint };
    }>).find((entry) => entry.args.transferId?.toLowerCase() === transferId.toLowerCase());
    if (!matchingLog?.args.user || matchingLog.args.units === undefined) stop("The source receipt does not contain this transfer's lock event.");
    const [user, units, exists, fillAuthorized, refunded, reimbursed] = await base.publicClient.readContract({
      address: sourceRecord.address,
      abi: sourceAbi,
      functionName: "getTransfer",
      args: [transferId],
    }) as readonly [Address, bigint, boolean, boolean, boolean, boolean];
    if (!exists || user.toLowerCase() !== matchingLog.args.user.toLowerCase() || units !== matchingLog.args.units || fillAuthorized || reimbursed) {
      stop("Current Base source state does not match the confirmed lock event, or it has already advanced.");
    }
    if (mode === "patched" && refunded) stop("This patched transfer was refunded before operator approval; no destination fill will be authorized.");
    if (units === 0n || units > 10n) stop("The fixture's hard cap is 10 valueless units.");

    const permitHash = await base.publicClient.readContract({
      address: sourceRecord.address,
      abi: sourceAbi,
      functionName: "fillPermitMessageHash",
      args: [transferId],
    }) as Hex;
    const permitSignature = await attester.signMessage({ message: { raw: permitHash } });
    const authorizationHash = await base.walletClient.writeContract({
      address: sourceRecord.address,
      abi: sourceAbi,
      functionName: "authorizeFill",
      args: [transferId, permitSignature],
      account: operator,
      chain: base.chain,
    });
    const authorizationReceipt = await base.publicClient.waitForTransactionReceipt({ hash: authorizationHash, confirmations: 1, timeout: 180_000 });
    if (authorizationReceipt.status !== "success") stop("The source authorization transaction reverted; no destination fill should be sent.");
    run = {
      schemaVersion: 1,
      mode,
      transferId,
      user,
      units: units.toString(),
      sourceFixture: sourceRecord.address,
      destinationFixture: destinationRecord.address,
      sourceLock: sourceLock!,
      sourceAuthorization: authorizationHash,
      permitSignature,
      createdAt: new Date().toISOString(),
      operatorAddress: operator.address,
      attesterAddress: attester.address,
    };
    await mkdir(runsDir, { recursive: true });
    await writeFile(runFile(mode, transferId, "internal"), JSON.stringify(run, null, 2) + "\n", "utf8");
    await savePublicArtifact(run, {
      status: refunded ? "refunded-before-fill" : "fill-authorized-awaiting-operator",
      sourceRefund: { observed: refunded },
      destinationFill: { status: "not-submitted" },
      sourceClaim: { status: "not-submitted" },
    });
    console.log(`Source lock verified: ${sourceLock}`);
    console.log(`Source fill authorization: ${authorizationHash}`);
    console.log(`Local operator record: ${runFile(mode, transferId, "internal")}`);
    console.log("Stage complete. In vulnerable mode, the user may now submit the source refund before the operator runs the settle stage.");
    return;
  }

  try { run = JSON.parse(await readFile(runFile(mode, transferId, "internal"), "utf8")) as InternalRun; }
  catch { return stop("No local authorization record exists for this transfer. Run the authorize stage first."); }
  if (run.mode !== mode || run.transferId.toLowerCase() !== transferId.toLowerCase()) stop("Local operator record does not match this run.");

  const [user, units, exists, fillAuthorized, refunded] = await base.publicClient.readContract({
    address: sourceRecord.address,
    abi: sourceAbi,
    functionName: "getTransfer",
    args: [transferId],
  }) as readonly [Address, bigint, boolean, boolean, boolean, boolean];
  if (!exists || !fillAuthorized || user.toLowerCase() !== run.user.toLowerCase() || units.toString() !== run.units) {
    stop("The Base source state no longer matches the manually approved operator record.");
  }
  if (mode === "patched" && refunded) stop("Patched source is refunded; operator will not fill the destination.");
  const configuredSource = await portaldot.publicClient.readContract({
    address: destinationRecord.address,
    abi: destinationAbi,
    functionName: "sourceFixture",
  });
  if ((configuredSource as string).toLowerCase() !== sourceRecord.address.toLowerCase()) stop("The Portaldot destination points at a different Base source fixture.");
  const [existingFillUser, existingFillUnits, alreadyFilled] = await portaldot.publicClient.readContract({
    address: destinationRecord.address,
    abi: destinationAbi,
    functionName: "getFill",
    args: [transferId],
  }) as readonly [Address, bigint, boolean];
  if (alreadyFilled) stop(`This transfer is already filled on Portaldot for ${existingFillUser} (${existingFillUnits} units).`);

  const fillHash = await portaldot.walletClient.writeContract({
    address: destinationRecord.address,
    abi: destinationAbi,
    functionName: "fill",
    args: [transferId, user, units, run.permitSignature],
    account: operator,
    chain: portaldot.chain,
  });
  const fillReceipt = await portaldot.publicClient.waitForTransactionReceipt({ hash: fillHash, confirmations: 1, timeout: 180_000 });
  if (fillReceipt.status !== "success") stop("The Portaldot destination fill reverted; no source claim was sent.");

  const sourceRefunds = await base.publicClient.getLogs({
    address: sourceRecord.address,
    event: SOURCE_REFUND_EVENT,
    args: { transferId },
    fromBlock: BigInt(sourceRecord.blockNumber),
    toBlock: "latest",
  });
  const refundRecords = sourceRefunds.map((entry) => ({
    transactionHash: entry.transactionHash,
    blockNumber: entry.blockNumber?.toString() ?? null,
    blockHash: entry.blockHash,
    explorerUrl: entry.transactionHash ? networks.base.explorerTx + entry.transactionHash : null,
  }));

  if (refunded || refundRecords.length > 0) {
    await savePublicArtifact(run, {
      status: "violation-observed",
      sourceRefund: { observed: true, receipts: refundRecords },
      destinationFill: {
        transactionHash: fillHash,
        blockNumber: fillReceipt.blockNumber.toString(),
        blockHash: fillReceipt.blockHash,
        status: "success",
        explorerUrl: null,
      },
      sourceClaim: { status: "not-submitted", reason: "The source refund is final in the current fixture state, so claim cannot reimburse the operator." },
      verifiedState: { sourceRefunded: true, destinationFilled: true, operatorReimbursed: false },
    });
    console.log(`Portaldot destination fill: ${fillHash}`);
    console.log("Observed outcome: source refunded and destination filled. No source claim was submitted because the source fixture cannot reimburse after refund.");
    console.log(`Sanitised live evidence: ${runFile(mode, transferId, "public")}`);
    return;
  }

  const attestationHash = await base.publicClient.readContract({
    address: sourceRecord.address,
    abi: sourceAbi,
    functionName: "fillAttestationMessageHash",
    args: [transferId, fillHash],
  }) as Hex;
  const fillSignature = await attester.signMessage({ message: { raw: attestationHash } });
  const claimHash = await base.walletClient.writeContract({
    address: sourceRecord.address,
    abi: sourceAbi,
    functionName: "claim",
    args: [transferId, fillHash, fillSignature],
    account: operator,
    chain: base.chain,
  });
  const claimReceipt = await base.publicClient.waitForTransactionReceipt({ hash: claimHash, confirmations: 1, timeout: 180_000 });
  if (claimReceipt.status !== "success") stop("The Base source claim failed after a successful Portaldot fill.");

  const [finalUser, finalUnits, finalExists, finalAuthorization, finalRefund, finalReimbursed] = await base.publicClient.readContract({
    address: sourceRecord.address,
    abi: sourceAbi,
    functionName: "getTransfer",
    args: [transferId],
  }) as readonly [Address, bigint, boolean, boolean, boolean, boolean];
  const [, , finalDestinationFilled] = await portaldot.publicClient.readContract({
    address: destinationRecord.address,
    abi: destinationAbi,
    functionName: "getFill",
    args: [transferId],
  }) as readonly [Address, bigint, boolean];
  const outcome = finalExists && finalUser.toLowerCase() === user.toLowerCase() && finalUnits === units &&
    finalAuthorization && !finalRefund && finalDestinationFilled && finalReimbursed ? "complete-within-fixture" : "incomplete";
  await savePublicArtifact(run, {
    status: outcome,
    sourceRefund: { observed: finalRefund, receipts: refundRecords },
    destinationFill: {
      transactionHash: fillHash,
      blockNumber: fillReceipt.blockNumber.toString(),
      blockHash: fillReceipt.blockHash,
      status: "success",
      explorerUrl: null,
    },
    sourceClaim: {
      transactionHash: claimHash,
      blockNumber: claimReceipt.blockNumber.toString(),
      blockHash: claimReceipt.blockHash,
      status: "success",
      explorerUrl: networks.base.explorerTx + claimHash,
    },
    verifiedState: { sourceRefunded: finalRefund, destinationFilled: finalDestinationFilled, operatorReimbursed: finalReimbursed },
  });
  console.log(`Portaldot destination fill: ${fillHash}`);
  console.log(`Base source claim: ${claimHash}`);
  console.log(`Observed outcome: ${outcome}`);
  console.log(`Sanitised live evidence: ${runFile(mode, transferId, "public")}`);
}

main().catch((error) => stop(error instanceof Error ? error.message : "Unexpected operator error."));
