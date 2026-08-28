import { z } from "zod";

const dimensionScores = z.strictObject({
  financialFit: z.number().int().min(0).max(100),
  homeSearchFit: z.number().int().min(0).max(100),
  timingAndExitFit: z.number().int().min(0).max(100),
  householdFit: z.number().int().min(0).max(100),
});

export const MortgageMatesGatewayResponseSchema = z.strictObject({
  version: z.literal("mortgagemates_match_response_v1"),
  source: z.enum(["cloud", "rules"]),
  decision: z.enum(["propose", "hold"]),
  selectedCandidateId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).nullable(),
  overallScore: z.number().int().min(0).max(100),
  dimensionScores,
  summary: z.string().trim().min(1).max(320),
  reasons: z.array(z.string().trim().min(1).max(180)).min(2).max(4),
  tradeoffs: z.array(z.string().trim().min(1).max(180)).min(1).max(3),
  openingQuestions: z.array(z.string().trim().min(1).max(180)).min(2).max(4),
  eligibleCandidateCount: z.number().int().min(0).max(12),
  model: z.string().trim().min(1).max(120),
  algorithmVersion: z.literal("mortgagemates_match_v1"),
  requestID: z.string().uuid(),
});

export type MortgageMatesGatewayResponse = z.infer<
  typeof MortgageMatesGatewayResponseSchema
>;
