import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  MortgageMatesGatewayError,
  requestMortgageMatesMatch,
} from "@/lib/matching/gateway-client";
import {
  fictionalCandidates,
  matchingProfileFromTrial,
  TrialProfileInputSchema,
} from "@/lib/matching/trial-data";

export const runtime = "nodejs";
export const maxDuration = 30;

const SESSION_COOKIE = "mortgagemates_trial_session";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = TrialProfileInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please complete every matching preference." },
      { status: 422 },
    );
  }

  const cookieStore = await cookies();
  const existingSession = cookieStore.get(SESSION_COOKIE)?.value;
  const session =
    existingSession && /^[A-Za-z0-9_-]{24,64}$/.test(existingSession)
      ? existingSession
      : randomBytes(24).toString("base64url");
  const pseudonymousUser = createHash("sha256")
    .update(`mortgagemates-investor-trial-v1:${session}`, "utf8")
    .digest("hex");

  try {
    const result = await requestMortgageMatesMatch({
      purpose: "investor_trial",
      pseudonymousUser,
      requester: matchingProfileFromTrial(parsed.data),
      candidates: fictionalCandidates.map(({ candidateId, profile }) => ({
        candidateId,
        profile,
      })),
    });
    const selected = result.selectedCandidateId
      ? fictionalCandidates.find(
          (candidate) => candidate.candidateId === result.selectedCandidateId,
        ) ?? null
      : null;
    if (result.decision === "propose" && !selected) {
      throw new MortgageMatesGatewayError(
        "The AI matching service selected an unknown trial profile.",
        503,
        "unknown_candidate",
      );
    }

    const response = NextResponse.json({
      result,
      candidate: selected
        ? {
            firstName: selected.firstName,
            ageBand: selected.ageBand,
            occupation: selected.occupation,
            descriptor: selected.descriptor,
            profile: selected.profile,
          }
        : null,
    });
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    if (error instanceof MortgageMatesGatewayError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "AI matching is temporarily unavailable." },
      { status: 503 },
    );
  }
}
