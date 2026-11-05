import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(projectRoot, "contracts/src/TestnetRoleFixture.sol");
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
    currency: { name: "tPOTv3", symbol: "tPOT", decimals: 14 },
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

function readPrivateKey(name: string): Hex {
  const value = process.env[name]?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    fail(`set ${name} in the ignored local .env as a 0x-prefixed 32-byte test-only key; signing keys are never read from Vercel`);
  }
  return value as Hex;
}

async function compileFixture(): Promise<{ abi: Abi; bytecode: Hex }> {
  const source = await readFile(fixturePath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "TestnetRoleFixture.sol": { content: source } },
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
  const artifact = output.contracts?.["TestnetRoleFixture.sol"]?.TestnetRoleFixture;
  if (!artifact?.evm.bytecode.object || !artifact.abi) fail("the Solidity compiler returned no fixture artifact");
  return { abi: artifact.abi as Abi, bytecode: `0x${artifact.evm.bytecode.object}` as Hex };
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
  const receiptProbe = await receiptProbeResponse.json() as { result?: unknown; error?: { message?: string } };
  if (!receiptProbeResponse.ok || receiptProbe.error || receiptProbe.result !== null) {
    fail(`${config.name} RPC did not return a valid not-found result for receipt lookup`);
  }
  const fixture = await compileFixture();
  console.log(`RPC verified: ${config.name} (chain ${actualChainId}, block ${currentBlock})`);
  console.log("Read-only transaction-receipt lookup verified (unknown transaction returns no receipt).");
  console.log(`Role fixture compiled with solc ${solc.version()}.`);
  console.log("This valueless, single-chain fixture does not transfer real assets or verify another chain.");

  if (!broadcast) {
    console.log("Read-only preflight complete. Shared test-only keys are allowed; the signer paying deployment and operator transactions needs gas.");
    return;
  }

  const deployer = privateKeyToAccount(readPrivateKey("TESTNET_DEPLOYER_PRIVATE_KEY"));
  const operator = privateKeyToAccount(readPrivateKey("OPERATOR_PRIVATE_KEY"));
  const attester = privateKeyToAccount(readPrivateKey("ATTESTER_PRIVATE_KEY"));
  const [deployerBalance, operatorBalance] = await Promise.all([
    publicClient.getBalance({ address: deployer.address }),
    publicClient.getBalance({ address: operator.address }),
  ]);
  if (deployerBalance === 0n) fail(`the deployer/user ${deployer.address} has no native testnet gas token`);
  if (operatorBalance === 0n) fail(`the operator ${operator.address} has no native testnet gas token`);

  const deployerClient = createWalletClient({ account: deployer, chain, transport: http(rpcUrl, { timeout: 12_000 }) });
  const operatorClient = createWalletClient({ account: operator, chain, transport: http(rpcUrl, { timeout: 12_000 }) });
  const transferId = keccak256(stringToHex(`vareq:${networkName}:${Date.now()}:${randomUUID()}`));

  console.log(`Testnet user/deployer: ${deployer.address}`);
  console.log(`Testnet operator: ${operator.address}`);
  console.log(`Testnet attester: ${attester.address}`);
  console.log("Sending five testnet transactions for deployment, lock, permit, operator fill, and attested claim.");

  const deploymentHash = await deployerClient.deployContract({
    abi: fixture.abi,
    bytecode: fixture.bytecode,
    args: [deployer.address, operator.address, attester.address],
    account: deployer,
    chain,
  });
  const deploymentReceipt = await publicClient.waitForTransactionReceipt({ hash: deploymentHash, timeout: 120_000 });
  if (deploymentReceipt.status !== "success" || !deploymentReceipt.contractAddress) {
    fail(`deployment transaction ${deploymentHash} did not produce a successful contract receipt`);
  }
  const contractAddress = deploymentReceipt.contractAddress;

  const lockHash = await deployerClient.writeContract({
    address: contractAddress, abi: fixture.abi, functionName: "lock",
    args: [transferId, 1n], account: deployer, chain,
  });
  const lockReceipt = await publicClient.waitForTransactionReceipt({ hash: lockHash, timeout: 120_000 });
  if (lockReceipt.status !== "success") fail(`user lock transaction ${lockHash} did not succeed`);

  const permitMessageHash = await publicClient.readContract({
    address: contractAddress, abi: fixture.abi, functionName: "fillPermitMessageHash", args: [transferId],
  }) as Hex;
  const permitSignature = await attester.signMessage({ message: { raw: permitMessageHash } });
  const permitHash = await deployerClient.writeContract({
    address: contractAddress, abi: fixture.abi, functionName: "issueFillPermit",
    args: [transferId, permitSignature], account: deployer, chain,
  });
  const permitReceipt = await publicClient.waitForTransactionReceipt({ hash: permitHash, timeout: 120_000 });
  if (permitReceipt.status !== "success") fail(`attested fill permit transaction ${permitHash} did not succeed`);

  const fillHash = await operatorClient.writeContract({
    address: contractAddress, abi: fixture.abi, functionName: "deliverFill",
    args: [transferId], account: operator, chain,
  });
  const fillReceipt = await publicClient.waitForTransactionReceipt({ hash: fillHash, timeout: 120_000 });
  if (fillReceipt.status !== "success") fail(`operator fill transaction ${fillHash} did not succeed`);

  const fillMessageHash = await publicClient.readContract({
    address: contractAddress, abi: fixture.abi, functionName: "fillAttestationMessageHash",
    args: [transferId, fillHash],
  }) as Hex;
  const fillSignature = await attester.signMessage({ message: { raw: fillMessageHash } });
  const claimHash = await operatorClient.writeContract({
    address: contractAddress, abi: fixture.abi, functionName: "claim",
    args: [transferId, fillHash, fillSignature], account: operator, chain,
  });
  const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash, timeout: 120_000 });
  if (claimReceipt.status !== "success") fail(`attested operator claim transaction ${claimHash} did not succeed`);

  const [locked, fillPermit, destinationFilled, operatorReimbursed, referenceUnits] = await Promise.all([
    publicClient.readContract({ address: contractAddress, abi: fixture.abi, functionName: "locked" }),
    publicClient.readContract({ address: contractAddress, abi: fixture.abi, functionName: "fillPermit" }),
    publicClient.readContract({ address: contractAddress, abi: fixture.abi, functionName: "destinationFilled" }),
    publicClient.readContract({ address: contractAddress, abi: fixture.abi, functionName: "operatorReimbursed" }),
    publicClient.readContract({ address: contractAddress, abi: fixture.abi, functionName: "referenceUnits" }),
  ]);
  if (!locked || !fillPermit || !destinationFilled || !operatorReimbursed || referenceUnits !== 1n) {
    fail("the deployed fixture did not report the expected attested role state");
  }

  const txEvidence = (hash: Hex, receipt: { blockNumber: bigint; blockHash: Hex; status: string }) => ({
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receipt.blockHash,
    status: receipt.status,
    explorerUrl: config.explorerTx ? `${config.explorerTx}${hash}` : null,
  });
  const evidence = {
    evidenceMode: "public-testnet",
    note: "Real single-chain EVM testnet transactions on a valueless fixture. The operator submits a fill and claim; an attester signs the permit and observed fill hash. This is not a cross-chain bridge, cross-chain verification, or asset transfer.",
    network: networkName,
    chainId: actualChainId,
    transferId,
    roles: {
      userAndDeployerAddress: deployer.address,
      operatorAddress: operator.address,
      attesterAddress: attester.address,
    },
    contractAddress,
    transactions: {
      deployment: txEvidence(deploymentHash, deploymentReceipt),
      userLock: txEvidence(lockHash, lockReceipt),
      attestedPermit: txEvidence(permitHash, permitReceipt),
      operatorFill: txEvidence(fillHash, fillReceipt),
      attestedClaim: txEvidence(claimHash, claimReceipt),
    },
    verifiedState: { locked, fillPermit, destinationFilled, operatorReimbursed, referenceUnits: referenceUnits.toString() },
    createdAt: new Date().toISOString(),
  };
  const evidenceDirectory = resolve(projectRoot, "evidence/testnet");
  await mkdir(evidenceDirectory, { recursive: true });
  const evidencePath = resolve(projectRoot, `evidence/testnet/${networkName}-${deploymentHash.slice(2, 12)}.json`);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  console.log(`Deployment receipt: ${deploymentHash}`);
  console.log(`User lock receipt: ${lockHash}`);
  console.log(`Attested permit receipt: ${permitHash}`);
  console.log(`Operator fill receipt: ${fillHash}`);
  console.log(`Attested claim receipt: ${claimHash}`);
  console.log(`Verified role state at ${contractAddress}`);
  console.log(`Evidence saved without secrets to ${evidencePath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unexpected failure";
  fail(message);
});
