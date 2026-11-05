import type { PluginRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const emojiValue = z.string().max(32, "Use at most 32 characters.").refine(
  (value) => !/[\u0000-\u001f\u007f-\u009f]/u.test(value), "Use a single line without control characters.",
);
export const overridesSchema = z.record(z.string(), emojiValue);
export const EMOJI_TAG = "machine-emojis";
export const contract = {
  emojis_get: {
    input: z.null(), output: overridesSchema,
    tags: () => [EMOJI_TAG],
  },
  machines_list: {
    input: z.null(), output: z.array(z.object({ id: z.string(), name: z.string() })),
  },
  emoji_set: {
    input: z.object({ hostId: z.string().min(1).max(128), emoji: emojiValue.nullable() }).strict(),
    output: z.null(),
  },
} satisfies PluginRpcContract;
