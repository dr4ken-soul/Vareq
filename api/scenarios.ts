import { z } from "zod";
import { verifyMessage, type Address, type Hex } from "viem";
import { getAllowedOrigin, handleOptions, jsonResponse, errorResponse, methodNotAllowed, readJson, ApiError } from "./_lib/http";
import { requireLinkedWallet, verifyPrivySession } from "./_lib/auth";
import { consumeChallenge, readChallenge, reserveProposalQuota } from "./_lib/redis";
import { parseProposalInput, proposeWithGroq, scenarioDigest } from "./_lib/scenario";

const Input = z.object({
  challengeId: z.string().uuid(),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  scenario: z.unknown(),
}).strict();

export default {
  async fetch(request: Request): Promise<Response> {
    let origin: string | undefined;
    try {
      if (request.method === "OPTIONS") return handleOptions(request);
      origin = getAllowedOrigin(request);
      if (request.method !== "POST") return methodNotAllowed(request, origin);
      if (process.env.VITE_ENABLE_AI !== "true") throw new ApiError(503, "AI proposals are disabled until their server configuration is complete.");

      const input = Input.parse(await readJson(request));
      const scenario = parseProposalInput(input.scenario);
      const session = await verifyPrivySession(request);
      const challenge = await readChallenge(input.challengeId);
      if (!challenge) throw new ApiError(409, "The challenge expired or was already used. Request a new one.");
      if (challenge.subject !== session.subject || challenge.origin !== origin) {
        throw new ApiError(403, "The challenge does not belong to this session and site.");
      }
      if (challenge.expiresAt <= Date.now()) throw new ApiError(409, "The challenge expired. Request a new one.");
      if (challenge.digest !== await scenarioDigest(input.scenario)) {
        throw new ApiError(409, "The scenario changed after the wallet challenge was signed.");
      }
      requireLinkedWallet(session, challenge.wallet);

      let signatureIsValid = false;
      try {
        signatureIsValid = await verifyMessage({
          address: challenge.wallet as Address,
          message: challenge.message,
          signature: input.signature as Hex,
        });
      } catch {
        signatureIsValid = false;
      }
      if (!signatureIsValid) throw new ApiError(403, "The wallet signature is invalid.");
      if (!await consumeChallenge(input.challengeId, challenge)) {
        throw new ApiError(409, "The challenge expired or was already used. Request a new one.");
      }

      await reserveProposalQuota(session.subject, challenge.wallet);
      const result = await proposeWithGroq(scenario);
      return jsonResponse(request, origin, {
        scenario: result.scenario,
        provenance: { origin: "ai", provider: "Groq", model: result.model, validated: true },
      });
    } catch (error) {
      return errorResponse(request, origin, error);
    }
  },
};
