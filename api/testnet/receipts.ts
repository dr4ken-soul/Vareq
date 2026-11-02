import { getAllowedOrigin, handleOptions, jsonResponse, errorResponse, methodNotAllowed, ApiError } from "../_lib/http";

const networks = {
  "base-sepolia": {
    chainId: 84_532,
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    rpcHost: "sepolia.base.org",
    explorer: "https://sepolia.basescan.org/tx/",
  },
  "portaldot-v3": {
    chainId: 420_420_777,
    rpcEnv: "PORTALDOT_V3_EVM_RPC_URL",
    rpcHost: "test-evm-rpc-v3.portaldot.dev",
    explorer: null,
  },
} as const;

type JsonRpcResponse = { result?: unknown; error?: { message?: string } };

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new ApiError(503, "The selected testnet RPC is unavailable.");
  const data = await response.json() as JsonRpcResponse;
  if (data.error || !("result" in data)) throw new ApiError(503, "The selected testnet RPC returned an invalid response.");
  return data.result;
}

function parseQuantity(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new ApiError(503, "The selected testnet RPC returned an invalid block value.");
  }
  return BigInt(value);
}

export default {
  async fetch(request: Request): Promise<Response> {
    let origin: string | undefined;
    try {
      if (request.method === "OPTIONS") return handleOptions(request);
      origin = getAllowedOrigin(request);
      if (request.method !== "GET") return methodNotAllowed(request, origin);
      if (process.env.VITE_ENABLE_TESTNET !== "true") {
        throw new ApiError(503, "Testnet receipt lookups are disabled until the network path is verified.");
      }

      const url = new URL(request.url);
      const networkName = url.searchParams.get("network") as keyof typeof networks | null;
      const transactionHash = url.searchParams.get("txHash") ?? "";
      if (!networkName || !(networkName in networks)) throw new ApiError(400, "Choose Base Sepolia or Portaldot V3.");
      if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) throw new ApiError(400, "Enter a valid 32-byte transaction hash.");

      const network = networks[networkName];
      const rpcUrl = process.env[network.rpcEnv]?.trim();
      if (!rpcUrl) throw new ApiError(503, "The selected testnet RPC is not configured.");
      let parsedRpc: URL;
      try {
        parsedRpc = new URL(rpcUrl);
      } catch {
        throw new ApiError(503, "The selected testnet RPC configuration is invalid.");
      }
      if (parsedRpc.protocol !== "https:" || parsedRpc.hostname !== network.rpcHost ||
          parsedRpc.username || parsedRpc.password) {
        throw new ApiError(503, "The selected testnet RPC is not on Vareq's allowlist.");
      }

      const chainIdHex = await rpc(rpcUrl, "eth_chainId", []);
      if (parseQuantity(chainIdHex) !== BigInt(network.chainId)) {
        throw new ApiError(503, "The RPC did not identify itself as the expected testnet.");
      }
      const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [transactionHash]);
      if (receipt === null) {
        return jsonResponse(request, origin, {
          network: networkName,
          chainId: network.chainId,
          transactionHash: transactionHash.toLowerCase(),
          status: "pending-or-not-found",
          receipt: null,
          explorerUrl: network.explorer ? network.explorer + transactionHash : null,
        }, 200, { "cache-control": "public, max-age=2" });
      }
      if (!receipt || typeof receipt !== "object") throw new ApiError(503, "The selected testnet RPC returned an invalid receipt.");

      const item = receipt as Record<string, unknown>;
      if (typeof item.transactionHash !== "string" || item.transactionHash.toLowerCase() !== transactionHash.toLowerCase()) {
        throw new ApiError(503, "The RPC receipt does not match the requested transaction.");
      }
      const includedBlock = parseQuantity(item.blockNumber);
      const currentBlock = parseQuantity(await rpc(rpcUrl, "eth_blockNumber", []));
      const confirmations = currentBlock >= includedBlock ? currentBlock - includedBlock + 1n : 0n;
      const status = item.status === "0x1" ? "success" : item.status === "0x0" ? "reverted" : "unknown";
      return jsonResponse(request, origin, {
        network: networkName,
        chainId: network.chainId,
        transactionHash: transactionHash.toLowerCase(),
        status,
        receipt: {
          blockNumber: includedBlock.toString(),
          blockHash: typeof item.blockHash === "string" ? item.blockHash : null,
          confirmations: confirmations.toString(),
          from: typeof item.from === "string" ? item.from : null,
          to: typeof item.to === "string" ? item.to : null,
        },
        explorerUrl: network.explorer ? network.explorer + transactionHash : null,
        evidenceMode: "public-testnet",
      }, 200, { "cache-control": "public, max-age=5" });
    } catch (error) {
      return errorResponse(request, origin, error);
    }
  },
};
