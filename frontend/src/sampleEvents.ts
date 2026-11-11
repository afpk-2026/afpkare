type SampleEventGroup = {
  field: string;
  title: string;
  monthly?: boolean;
  options: { label: string; value: number }[];
};

export const sampleEventGroups: SampleEventGroup[] = [
  {
    field: "monthly_child_cost",
    title: "자녀 생활비",
    monthly: true,
    options: [
      { label: "지출을 줄일 수 있을 때", value: 1_600_000 },
      { label: "생활비가 조금 오를 때", value: 1_850_000 },
      { label: "돌봄 지출이 더 필요할 때", value: 2_100_000 },
    ],
  },
  {
    field: "monthly_parent_reemployment_income",
    title: "부모 재취업",
    monthly: true,
    options: [
      { label: "재취업하지 못할 때", value: 0 },
      { label: "재취업 소득이 줄 때", value: 1_000_000 },
      { label: "보고서 기준 소득을 받을 때", value: 2_000_000 },
    ],
  },
  {
    field: "monthly_survivor_pension",
    title: "자녀 유족연금",
    monthly: true,
    options: [
      { label: "유족연금 수입이 없을 때", value: 0 },
      { label: "유족연금 수입이 줄 때", value: 700_000 },
      { label: "보고서 기준 금액을 받을 때", value: 1_070_000 },
    ],
  },
  {
    field: "net_real_return",
    title: "신탁 수익률",
    options: [
      { label: "물가를 반영한 자산 가치가 줄 때", value: -0.01 },
      { label: "물가를 반영한 자산 가치가 그대로일 때", value: 0 },
      { label: "보고서보다 수익률이 높을 때", value: 0.02 },
    ],
  },
  {
    field: "child_end_age",
    title: "준비 기간",
    options: [
      { label: "준비 기간을 줄일 때", value: 83 },
      { label: "보고서 기준으로 준비할 때", value: 95 },
      { label: "준비 기간을 늘릴 때", value: 100 },
    ],
  },
];
