import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(projectRoot, "contracts/src/ReferenceRaceFixture.sol");
const operatorAddress = "0x000000000000000000000000000000000000dEaD" as Address;
const networks = {
  "base-sepolia": {
    chainId: 84_532,
    name: "Base Sepolia",
    currency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    rpcHost: "sepolia.base.org",
    explorerTx: "https://sepolia.basescan.org/tx/",
  },
  "portaldot-v3": {
    chainId: 420_420_777,
    name: "Portaldot V3 Testnet",
    currency: { name: "Portaldot test token", symbol: "POT", decimals: 18 },
    rpcEnv: "PORTALDOT_V3_EVM_RPC_URL",
    rpcHost: "test-evm-rpc-v3.portaldot.dev",
    explorerTx: null,
  },
} as const;

type NetworkName = keyof typeof networks;

function fail(message: string): never {
  console.error(`Vareq testnet deployment stopped: ${message}`);
  process.exit(1);
}

function readArgs(): { networkName: NetworkName; broadcast: boolean } {
  const args = process.argv.slice(2);
  const networkPosition = args.indexOf("--network");
  const rawNetwork = networkPosition >= 0 ? args[networkPosition + 1] : undefined;
  if (rawNetwork !== "base-sepolia" && rawNetwork !== "portaldot-v3") {
    fail("choose an explicit allowlisted network: --network base-sepolia or --network portaldot-v3");
  }
  const unknown = args.filter((arg) =>
    arg.startsWith("--") && arg !== "--network" && arg !== "--broadcast",
  );
  if (unknown.length) fail("only --network and --broadcast options are supported");
  return { networkName: rawNetwork, broadcast: args.includes("--broadcast") };
}

function rpcUrlFor(networkName: NetworkName): string {
  const config = networks[networkName];
  const value = process.env[config.rpcEnv]?.trim();
  if (!value) fail(`${config.rpcEnv} is missing`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${config.rpcEnv} is not a valid URL`);
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== config.rpcHost || parsed.username || parsed.password) {
    fail(`${config.rpcEnv} must use the fixed HTTPS host ${config.rpcHost}`);
  }
  return value;
}

async function compileFixture() {
  const source = await readFile(fixturePath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "ReferenceRaceFixture.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts?: Record<string, Record<string, {
      abi: readonly unknown[];
      evm: { bytecode: { object: string } };
    }>>;
  };
  const errors = output.errors?.filter((entry) => entry.severity === "error") ?? [];
  if (errors.length) fail(`Solidity compilation failed: ${errors.map((entry) => entry.formattedMessage).join("\n")}`);
  const artifact = output.contracts?.["ReferenceRaceFixture.sol"]?.ReferenceRaceFixture;
  if (!artifact?.evm.bytecode.object || !artifact.abi) fail("the Solidity compiler returned no fixture artifact");
  return {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}` as Hex,
  };
}

async function main() {
  const { networkName, broadcast } = readArgs();
  const config = networks[networkName];
  const rpcUrl = rpcUrlFor(networkName);
  const chain = defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: config.currency,
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 12_000 }) });
  const actualChainId = await publicClient.getChainId();
  if (actualChainId !== config.chainId) {
    fail(`${config.name} RPC reported chain ID ${actualChainId}; expected ${config.chainId}`);
  }
  const currentBlock = await publicClient.getBlockNumber();
  const receiptProbeResponse = await fetch(rpcUrl, {
    method: "POST",
    signal: AbortSignal.timeout(12_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [`0x${"0".repeat(64)}`],
    }),
  });
  const receiptProbe = await receiptProbeResponse.json() as {
    result?: unknown;
    error?: { message?: string };
  };
  if (!receiptProbeResponse.ok || receiptProbe.error || receiptProbe.result !== null) {
    fail(`${config.name} RPC did not return a valid not-found result for receipt lookup`);
  }
  const fixture = await compileFixture();
  console.log(`RPC verified: ${config.name} (chain ${actualChainId}, block ${currentBlock})`);
  console.log("Read-only transaction-receipt lookup verified (unknown transaction returns no receipt).");
  console.log(`Fixture compiled with solc ${solc.version()}. It has no token, bridge, or real-asset functionality.`);

  if (!broadcast) {
    console.log("Read-only preflight complete. Re-run with --broadcast only when you want to send the two testnet transactions.");
    return;
  }

  const rawKey = process.env.TESTNET_DEPLOYER_PRIVATE_KEY?.trim();
  if (!rawKey || !/^0x[0-9a-fA-F]{64}$/.test(rawKey)) {
    fail("set TESTNET_DEPLOYER_PRIVATE_KEY in the ignored local .env as a 0x-prefixed 32-byte key; it is never read from Vercel");
  }

  const account = privateKeyToAccount(rawKey as Hex);
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) fail(`the test signer ${account.address} has no native testnet gas token`);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl, { timeout: 12_000 }) });

  console.log(`Test signer: ${account.address}`);
  console.log("Deploying the patched educational fixture; this sends real testnet transactions and consumes testnet gas only.");
  const deploymentHash = await walletClient.deployContract({
    abi: fixture.abi,
    bytecode: fixture.bytecode,
    args: [account.address, operatorAddress, true, 1n],
    account,
    chain,
  });
  const deploymentReceipt = await publicClient.waitForTransactionReceipt({ hash: deploymentHash, timeout: 120_000 });
  if (deploymentReceipt.status !== "success" || !deploymentReceipt.contractAddress) {
    fail(`deployment transaction ${deploymentHash} did not produce a successful contract receipt`);
  }

  const lockHash = await walletClient.writeContract({
    address: deploymentReceipt.contractAddress,
    abi: fixture.abi,
    functionName: "lock",
    args: [1n],
    account,
    chain,
  });
  const lockReceipt = await publicClient.waitForTransactionReceipt({ hash: lockHash, timeout: 120_000 });
  if (lockReceipt.status !== "success") fail(`lock transaction ${lockHash} did not succeed`);

  const [isLocked, units] = await Promise.all([
    publicClient.readContract({ address: deploymentReceipt.contractAddress, abi: fixture.abi, functionName: "locked" }),
    publicClient.readContract({ address: deploymentReceipt.contractAddress, abi: fixture.abi, functionName: "referenceUnits" }),
  ]);
  if (!isLocked || units !== 1n) fail("the deployed fixture did not report the expected locked reference state");

  const evidence = {
    evidenceMode: "public-testnet",
    note: "Real EVM testnet contract deployment and reference lock. This is a valueless single-chain fixture, not a cross-chain bridge or asset transfer.",
    network: networkName,
    chainId: actualChainId,
    signerAddress: account.address,
    contractAddress: deploymentReceipt.contractAddress,
    deployment: {
      transactionHash: deploymentHash,
      blockNumber: deploymentReceipt.blockNumber.toString(),
      blockHash: deploymentReceipt.blockHash,
      status: deploymentReceipt.status,
      explorerUrl: config.explorerTx ? `${config.explorerTx}${deploymentHash}` : null,
    },
    lock: {
      referenceUnits: "1",
      transactionHash: lockHash,
      blockNumber: lockReceipt.blockNumber.toString(),
      blockHash: lockReceipt.blockHash,
      status: lockReceipt.status,
      explorerUrl: config.explorerTx ? `${config.explorerTx}${lockHash}` : null,
    },
    verifiedState: { locked: isLocked, referenceUnits: units.toString() },
    createdAt: new Date().toISOString(),
  };
  const evidenceDirectory = resolve(projectRoot, "evidence/testnet");
  await mkdir(evidenceDirectory, { recursive: true });
  const evidencePath = resolve(evidenceDirectory, `${networkName}-${deploymentHash.slice(2, 12)}.json`);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  console.log(`Deployment receipt: ${deploymentHash}`);
  console.log(`Lock receipt: ${lockHash}`);
  console.log(`Verified locked state at ${deploymentReceipt.contractAddress}`);
  console.log(`Evidence saved without secrets to ${evidencePath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unexpected failure";
  fail(message);
});
