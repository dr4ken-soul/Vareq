import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import type { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { stringToU8a, u8aToHex } from "@polkadot/util";
import { createPublicClient, http, parseAbiItem, parseEventLogs, type Hex } from "viem";
import { baseSepolia } from "viem/chains";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runsDir = resolve(root, "work/portaldot-native-runs");
const nativeRpc = process.env.PORTALDOT_V3_NATIVE_WS_URL?.trim() || "wss://test-node-v3.portaldot.dev";
const baseRpc = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
const LOCKED_EVENT = parseAbiItem("event Locked(bytes32 indexed transferId,address indexed user,uint256 units)");

type Mode = "patched" | "vulnerable";
type Stage = "attest" | "fill";
type NativeReceipt = {
  extrinsicHash: string;
  blockHash: string;
  blockNumber: string;
  signer: string;
  finalized: true;
  events: Array<{ section: string; method: string }>;
};
type NativeEvidence = {
  schemaVersion: 1;
  evidenceMode: "native-substrate-marker";
  status: "attested" | "native-marker-observed";
  mode: Mode;
  transferId: Hex;
  baseSepolia: { chainId: 84532; lockHash: Hex; sourceFixture: string; user: string; units: string; status: "success" };
  portaldotV3: { chain: "PortaldotV3 Test"; specName: "portaldot-v3"; specVersion: number; nativeToken: "tPOT"; decimals: number; attester?: NativeReceipt; operator?: NativeReceipt };
  limitation: string;
};
type NativeEventRecord = {
  phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number } };
  event: { section: string; method: string };
};

function stop(message: string): never {
  console.error(`Native Portaldot evidence stopped: ${message}`);
  process.exit(1);
}

function readArgs(): { stage: Stage; mode: Mode; transferId: Hex; baseLock: Hex; approved: boolean } {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    if (!args[index].startsWith("--")) continue;
    const key = args[index].slice(2);
    if (key === "approve" || key === "broadcast") { values.set(key, "true"); continue; }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) stop(`--${key} needs a value.`);
    values.set(key, value);
    index++;
  }
  const stage = values.get("stage");
  const mode = values.get("mode");
  const transferId = values.get("transfer-id");
  const baseLock = values.get("base-lock");
  if (stage !== "attest" && stage !== "fill") stop("Choose --stage attest or --stage fill.");
  if (mode !== "patched" && mode !== "vulnerable") stop("Choose --mode patched or --mode vulnerable.");
  if (!transferId || !/^0x[a-fA-F0-9]{64}$/.test(transferId)) stop("--transfer-id must be a 32-byte transfer ID.");
  if (!baseLock || !/^0x[a-fA-F0-9]{64}$/.test(baseLock)) stop("--base-lock must be the Base Sepolia lock transaction hash.");
  if (values.get("approve") !== "true" || values.get("broadcast") !== "true") {
    stop("Native transactions require both --approve and --broadcast. Without them, no transaction is submitted.");
  }
  return { stage, mode, transferId: transferId as Hex, baseLock: baseLock as Hex, approved: true };
}

function nativeRpcUrl(): string {
  let parsed: URL;
  try { parsed = new URL(nativeRpc); } catch { stop("PORTALDOT_V3_NATIVE_WS_URL is not a valid websocket URL."); }
  if (parsed.protocol !== "wss:" || parsed.hostname !== "test-node-v3.portaldot.dev" || parsed.username || parsed.password) {
    stop("PORTALDOT_V3_NATIVE_WS_URL must use the fixed Portaldot V3 websocket host.");
  }
  return nativeRpc;
}

function baseRpcUrl(): string {
  let parsed: URL;
  try { parsed = new URL(baseRpc); } catch { stop("BASE_SEPOLIA_RPC_URL is not a valid URL."); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "sepolia.base.org" || parsed.username || parsed.password) {
    stop("BASE_SEPOLIA_RPC_URL must use the fixed Base Sepolia read endpoint.");
  }
  return baseRpc;
}

async function loadNativeSigner(role: "OPERATOR" | "ATTESTER"): Promise<KeyringPair> {
  const pathValue = process.env[`PORTALDOT_NATIVE_${role}_KEYSTORE_PATH`]?.trim();
  const password = process.env[`PORTALDOT_NATIVE_${role}_KEYSTORE_PASSWORD`];
  if (!pathValue || !password) stop(`Set PORTALDOT_NATIVE_${role}_KEYSTORE_PATH and PORTALDOT_NATIVE_${role}_KEYSTORE_PASSWORD in the ignored local .env.`);
  const keyPath = resolve(pathValue);
  const relativePath = relative(root, keyPath);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    stop(`Keep the encrypted ${role.toLowerCase()} wallet JSON outside the repository.`);
  }
  let json: unknown;
  try { json = JSON.parse(await readFile(keyPath, "utf8")); }
  catch { stop(`Could not read the encrypted ${role.toLowerCase()} wallet JSON file. Keep that file outside the repository.`); }
  await cryptoWaitReady();
  try {
    const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
    const pair = keyring.addFromJson(json as Parameters<Keyring["addFromJson"]>[0]);
    pair.decodePkcs8(password);
    return pair;
  } catch {
    stop(`The ${role.toLowerCase()} wallet JSON or its local password could not be unlocked.`);
  }
}

async function verifyBaseLock(mode: Mode, transferId: Hex, lockHash: Hex) {
  const sourceVariable = mode === "patched"
    ? "VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS"
    : "VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS";
  const configuredAddress = process.env[sourceVariable]?.trim().toLowerCase();
  if (!configuredAddress || !/^0x[a-f0-9]{40}$/.test(configuredAddress)) stop(`${sourceVariable} is missing or invalid.`);
  const client = createPublicClient({ chain: baseSepolia, transport: http(baseRpcUrl(), { timeout: 20_000 }) });
  if (await client.getChainId() !== 84_532) stop("The configured source RPC is not Base Sepolia.");
  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash: lockHash }); }
  catch { stop("The supplied Base lock transaction was not found."); }
  if (receipt.status !== "success" || receipt.to?.toLowerCase() !== configuredAddress) stop("The Base transaction is not a successful call to the selected Vareq source fixture.");
  const lock = (parseEventLogs({ abi: [LOCKED_EVENT], eventName: "Locked", logs: receipt.logs, strict: false }) as unknown as Array<{
    args: { transferId?: Hex; user?: string; units?: bigint };
  }>).find((entry) => entry.args.transferId?.toLowerCase() === transferId.toLowerCase());
  if (!lock?.args.user || lock.args.units === undefined) stop("The selected Base receipt does not contain this transfer's Locked event.");
  return { user: lock.args.user, units: lock.args.units.toString(), sourceFixture: configuredAddress };
}

async function save(filePath: string, evidence: NativeEvidence) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
}

async function submitRemark(api: ApiPromise, signer: KeyringPair, marker: string): Promise<NativeReceipt> {
  const account = await api.query.system.account(signer.address);
  const extrinsic = api.tx.system.remarkWithEvent(u8aToHex(stringToU8a(marker)));
  const payment = await extrinsic.paymentInfo(signer);
  const free = (account as unknown as { data: { free: { toBigInt(): bigint } } }).data.free.toBigInt();
  const fee = (payment as unknown as { partialFee: { toBigInt(): bigint } }).partialFee.toBigInt();
  const existentialDeposit = (api.consts.balances.existentialDeposit as unknown as { toBigInt(): bigint }).toBigInt();
  if (free < fee + existentialDeposit) {
    stop(`${signer.address} needs native tPOT for this transaction (balance ${free.toString()} base units; estimated fee ${fee.toString()}; keep ${existentialDeposit.toString()} for the account minimum).`);
  }

  const result = await new Promise<NativeReceipt>((resolvePromise, rejectPromise) => {
    let unsubscribe: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsubscribe?.();
      rejectPromise(new Error("Portaldot did not finalize the native transaction within 3 minutes."));
    }, 180_000);
    void extrinsic.signAndSend(signer, {}, (result) => {
      const { status, events, dispatchError } = result;
      if (!status.isFinalized) return;
      clearTimeout(timer);
      const blockHash = status.asFinalized.toHex();
      const succeeded = events.some(({ event }) => event.section === "system" && event.method === "ExtrinsicSuccess");
      if (dispatchError || !succeeded) {
        unsubscribe?.();
        rejectPromise(new Error("The native Portaldot extrinsic was finalized but failed."));
        return;
      }
      void api.rpc.chain.getBlock(blockHash).then((block) => {
        const extrinsicHash = extrinsic.hash.toHex();
        const index = block.block.extrinsics.findIndex((item) => item.hash.toHex() === extrinsicHash);
        if (index < 0) throw new Error("The finalized Portaldot block does not contain the submitted extrinsic.");
        resolvePromise({
          extrinsicHash,
          blockHash,
          blockNumber: block.block.header.number.toString(),
          signer: signer.address,
          finalized: true,
          events: events.map(({ event }) => ({ section: event.section, method: event.method })),
        });
      }).catch(rejectPromise).finally(() => unsubscribe?.());
    }).then((stopListening) => { unsubscribe = stopListening; }).catch((error: unknown) => {
      clearTimeout(timer);
      unsubscribe?.();
      rejectPromise(error);
    });
  });
  return result;
}

async function readExistingNativeReceipt(api: ApiPromise, receipt: NativeReceipt, expectedPrefix: string): Promise<void> {
  const block = await api.rpc.chain.getBlock(receipt.blockHash);
  const index = block.block.extrinsics.findIndex((extrinsic) => extrinsic.hash.toHex().toLowerCase() === receipt.extrinsicHash.toLowerCase());
  if (index < 0) stop("The saved attester transaction is not in its recorded Portaldot block.");
  const extrinsic = block.block.extrinsics[index];
  if (!extrinsic.isSigned || extrinsic.signer.toString() !== receipt.signer || extrinsic.method.section !== "system" || extrinsic.method.method !== "remarkWithEvent") {
    stop("The saved attester record is not the expected signed native Portaldot remark.");
  }
  const remark = extrinsic.method.args[0].toU8a(true);
  const decoded = new TextDecoder().decode(remark);
  if (!decoded.startsWith(expectedPrefix)) stop("The attester remark does not match the selected transfer and Base lock.");
  const events = await api.query.system.events.at(receipt.blockHash) as unknown as NativeEventRecord[];
  const failed = events.some((record) => record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.toNumber() === index && record.event.section === "system" && record.event.method === "ExtrinsicFailed");
  const succeeded = events.some((record) => record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.toNumber() === index && record.event.section === "system" && record.event.method === "ExtrinsicSuccess");
  if (failed || !succeeded) stop("The saved attester transaction does not have a successful native receipt.");
}

async function main() {
  const args = readArgs();
  const source = await verifyBaseLock(args.mode, args.transferId, args.baseLock);
  const api = await ApiPromise.create({ provider: new WsProvider(nativeRpcUrl()), noInitWarn: true });
  try {
    const [chain, specName, specVersion, properties] = await Promise.all([
      api.rpc.system.chain(), api.runtimeVersion.specName, api.runtimeVersion.specVersion, api.rpc.system.properties(),
    ]);
    if (chain.toString() !== "PortaldotV3 Test" || specName.toString() !== "portaldot-v3" || specVersion.toNumber() !== 3002) {
      stop(`The native websocket identity is unexpected (chain ${chain}, spec ${specName}, version ${specVersion}).`);
    }
    const nativeTokens = properties.tokenSymbol.toJSON() as string[];
    const nativeDecimals = properties.tokenDecimals.toJSON() as number[];
    if (nativeTokens[0] !== "tPOT" || nativeDecimals[0] !== 14) stop("The native Portaldot token metadata did not match the verified V3 testnet response.");

    const artifactPath = resolve(runsDir, `${args.mode}-${args.transferId.slice(2).toLowerCase()}.json`);
    const markerPrefix = `VAREQ/1|${args.mode}|${args.transferId.toLowerCase()}|${args.baseLock.toLowerCase()}|`;
    const limitation = "This native system remark is correlated public-chain evidence only. It is not a Portaldot destination contract call, bridge fill, asset transfer, or proof of cross-chain finality.";
    let evidence: NativeEvidence;

    if (args.stage === "attest") {
      const attester = await loadNativeSigner("ATTESTER");
      const marker = `${markerPrefix}ATTEST|${source.sourceFixture.toLowerCase()}|${source.user.toLowerCase()}|${source.units}`;
      const receipt = await submitRemark(api, attester, marker);
      evidence = {
        schemaVersion: 1,
        evidenceMode: "native-substrate-marker",
        status: "attested",
        mode: args.mode,
        transferId: args.transferId,
        baseSepolia: { chainId: 84_532, lockHash: args.baseLock, sourceFixture: source.sourceFixture, user: source.user, units: source.units, status: "success" },
        portaldotV3: { chain: "PortaldotV3 Test", specName: "portaldot-v3", specVersion: specVersion.toNumber(), nativeToken: "tPOT", decimals: 14, attester: receipt },
        limitation,
      };
      await save(artifactPath, evidence);
      console.log(`Verified Base Sepolia lock for transfer ${args.transferId}: ${args.baseLock}`);
      console.log(`Native attester remark finalized on Portaldot: ${receipt.extrinsicHash}`);
      console.log(`Containing block: ${receipt.blockHash}`);
      console.log(`Local evidence: ${artifactPath}`);
      return;
    }

    try { evidence = JSON.parse(await readFile(artifactPath, "utf8")) as NativeEvidence; }
    catch { return stop("Run the native attest stage first; no matching local attester evidence exists."); }
    if (evidence.transferId.toLowerCase() !== args.transferId.toLowerCase() || evidence.baseSepolia.lockHash.toLowerCase() !== args.baseLock.toLowerCase() || evidence.mode !== args.mode || !evidence.portaldotV3.attester) {
      stop("The saved attester evidence does not match the selected Base lock and transfer.");
    }
    const operator = await loadNativeSigner("OPERATOR");
    if (operator.address === evidence.portaldotV3.attester.signer) stop("Native operator and attester must be distinct SS58 accounts.");
    const expectedAttesterMarker = `${markerPrefix}ATTEST|${source.sourceFixture.toLowerCase()}|${source.user.toLowerCase()}|${source.units}`;
    await readExistingNativeReceipt(api, evidence.portaldotV3.attester, expectedAttesterMarker);
    const marker = `${markerPrefix}FILL|${evidence.portaldotV3.attester.extrinsicHash.toLowerCase()}`;
    const receipt = await submitRemark(api, operator, marker);
    evidence.status = "native-marker-observed";
    evidence.portaldotV3.operator = receipt;
    await save(artifactPath, evidence);
    console.log(`Native operator remark finalized on Portaldot: ${receipt.extrinsicHash}`);
    console.log(`Containing block: ${receipt.blockHash}`);
    console.log(`Local evidence: ${artifactPath}`);
    console.log(limitation);
  } finally {
    await api.disconnect();
  }
}

main().catch((error: unknown) => stop(error instanceof Error ? error.message : "Unexpected native Portaldot error."));
