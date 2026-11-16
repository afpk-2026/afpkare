import type { Strategy } from "./storage.ts";

export const strategyLabels: Record<Strategy, string> = {
  B: "생전에 나눠 적립",
  B_PRIME: "상속재산으로 추가 적립",
};

export const reportStrategyLabels: Record<string, string> = {
  ...strategyLabels,
  A: "자녀에게 재산을 많이 이전",
  D: "별도 준비 없이 법정상속",
};
