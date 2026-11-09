// Convert the display units exactly; currency must never arrive as a fractional won.
export function fromDisplay(key: string, text: string): number {
  const value = text.trim();
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return NaN;
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, rawFraction = ""] = unsigned.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  const precision =
    key === "net_real_return" ? 2 : key === "child_end_age" ? 0 : 4;
  if (fraction.length > precision) return NaN;
  const scale = 10 ** precision;
  const integer = Number(
    BigInt(whole || "0") * BigInt(scale) +
      BigInt(fraction.padEnd(precision, "0") || "0"),
  );
  const signed = negative ? -integer : integer;
  return key === "net_real_return" ? signed / 10000 : signed;
}
