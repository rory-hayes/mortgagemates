import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type MockIntroductionGate = "checkout" | "identity";

export async function completeMockIntroductionGate({
  gate,
  matchId,
  userId,
}: {
  gate: MockIntroductionGate;
  matchId: string;
  userId: string;
}) {
  const attemptId = `mock_${gate}_${randomUUID()}`;
  const { error } = await createAdminClient().rpc("complete_mock_introduction_gate", {
    p_match_id: matchId,
    p_user_id: userId,
    p_gate: gate,
    p_attempt_id: attemptId,
  });
  if (error) throw new Error(`Could not complete mock ${gate} gate: ${error.message}`);
}
