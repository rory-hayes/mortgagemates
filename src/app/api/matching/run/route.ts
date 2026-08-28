import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import {
  MortgageMatesGatewayError,
  requestMortgageMatesMatch,
} from "@/lib/matching/gateway-client";
import {
  matchingProfileFromDatabase,
  passesDeterministicMatchingGates,
  type DatabaseBuyerPreferences,
} from "@/lib/matching/member-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { MatchingProfile } from "@/lib/matching/trial-data";

export const runtime = "nodejs";
export const maxDuration = 30;

type DatabaseMember = {
  id: string;
  first_name: string | null;
  age_band: string | null;
  occupation_sector: string | null;
  onboarding_status: string;
  matching_status: string;
  buyer_preferences: DatabaseBuyerPreferences | DatabaseBuyerPreferences[] | null;
};

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to run matching." }, { status: 401 });
  }

  const sharedSecret = process.env.MORTGAGEMATES_GATEWAY_SHARED_SECRET?.trim();
  if (!sharedSecret || sharedSecret.length < 32) {
    return NextResponse.json(
      { error: "AI matching is temporarily unavailable." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  await admin.rpc("expire_stale_matches");
  const memberSelect = "id, first_name, age_band, occupation_sector, onboarding_status, matching_status, buyer_preferences(deposit_range, borrowing_range, monthly_housing_budget_range, target_locations, property_types, must_haves, purchase_timeline, household_preferences, ownership_expectations)";
  const [{ data: requesterData }, { data: candidateData }] = await Promise.all([
    admin.from("profiles").select(memberSelect).eq("id", user.id).single(),
    admin.from("profiles").select(memberSelect)
      .eq("role", "buyer")
      .eq("onboarding_status", "approved")
      .eq("matching_status", "ready")
      .neq("id", user.id)
      .order("last_active_at", { ascending: false })
      .limit(60),
  ]);

  const requester = requesterData as unknown as DatabaseMember | null;
  if (
    !requester ||
    requester.onboarding_status !== "approved" ||
    requester.matching_status !== "ready"
  ) {
    return NextResponse.json(
      { error: "Complete profile approval and document readiness before matching." },
      { status: 409 },
    );
  }

  const requesterProfile = matchingProfileFromDatabase(
    relation(requester.buyer_preferences),
  );
  if (!requesterProfile) {
    return NextResponse.json(
      { error: "Your matching profile needs an update before the engine can run." },
      { status: 409 },
    );
  }

  const candidates = ((candidateData ?? []) as unknown as DatabaseMember[])
    .flatMap((member) => {
      const profile = matchingProfileFromDatabase(relation(member.buyer_preferences));
      if (!profile || !passesDeterministicMatchingGates(requesterProfile, profile)) return [];
      return [{ member, profile }];
    })
    .slice(0, 12);

  const pseudonymousUser = createHmac("sha256", sharedSecret)
    .update(`mortgagemates-member:${user.id}`, "utf8")
    .digest("hex");
  const opaqueCandidates = candidates.map(({ member, profile }) => ({
    candidateId: opaqueCandidateID(member.id, sharedSecret),
    profile,
  }));
  const inputHash = createHash("sha256")
    .update(JSON.stringify({
      requester: requesterProfile,
      candidateIDs: opaqueCandidates.map((candidate) => candidate.candidateId),
      algorithm: "mortgagemates_match_v1",
    }), "utf8")
    .digest("hex");

  if (opaqueCandidates.length === 0) {
    await admin.from("ai_matching_runs").insert({
      requested_by: user.id,
      selected_user_id: null,
      status: "held",
      candidate_count: 0,
      overall_score: 0,
      model: "rules_only",
      algorithm_version: "mortgagemates_match_v1",
      input_hash: inputHash,
    });
    return NextResponse.json({
      outcome: "held",
      message: "No available member passed every non-negotiable rule yet.",
      eligibleCandidateCount: 0,
    });
  }

  try {
    const result = await requestMortgageMatesMatch({
      purpose: "member_matching",
      pseudonymousUser,
      requester: requesterProfile,
      candidates: opaqueCandidates,
    });

    if (result.decision === "hold" || !result.selectedCandidateId) {
      await admin.from("ai_matching_runs").insert({
        requested_by: user.id,
        selected_user_id: null,
        status: "held",
        candidate_count: result.eligibleCandidateCount,
        overall_score: result.overallScore,
        model: result.model,
        algorithm_version: result.algorithmVersion,
        input_hash: inputHash,
      });
      return NextResponse.json({
        outcome: "held",
        message: result.summary,
        eligibleCandidateCount: result.eligibleCandidateCount,
      });
    }

    const selected = candidates.find(
      ({ member }) =>
        opaqueCandidateID(member.id, sharedSecret) === result.selectedCandidateId,
    );
    if (!selected) {
      throw new MortgageMatesGatewayError(
        "The AI matching service selected an unknown member.",
        503,
        "unknown_candidate",
      );
    }

    const compatibility = compatibilitySummary(
      requesterProfile,
      selected.profile,
      selected.member,
      result,
    );
    const { data: matchID, error: matchError } = await admin.rpc(
      "service_create_ai_match",
      {
        p_requested_by: user.id,
        p_selected_user: selected.member.id,
        p_compatibility: compatibility,
        p_overall_score: result.overallScore,
        p_score_breakdown: result.dimensionScores,
        p_match_reasons: result.reasons,
        p_discussion_points: result.tradeoffs,
        p_model: result.model,
        p_algorithm_version: result.algorithmVersion,
        p_input_hash: inputHash,
        p_candidate_count: result.eligibleCandidateCount,
      },
    );
    if (matchError) {
      const expectedConflict = /only one active|must be approved|rules no longer pass/i.test(matchError.message);
      return NextResponse.json(
        { error: expectedConflict ? "Matching status changed. Refresh your dashboard and try again." : "The proposal could not be saved safely." },
        { status: expectedConflict ? 409 : 503 },
      );
    }

    return NextResponse.json({
      outcome: "proposed",
      matchID,
      message: "One considered proposal is ready.",
      eligibleCandidateCount: result.eligibleCandidateCount,
    });
  } catch (error) {
    if (error instanceof MortgageMatesGatewayError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "AI matching is temporarily unavailable." },
      { status: 503 },
    );
  }
}

function relation(
  value: DatabaseBuyerPreferences | DatabaseBuyerPreferences[] | null,
) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function opaqueCandidateID(userID: string, secret: string) {
  return `candidate_${createHmac("sha256", secret)
    .update(`mortgagemates-candidate:${userID}`, "utf8")
    .digest("hex")
    .slice(0, 32)}`;
}

function compatibilitySummary(
  requester: MatchingProfile,
  candidate: MatchingProfile,
  selected: DatabaseMember,
  result: Awaited<ReturnType<typeof requestMortgageMatesMatch>>,
) {
  return {
    potential_cobuyer: [selected.first_name ?? "Member", selected.age_band].filter(Boolean).join(", "),
    shared_search_area: requester.targetLocations.filter((item) => candidate.targetLocations.includes(item)),
    personal_capacity_ranges: [requester.borrowing.label, candidate.borrowing.label],
    purchase_timing: requester.purchaseTimeline,
    shared_property_types: requester.propertyTypes.filter((item) => candidate.propertyTypes.includes(item)),
    ownership_horizon: requester.ownershipHorizon,
    ai_match_score: result.overallScore,
    strong_alignment: result.reasons,
    worth_discussing: result.tradeoffs,
    opening_questions: result.openingQuestions,
  };
}
