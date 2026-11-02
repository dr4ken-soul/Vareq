import { PrivyClient } from "@privy-io/node";
import { ApiError } from "./http.js";

type PrivyIdentity = {
  id?: string;
  linked_accounts?: Array<{ type?: unknown; address?: unknown }>;
};

export type VerifiedSession = {
  subject: string;
  user: PrivyIdentity;
};

let cachedClient: PrivyClient | undefined;

function getPrivyClient(): PrivyClient {
  const appId = process.env.PRIVY_APP_ID?.trim() || process.env.VITE_PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new ApiError(503, "Privy server authentication is not configured.");
  if (!cachedClient) cachedClient = new PrivyClient({ appId, appSecret });
  return cachedClient;
}

export async function verifyPrivySession(request: Request): Promise<VerifiedSession> {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const identityToken = request.headers.get("x-privy-identity-token")?.trim() ?? "";
  if (!accessToken || accessToken.length > 8_192 || !identityToken || identityToken.length > 16_384) {
    throw new ApiError(401, "A valid Privy session is required.");
  }

  try {
    const client = getPrivyClient();
    const claims = await client.utils().auth().verifyAccessToken(accessToken);
    const user = await client.utils().auth().verifyIdentityToken(identityToken);
    if (!claims.user_id || claims.user_id !== user.id) {
      throw new ApiError(401, "The Privy session and identity token do not match.");
    }
    return { subject: claims.user_id, user };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "The Privy session could not be verified.");
  }
}

export function requireLinkedWallet(session: VerifiedSession, address: string): void {
  const normalized = address.toLowerCase();
  const linked = (session.user.linked_accounts ?? []).some((account) =>
    account.type === "wallet" &&
    typeof account.address === "string" &&
    account.address.toLowerCase() === normalized
  );
  if (!linked) throw new ApiError(403, "Connect a wallet that is linked to this Privy account.");
}
