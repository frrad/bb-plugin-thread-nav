export interface Machine { id: string; name: string }
export type EmojiOverrides = Record<string, string>;

/** Defaults remain compatible with the original machine markers. */
export function defaultMachineEmoji(host: Machine): string {
  const name = host.name.trim().toLowerCase();
  if (name === "lemur") return "🐒";
  if (name === "rhino") return "🦏";
  if (name.includes("macbook")) return "💻";
  const markers = ["🦊", "🐻", "🐼", "🐸", "🦁", "🐯", "🐨", "🐙"];
  let hash = 0;
  for (const char of host.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return markers[hash % markers.length]!;
}

export function machineEmoji(host: Machine | null, overrides: EmojiOverrides): string | null {
  if (host === null) return null;
  return Object.hasOwn(overrides, host.id) ? overrides[host.id]! || null : defaultMachineEmoji(host);
}

/** Encode arbitrary user text as a CSS string, including quotes and line breaks. */
export function cssString(value: string): string {
  return '"' + Array.from(value, (char) => `\\${char.codePointAt(0)!.toString(16)} `).join("") + '"';
}
