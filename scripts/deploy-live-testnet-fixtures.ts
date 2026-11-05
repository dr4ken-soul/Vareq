import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "contracts/src/LiveCrossChainFixtures.sol");
const manifestPath = resolve(root, "work/live-testnet-deployments.json");

const networks = {
  base: {
    name: "Base Sepolia",
    id: 84_532,
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    rpcHost: "sepolia.base.org",
    currency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  portaldot: {
    name: "Portaldot V3 Testnet",
    id: 420_420_777,
    rpcEnv: "PORTALDOT_V3_EVM_RPC_URL",
    rpcHost: "test-evm-rpc-v3.portaldot.dev",
    currency: { name: "tPOTv3", symbol: "tPOT", decimals: 14 },
  },
} as const;

type NetworkKey = keyof typeof networks;
type DeploymentRecord = { address: Address; transactionHash: Hex; blockNumber: string };
type Manifest = {
  schemaVersion: 1;
  evidenceMode: "public-testnet";
  createdAt: string;
  status: "deploying" | "complete" | "incomplete";
  chainIds: { base: number; portaldot: number };
  deployerAddress: Address;
  operatorAddress: Address;
  attesterAddress: Address;
  contracts: {
    vulnerable: { source?: DeploymentRecord; destination?: DeploymentRecord; destinationSourceBinding?: Hex };
    patched: { source?: DeploymentRecord; destination?: DeploymentRecord; destinationSourceBinding?: Hex };
  };
  limitation: string;
};

function stop(message: string): never {
  console.error(`Live fixture deployment stopped: ${message}`);
  process.exit(1);
}

function rpcUrl(network: NetworkKey): string {
  const cfg = networks[network];
  const value = process.env[cfg.rpcEnv]?.trim();
  if (!value) stop(`${cfg.rpcEnv} is missing.`);
  let parsed: URL;
  try { parsed = new URL(value); } catch { stop(`${cfg.rpcEnv} is not a valid URL.`); }
  if (parsed.protocol !== "https:" || parsed.hostname !== cfg.rpcHost || parsed.username || parsed.password) {
    stop(`${cfg.rpcEnv} must use the fixed HTTPS host ${cfg.rpcHost}.`);
  }
  return value;
}

function readKey(name: string): Hex {
  const value = process.env[name]?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    stop(`${name} must be a disposable EVM test key in 0x plus 64 hexadecimal characters, stored only in the ignored local .env.`);
  }
  return value as Hex;
}

async function compile(): Promise<Record<string, { abi: Abi; bytecode: Hex }>> {
  const content = await readFile(sourcePath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "LiveCrossChainFixtures.sol": { content } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts?: Record<string, Record<string, { abi: readonly unknown[]; evm: { bytecode: { object: string } } }>>;
  };
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length) stop(`Solidity compilation failed:\n${errors.map((error) => error.formattedMessage).join("\n")}`);
  const contracts = output.contracts?.["LiveCrossChainFixtures.sol"];
  const names = ["TestnetSourceFixture", "TestnetDestinationFixture"];
  const compiled: Record<string, { abi: Abi; bytecode: Hex }> = {};
  for (const name of names) {
    const item = contracts?.[name];
    if (!item?.abi || !item.evm.bytecode.object) stop(`Solidity compiler did not return ${name}.`);
    compiled[name] = { abi: item.abi as Abi, bytecode: `0x${item.evm.bytecode.object}` as Hex };
  }
  return compiled;
}

function clients(network: NetworkKey, rpc: string, account: ReturnType<typeof privateKeyToAccount>) {
  const cfg = networks[network];
  const chain = defineChain({
    id: cfg.id,
    name: cfg.name,
    nativeCurrency: cfg.currency,
    rpcUrls: { default: { http: [rpc] } },
  });
  return {
    chain,
    publicClient: createPublicClient({ chain, transport: http(rpc, { timeout: 20_000 }) }),
    walletClient: createWalletClient({ account, chain, transport: http(rpc, { timeout: 20_000 }) }),
  };
}

async function writeManifest(manifest: Manifest) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function deploy(
  network: NetworkKey,
  contractName: string,
  constructorArgs: readonly unknown[],
  artifact: { abi: Abi; bytecode: Hex },
  rpc: string,
  account: ReturnType<typeof privateKeyToAccount>,
): Promise<DeploymentRecord> {
  const { chain, publicClient, walletClient } = clients(network, rpc, account);
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: constructorArgs,
    account,
    chain,
  });
  console.log(`${contractName} deployment submitted on ${networks[network].name}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 });
  if (receipt.status !== "success" || !receipt.contractAddress) stop(`${contractName} deployment failed on ${networks[network].name}.`);
  console.log(`${contractName} deployed on ${networks[network].name}: ${receipt.contractAddress}`);
  return { address: receipt.contractAddress, transactionHash: hash, blockNumber: receipt.blockNumber.toString() };
}

async function main() {
  const deployer = privateKeyToAccount(readKey("TESTNET_DEPLOYER_PRIVATE_KEY"));
  const operator = privateKeyToAccount(readKey("OPERATOR_PRIVATE_KEY"));
  const attester = privateKeyToAccount(readKey("ATTESTER_PRIVATE_KEY"));

  const baseRpc = rpcUrl("base");
  const portaldotRpc = rpcUrl("portaldot");
  const baseClients = clients("base", baseRpc, deployer);
  const portaldotClients = clients("portaldot", portaldotRpc, deployer);
  const [baseChainId, portaldotChainId, baseDeployerBalance, portaldotDeployerBalance, baseOperatorBalance, portaldotOperatorBalance] = await Promise.all([
    baseClients.publicClient.getChainId(),
    portaldotClients.publicClient.getChainId(),
    baseClients.publicClient.getBalance({ address: deployer.address }),
    portaldotClients.publicClient.getBalance({ address: deployer.address }),
    baseClients.publicClient.getBalance({ address: operator.address }),
    portaldotClients.publicClient.getBalance({ address: operator.address }),
  ]);
  if (baseChainId !== networks.base.id || portaldotChainId !== networks.portaldot.id) {
    stop(`RPC identity mismatch (Base=${baseChainId}, Portaldot=${portaldotChainId}).`);
  }
  if (baseDeployerBalance === 0n || portaldotDeployerBalance === 0n) {
    stop("The deployer needs native test gas on both Base Sepolia and Portaldot V3.");
  }
  if (baseOperatorBalance === 0n || portaldotOperatorBalance === 0n) {
    stop("The operator needs native test gas on both Base Sepolia and Portaldot V3.");
  }

  if (deployer.address === operator.address && operator.address === attester.address) {
    console.log("Using one shared test-only EVM signer for deployer, operator, and attester; role independence is not demonstrated.");
  }

  const compiled = await compile();
  const src = compiled.TestnetSourceFixture;
  const dst = compiled.TestnetDestinationFixture;
  if (!process.argv.slice(2).includes("--broadcast")) {
    console.log("Preflight passed. No transactions were sent.");
    console.log(`Base Sepolia chain ID: ${baseChainId}; Portaldot V3 chain ID: ${portaldotChainId}.`);
    console.log("Four fixture deployments and two destination-binding transactions are ready.");
    console.log("After reviewing the test-only signer accounts and gas balances, rerun with --broadcast to submit them.");
    return;
  }

  const manifest: Manifest = {
    schemaVersion: 1,
    evidenceMode: "public-testnet",
    createdAt: new Date().toISOString(),
    status: "deploying",
    chainIds: { base: networks.base.id, portaldot: networks.portaldot.id },
    deployerAddress: deployer.address,
    operatorAddress: operator.address,
    attesterAddress: attester.address,
    contracts: { vulnerable: {}, patched: {} },
    limitation: "Valueless test units only. The attester is trusted and manually operated. This fixture is not a bridge, finality proof, or support for real assets.",
  };
  await writeManifest(manifest);

  manifest.contracts.vulnerable.destination = await deploy(
    "portaldot", "Vulnerable destination", [operator.address, attester.address, networks.base.id, false], dst, portaldotRpc, deployer,
  );
  await writeManifest(manifest);
  manifest.contracts.patched.destination = await deploy(
    "portaldot", "Patched destination", [operator.address, attester.address, networks.base.id, true], dst, portaldotRpc, deployer,
  );
  await writeManifest(manifest);
  manifest.contracts.vulnerable.source = await deploy(
    "base", "Vulnerable source", [operator.address, attester.address, networks.portaldot.id, manifest.contracts.vulnerable.destination.address, false], src, baseRpc, deployer,
  );
  await writeManifest(manifest);
  manifest.contracts.patched.source = await deploy(
    "base", "Patched source", [operator.address, attester.address, networks.portaldot.id, manifest.contracts.patched.destination.address, true], src, baseRpc, deployer,
  );
  await writeManifest(manifest);

  for (const mode of ["vulnerable", "patched"] as const) {
    const destination = manifest.contracts[mode].destination!;
    const source = manifest.contracts[mode].source!;
    const hash = await portaldotClients.walletClient.writeContract({
      address: destination.address,
      abi: dst.abi,
      functionName: "setSourceFixture",
      args: [source.address],
      account: deployer,
      chain: portaldotClients.chain,
    });
    const receipt = await portaldotClients.publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 });
    if (receipt.status !== "success") stop(`${mode} destination source binding failed.`);
    manifest.contracts[mode].destinationSourceBinding = hash;
    await writeManifest(manifest);
    console.log(`${mode} source/destination binding: ${hash}`);
  }

  manifest.status = "complete";
  await writeManifest(manifest);
  console.log(`Deployment manifest: ${manifestPath}`);
  console.log("Copy the public source contract addresses into the two VITE_BASE_SEPOLIA_SOURCE_* variables before rebuilding the web app.");
}

main().catch((error) => stop(error instanceof Error ? error.message : "Unexpected deployment error."));
