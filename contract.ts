import type { PluginRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const emojiValue = z.string().max(32, "Use at most 32 characters.").refine(
  (value) => !/[\u0000-\u001f\u007f-\u009f]/u.test(value), "Use a single line without control characters.",
);
export const overridesSchema = z.record(z.string(), emojiValue);
export const EMOJI_TAG = "machine-emojis";
export const MODEL_EMOJI_TAG = "model-emojis";
export const modelSchema = z.object({ providerId: z.string().min(1).max(128), model: z.string().min(1).max(256) });
export const threadModelKey = z.string().transform((value, ctx) => {
  try {
    return z.tuple([z.string().min(1).max(128), z.number(), z.string().min(1).max(128)]).parse(JSON.parse(value));
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid thread model key" });
    return z.NEVER;
  }
});
export const contract = {
  model_emojis_get: {
    input: z.null(), output: overridesSchema, tags: () => [MODEL_EMOJI_TAG],
  },
  model_emoji_set: {
    input: modelSchema.extend({ emoji: emojiValue.nullable() }).strict(), output: z.null(),
  },
  models_list: {
    input: z.null(), output: z.array(modelSchema.extend({ name: z.string() })),
    tags: () => [MODEL_EMOJI_TAG, "used-models"],
  },
  thread_models: {
    input: z.object({ keys: z.array(z.string()).max(10000) }).strict(),
    output: z.record(z.string(), modelSchema.nullable()),
  },
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
