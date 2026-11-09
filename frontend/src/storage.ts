export const STORAGE_KEY = "family-finance:settings";
export type Strategy = "B" | "B_PRIME";
export type Inputs = Record<string, number>;
export type Field = {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  source: string;
};
export type Fields = Record<string, Field>;
export type Saved = {
  schema_version: 1;
  case_id: string;
  source_version: string;
  strategy: Strategy;
  overrides: Inputs;
};
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function validInputs(value: unknown, fields: Fields): value is Inputs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([k, v]) => {
    const f = fields[k];
    return (
      !!f &&
      typeof v === "number" &&
      Number.isFinite(v) &&
      v >= f.min &&
      v <= f.max &&
      Math.abs(v / f.step - Math.round(v / f.step)) < 1e-7
    );
  });
}
export function restore(
  storage: StorageLike,
  caseId: string,
  source: string,
  fields: Fields,
): { saved: Saved | null; notice: string } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { saved: null, notice: "" };
    const s = JSON.parse(raw);
    if (
      !s ||
      Object.keys(s).sort().join(",") !==
        "case_id,overrides,schema_version,source_version,strategy" ||
      s.schema_version !== 1 ||
      s.case_id !== caseId ||
      s.source_version !== source ||
      !["B", "B_PRIME"].includes(s.strategy) ||
      !validInputs(s.overrides, fields)
    ) {
      storage.removeItem(STORAGE_KEY);
      return {
        saved: null,
        notice: "이전 설정의 형식 또는 버전이 달라 기준 사례로 시작합니다.",
      };
    }
    return {
      saved: s,
      notice:
        "이 브라우저의 적용 설정을 복원했습니다. 결과는 서버에 다시 요청합니다.",
    };
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {}
    return {
      saved: null,
      notice:
        "보관 설정을 읽을 수 없어 기준 사례로 시작합니다. 현재 탭은 계속 사용할 수 있습니다.",
    };
  }
}
export function save(storage: StorageLike, settings: Saved): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
export function clear(storage: StorageLike): boolean {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
