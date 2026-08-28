import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";

import {
  MortgageMatesGatewayResponseSchema,
  type MortgageMatesGatewayResponse,
} from "@/lib/matching/gateway-contract";
import type { MatchingProfile, FictionalCandidate } from "@/lib/matching/trial-data";

export class MortgageMatesGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function requestMortgageMatesMatch(input: {
  purpose: "investor_trial" | "member_matching";
  pseudonymousUser: string;
  requester: MatchingProfile;
  candidates: Pick<FictionalCandidate, "candidateId" | "profile">[];
}): Promise<MortgageMatesGatewayResponse> {
  const gatewayURL =
    process.env.MORTGAGEMATES_AI_GATEWAY_URL?.trim() ||
    "https://pursuit-ai-gateway.vercel.app";
  const sharedSecret =
    process.env.MORTGAGEMATES_GATEWAY_SHARED_SECRET?.trim();
  if (!sharedSecret || sharedSecret.length < 32) {
    throw new MortgageMatesGatewayError(
      "The AI matching service is not configured.",
      503,
      "gateway_not_configured",
    );
  }

  const body = JSON.stringify({
    version: "mortgagemates_match_request_v1",
    appID: "mortgagemates",
    purpose: input.purpose,
    pseudonymousUser: input.pseudonymousUser,
    requester: input.requester,
    candidates: input.candidates,
  });
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = randomBytes(18).toString("base64url");
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  const signature = createHmac("sha256", sharedSecret)
    .update(
      ["mortgagemates_server_v1", timestamp, nonce, bodyHash].join("\n"),
      "utf8",
    )
    .digest("hex");

  let response: Response;
  try {
    response = await fetch(
      new URL("/api/v1/mortgagemates/match", gatewayURL),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-app-id": "mortgagemates",
          "x-mortgagemates-server-auth-version": "1",
          "x-mortgagemates-server-timestamp": timestamp,
          "x-mortgagemates-server-nonce": nonce,
          "x-mortgagemates-server-signature": signature,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      },
    );
  } catch {
    throw new MortgageMatesGatewayError(
      "The AI matching service could not be reached.",
      503,
      "gateway_unreachable",
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : "gateway_error";
    throw new MortgageMatesGatewayError(
      response.status === 429
        ? "The investor trial has reached its short-term AI limit. Please try again shortly."
        : "AI matching is temporarily unavailable.",
      response.status === 429 ? 429 : 503,
      code,
    );
  }

  const parsed = MortgageMatesGatewayResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new MortgageMatesGatewayError(
      "The AI matching service returned an invalid result.",
      503,
      "invalid_gateway_response",
    );
  }
  return parsed.data;
}
