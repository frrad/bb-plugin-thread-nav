import { useEffect, useState } from "react";
import { experimental_useRpcQuery, useRpc } from "@get-bb/plugin-sdk/app";
import { contract } from "./contract.ts";
import { defaultMachineEmoji, modelKey } from "./emojis.ts";
import type { Machine } from "./emojis.ts";

const buttonStyle = { border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px" };

function MachineEmojiRow({ machine, override, refresh }: {
  machine: Machine; override: string | undefined; refresh: () => Promise<void>;
}) {
  const rpc = useRpc<typeof contract>();
  const automatic = defaultMachineEmoji(machine);
  const current = override ?? automatic;
  const [draft, setDraft] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(current); }, [current, override]);

  async function save(emoji: string | null) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await rpc.call("emoji_set", { hostId: machine.id, emoji });
      await refresh();
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={(event) => { event.preventDefault(); void save(draft); }}
    style={{ borderBottom: "1px solid var(--border)", padding: "16px 0" }}>
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <label htmlFor={`emoji-${machine.id}`} style={{ fontWeight: 500 }}>{machine.name}</label>
        <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 4 }}>
          {override === undefined ? `Automatic · ${automatic}` : override === "" ? "Hidden" : "Custom emoji"}
        </div>
      </div>
      <input id={`emoji-${machine.id}`} aria-label={`Emoji for ${machine.name}`} value={draft}
        onChange={(event) => { setDraft(event.target.value); setSaved(false); }}
        disabled={saving} maxLength={32} autoComplete="off" placeholder="No emoji"
        style={{ width: 92, border: "1px solid var(--border)", borderRadius: 6,
          background: "var(--background)", color: "var(--foreground)", padding: "6px 10px", fontSize: 20 }} />
      <button type="submit" disabled={saving || draft.trim() === current} style={buttonStyle}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" disabled={saving || override === undefined} style={buttonStyle}
        onClick={() => { void save(null); }}>Use default</button>
    </div>
    <div style={{ marginTop: 10, color: "var(--muted-foreground)", fontSize: 13 }}>
      Preview: <span style={{ color: "var(--foreground)" }}>{draft.trim() ? `${draft.trim()} ` : ""}Thread title</span>
    </div>
    {error && <p role="alert" style={{ color: "var(--destructive)", marginTop: 8 }}>{error}</p>}
    {saved && <p role="status" style={{ color: "var(--muted-foreground)", marginTop: 8 }}>Saved</p>}
  </form>;
}

export function MachineEmojiSettings() {
  const machines = experimental_useRpcQuery({ contract, method: "machines_list", input: null });
  const emojis = experimental_useRpcQuery({ contract, method: "emojis_get", input: null });
  const error = machines.error ?? emojis.error;
  return <div style={{ maxWidth: 720 }}>
    <p style={{ color: "var(--muted-foreground)", marginBottom: 8 }}>
      Enter an emoji and save. Leave the field blank to hide a machine’s marker,
      or use its automatic default. Choices apply to all its threads and stay with the machine when renamed.
    </p>
    {error && <div role="alert">
      <p>{error.message}</p>
      <button type="button" style={buttonStyle} onClick={() => { void machines.refetch(); void emojis.refetch(); }}>Retry</button>
    </div>}
    {(machines.isLoading || emojis.isLoading) && <p role="status">Loading machines…</p>}
    {machines.data && emojis.data && machines.data.length === 0 && <p>No machines enrolled yet.</p>}
    {emojis.data && machines.data?.map((machine) => <MachineEmojiRow key={machine.id} machine={machine}
      override={emojis.data![machine.id]} refresh={emojis.refetch} />)}
  </div>;
}

function ModelEmojiRow({ model, override, refresh }: {
  model: { providerId: string; model: string; name: string }; override: string | undefined; refresh: () => Promise<void>;
}) {
  const rpc = useRpc<typeof contract>();
  const [draft, setDraft] = useState(override ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(override ?? ""), [override]);
  async function save(emoji: string | null) {
    setSaving(true);
    setError(null);
    try {
      await rpc.call("model_emoji_set", { providerId: model.providerId, model: model.model, emoji });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSaving(false); }
  }
  const id = `model-${modelKey(model)}`;
  return <form onSubmit={event => { event.preventDefault(); void save(draft); }}
    style={{ borderBottom: "1px solid var(--border)", padding: "16px 0" }}>
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <label htmlFor={id} style={{ fontWeight: 500 }}>{model.name}</label>
        <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{model.providerId} / {model.model}</div>
      </div>
      <input id={id} aria-label={`Emoji for ${model.providerId} ${model.name}`} value={draft}
        onChange={event => setDraft(event.target.value)} disabled={saving} maxLength={32} placeholder="No emoji"
        style={{ width: 92, border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)",
          color: "var(--foreground)", padding: "6px 10px", fontSize: 20 }} />
      <button type="submit" style={buttonStyle} disabled={saving || draft.trim() === (override ?? "")}>{saving ? "Saving…" : "Save"}</button>
      <button type="button" style={buttonStyle} disabled={saving || override === undefined} onClick={() => void save(null)}>Clear</button>
    </div>
    <div style={{ marginTop: 10, color: "var(--muted-foreground)", fontSize: 13 }}>
      Preview: 🐒 {draft.trim() || "·"} Thread title
    </div>
    {error && <p role="alert" style={{ color: "var(--destructive)" }}>{error}</p>}
  </form>;
}

export function ModelEmojiSettings() {
  const models = experimental_useRpcQuery({ contract, method: "models_list", input: null });
  const emojis = experimental_useRpcQuery({ contract, method: "model_emojis_get", input: null });
  const error = models.error ?? emojis.error;
  return <div style={{ maxWidth: 720 }}>
    <p style={{ color: "var(--muted-foreground)" }}>Markers match the exact provider and model, across all reasoning levels.
      Machine comes first, then model. A muted dot marks a missing emoji; both positions disappear when neither has one.
      Leave a model blank to give it no marker.</p>
    {error && <div role="alert"><p>{error.message}</p><button style={buttonStyle} onClick={() => { void models.refetch(); void emojis.refetch(); }}>Retry</button></div>}
    {(models.isLoading || emojis.isLoading) && <p role="status">Loading models…</p>}
    {models.data?.length === 0 && <p>No models available. Refresh after connecting a provider.</p>}
    {emojis.data && models.data?.map(model => <ModelEmojiRow key={modelKey(model)} model={model}
      override={emojis.data![modelKey(model)]} refresh={emojis.refetch} />)}
    <button type="button" style={buttonStyle} onClick={() => void models.refetch()}>Refresh models</button>
  </div>;
}
