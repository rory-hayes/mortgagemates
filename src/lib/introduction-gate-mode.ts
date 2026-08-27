export type IntroductionGateMode = "stripe" | "mock";

export const INTRODUCTION_GATE_MODE_ENV = "MORTGAGEMATES_INTRODUCTION_GATE_MODE";

export function parseIntroductionGateMode(value: string | undefined): IntroductionGateMode {
  return value === "mock" ? "mock" : "stripe";
}

export function introductionGateMode(): IntroductionGateMode {
  return parseIntroductionGateMode(process.env[INTRODUCTION_GATE_MODE_ENV]);
}
