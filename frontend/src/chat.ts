import { INPUT_KEYS, formatInput } from "./analysis.ts";
import type { Inputs, Fields } from "./storage.ts";
import type { Reference } from "./simulation.ts";

export function chatContext(reference: Reference, inputs: Inputs) {
  return JSON.stringify([
    reference.case_id,
    reference.source_version,
    reference.assumptions.version,
    INPUT_KEYS.map((key) => inputs[key]),
  ]);
}
export function describeChanges(
  fields: Fields,
  before: Inputs,
  changes: Inputs,
) {
  return Object.entries(changes)
    .map(
      ([key, value]) =>
        `${fields[key].label}: ${formatInput(key, before[key])} → ${formatInput(key, value)}`,
    )
    .join("\n");
}
export function randomSamples<T>(
  samples: T[],
  count = 4,
  random: () => number = Math.random,
): T[] {
  const copy = [...samples];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
