import { ApiPromise, WsProvider } from "@polkadot/api";
import { getAllowedOrigin, handleOptions, jsonResponse, errorResponse, methodNotAllowed, ApiError } from "../_lib/http.js";

const nativeEndpoint = "wss://test-node-v3.portaldot.dev";
const networkName = "portaldot-v3-native";
const expectedChain = "PortaldotV3 Test";
const expectedSpec = "portaldot-v3";
type AppliedEvent = {
  phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number } };
  event: { section: string; method: string; data: Array<{ toHuman(): unknown; toString(): string }> };
};

export default {
  async fetch(request: Request): Promise<Response> {
    let origin: string | undefined;
    let api: ApiPromise | undefined;
    try {
      if (request.method === "OPTIONS") return handleOptions(request);
      origin = getAllowedOrigin(request);
      if (request.method !== "GET") return methodNotAllowed(request, origin);
      if (process.env.VITE_ENABLE_TESTNET !== "true") {
        throw new ApiError(503, "Testnet receipt lookups are disabled until the native network path is verified.");
      }

      const url = new URL(request.url);
      const extrinsicHash = url.searchParams.get("txHash") ?? "";
      const blockHash = url.searchParams.get("blockHash") ?? "";
      if (!/^0x[a-fA-F0-9]{64}$/.test(extrinsicHash)) throw new ApiError(400, "Enter a valid 32-byte extrinsic hash.");
      if (!/^0x[a-fA-F0-9]{64}$/.test(blockHash)) throw new ApiError(400, "Enter the 32-byte block hash that contains this extrinsic.");

      const configured = process.env.PORTALDOT_V3_NATIVE_WS_URL?.trim() || nativeEndpoint;
      let parsed: URL;
      try { parsed = new URL(configured); } catch { throw new ApiError(503, "The native Portaldot RPC configuration is invalid."); }
      if (parsed.protocol !== "wss:" || parsed.hostname !== "test-node-v3.portaldot.dev" || parsed.username || parsed.password) {
        throw new ApiError(503, "The native Portaldot RPC is not on Vareq's allowlist.");
      }

      api = await ApiPromise.create({ provider: new WsProvider(configured), noInitWarn: true });
      const [chain, specName, specVersion, block, header, eventCodec, finalizedHash] = await Promise.all([
        api.rpc.system.chain(),
        api.runtimeVersion.specName,
        api.runtimeVersion.specVersion,
        api.rpc.chain.getBlock(blockHash),
        api.rpc.chain.getHeader(blockHash),
        api.query.system.events.at(blockHash),
        api.rpc.chain.getFinalizedHead(),
      ]);
      if (chain.toString() !== expectedChain || specName.toString() !== expectedSpec) {
        throw new ApiError(503, "The native RPC did not identify itself as Portaldot V3.");
      }
      const eventRecords = eventCodec as unknown as AppliedEvent[];

      const targetHash = extrinsicHash.toLowerCase();
      const index = block.block.extrinsics.findIndex((extrinsic) => extrinsic.hash.toHex().toLowerCase() === targetHash);
      if (index < 0) {
        return jsonResponse(request, origin, {
          network: networkName,
          chainId: null,
          runtime: { specName: expectedSpec, specVersion: specVersion.toNumber() },
          transactionHash: targetHash,
          status: "pending-or-not-found",
          receipt: null,
          explorerUrl: null,
        }, 200, { "cache-control": "public, max-age=2" });
      }

      const included = eventRecords.filter((record) =>
        record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.toNumber() === index,
      );
      const succeeded = included.some((record) => record.event.section === "system" && record.event.method === "ExtrinsicSuccess");
      const failed = included.some((record) => record.event.section === "system" && record.event.method === "ExtrinsicFailed");
      const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash);
      const blockNumber = header.number.toBigInt();
      const finalizedNumber = finalizedHeader.number.toBigInt();
      const isFinalized = finalizedNumber >= blockNumber;
      const feeRecord = included.find((record) => record.event.section === "transactionPayment" && record.event.method === "TransactionFeePaid");
      const feeData = feeRecord?.event.data;
      const events = included.map((record) => ({
        section: record.event.section,
        method: record.event.method,
        data: record.event.data.map((item) => item.toHuman()),
      }));
      const extrinsic = block.block.extrinsics[index];

      return jsonResponse(request, origin, {
        network: networkName,
        chainId: null,
        runtime: { specName: expectedSpec, specVersion: specVersion.toNumber() },
        transactionHash: targetHash,
        status: failed ? "reverted" : succeeded ? "success" : "unknown",
        receipt: {
          blockNumber: blockNumber.toString(),
          blockHash: blockHash.toLowerCase(),
          confirmations: isFinalized ? (finalizedNumber - blockNumber + 1n).toString() : "0",
          finalized: isFinalized,
          signer: extrinsic.isSigned ? extrinsic.signer.toString() : null,
          extrinsicIndex: index,
          fee: feeData?.[1]?.toString() ?? null,
          events,
        },
        explorerUrl: "https://node-console.portaldot.dev/",
        evidenceMode: "native-substrate-extrinsic",
      }, 200, { "cache-control": "public, max-age=5" });
    } catch (error) {
      return errorResponse(request, origin, error);
    } finally {
      if (api) await api.disconnect().catch(() => undefined);
    }
  },
};
