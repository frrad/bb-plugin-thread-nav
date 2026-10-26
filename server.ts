// bb-plugin-thread-nav — backend entry. Everything happens in app.tsx; the
// server only exists because bb requires one.
import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default async function plugin(bb: BbPluginApi): Promise<void> {
  bb.log.info("loaded");
}
