import { z } from "zod";
import { getAllowedOrigin, handleOptions, jsonResponse, errorResponse, methodNotAllowed, readJson, ApiError } from "./_lib/http";
import { requireLinkedWallet, verifyPrivySession } from "./_lib/auth";
import { putChallenge } from "./_lib/redis";
import { parseProposalInput, scenarioDigest } from "./_lib/scenario";

const Input = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
      parseProposalInput(input.scenario);
      const session = await verifyPrivySession(request);
      requireLinkedWallet(session, input.walletAddress);

      const digest = await scenarioDigest(input.scenario);
      const challengeId = crypto.randomUUID();
      const expiresAt = Date.now() + 5 * 60_000;
      const message = [
        "Vareq AI scenario proposal",
        "Origin: " + origin,
        "Subject: " + session.subject,
        "Wallet: " + input.walletAddress.toLowerCase(),
        "Scenario SHA-256: " + digest,
        "Challenge: " + challengeId,
        "Expires: " + new Date(expiresAt).toISOString(),
      ].join("\n");
      await putChallenge(challengeId, {
        subject: session.subject,
        wallet: input.walletAddress.toLowerCase(),
        origin,
        digest,
        message,
        expiresAt,
      });
      return jsonResponse(request, origin, { challengeId, message, expiresAt }, 201);
    } catch (error) {
      return errorResponse(request, origin, error);
    }
  },
};
