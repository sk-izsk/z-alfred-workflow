import { homedir } from "node:os";
import { join } from "node:path";
import { bw, bwJson, encode } from "../bw.ts";
import { copyText } from "../clipboard.ts";
import { str } from "../env.ts";
import { getSession } from "../session.ts";
import { type Action, closeSheet, finish, fn, merge, status, update, vars } from "../ui.ts";
import { withSession } from "./account.ts";

type Send = {
  id: string;
  name: string;
  type: 0 | 1;
  accessUrl: string;
  accessCount: number;
  maxAccessCount: number | null;
  deletionDate: string;
  passwordSet: boolean;
  disabled: boolean;
  text: { text: string; hidden: boolean } | null;
  file: { fileName: string } | null;
};

const daysLeft = (iso: string): string => {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return days <= 0 ? "deleting soon" : days === 1 ? "1 day left" : `${days} days left`;
};

const toRow = (s: Send) => ({
  uid: s.id,
  "sendIcon.image.src": s.type === 1 ? "doc" : "text.alignleft",
  "sendName.text": s.name,
  "sendInfo.text": [
    s.type === 1 ? (s.file?.fileName ?? "File") : "Text",
    daysLeft(s.deletionDate),
    `${s.accessCount}${s.maxAccessCount ? `/${s.maxAccessCount}` : ""} views`,
    s.passwordSet && "password",
    s.disabled && "disabled",
  ]
    .filter(Boolean)
    .join(" · "),
  url: s.accessUrl,
  match: s.name,
});

export const sendsInit = async (): Promise<Action> =>
  status((await getSession()) ? "Loading Sends…" : "Locked");

export const loadSends = async (active: string): Promise<Action> => {
  const sends = (await bwJson<Send[]>(["send", "list"], { session: active })).toSorted(
    (a, b) => Date.parse(a.deletionDate) - Date.parse(b.deletionDate),
  );
  return merge(
    vars({ send_urls: JSON.stringify(Object.fromEntries(sends.map((s) => [s.id, s.accessUrl]))) }),
    update({ sends: { data: { src: sends.map(toRow) } } }),
    fn({ sends: ["filterdata", "selectfirst"] }),
    status(
      sends.length
        ? `${sends.length} Sends · ↩ copy link · ⌘N new · ⌘⌫ delete`
        : "No Sends yet · ⌘N to create one",
    ),
  );
};

export const sendsLoad = (): Promise<Action> => withSession("sends", loadSends);

const urlFor = (id: string): string =>
  (JSON.parse(process.env.send_urls || "{}") as Record<string, string>)[id] ?? "";

export const sendCopy = async ([id = ""]: string[]): Promise<Action> => {
  const url = urlFor(id);
  if (!url) return status("Select a Send first", "systemOrangeColor");
  await copyText(url);
  return finish();
};

export const sendDelete = ([id = ""]: string[]): Promise<Action> =>
  withSession("sends", async (active) => {
    await bw(["send", "delete", id], { session: active });
    return merge(await loadSends(active), status("Send deleted"));
  });

const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

/** New Send. Text and password come in env (`send_text`, `secret_input`), not args. */
export const sendCreate = ([
  type = "text",
  name = "",
  days = "7",
  maxViews = "",
  hidden = "false",
  file = "",
]: string[]): Promise<Action> =>
  withSession("sends", async (active) => {
    const password = str("secret_input");
    const deletionDays = Number(days) || 7;
    try {
      if (!name.trim()) throw new Error("Give the Send a name");
      let created: Send;
      if (type === "file") {
        if (!file) throw new Error("Choose a file");
        if (password)
          throw new Error(
            "Create password-protected file Sends in Bitwarden. This CLI path exposes the password in process arguments.",
          );
        const args = ["send", "-n", name, "-d", String(deletionDays), "-f", file];
        created = JSON.parse(await bw(args, { session: active })) as Send;
      } else {
        const text = process.env.send_text ?? "";
        if (!text.trim()) throw new Error("Write the text to send");
        const payload = {
          name,
          notes: null,
          type: 0,
          text: { text, hidden: hidden === "true" || hidden === "1" },
          file: null,
          maxAccessCount: Number(maxViews) > 0 ? Number(maxViews) : null,
          deletionDate: isoInDays(deletionDays),
          expirationDate: null,
          password: password || null,
          disabled: false,
          hideEmail: false,
        };
        created = await bwJson<Send>(["send", "create"], { session: active, input: encode(payload) });
      }
      await copyText(created.accessUrl);
      return merge(
        closeSheet("newSendSheet"),
        vars({ secret_input: "", send_text: "" }),
        await loadSends(active),
        status("Send created · link copied"),
      );
    } catch (error) {
      return merge(
        update({ sheetStatus: { text: error instanceof Error ? error.message : String(error) } }),
        vars({ secret_input: "" }),
      );
    }
  });

/** Receive a Send link: text shows in the sheet, files go to ~/Downloads. */
export const sendReceive = async ([url = ""]: string[]): Promise<Action> => {
  const password = str("secret_input");
  try {
    if (!/^https?:\/\//.test(url.trim())) throw new Error("Paste a Send link");
    const info = JSON.parse(
      await bw(["send", "receive", url.trim(), "--obj"], {
        input: password ? `${password}\n` : "",
        interactive: true,
      }),
    ) as Send;
    if (info.type === 1) {
      const target = join(homedir(), "Downloads", info.file?.fileName ?? "send");
      await bw(["send", "receive", url.trim(), "--output", target], {
        input: password ? `${password}\n` : "",
        interactive: true,
      });
      return merge(
        vars({ secret_input: "" }),
        update({ receivedText: { text: `Saved to ${target}` }, sheetStatus: { text: "" } }),
      );
    }
    return merge(
      vars({ secret_input: "" }),
      update({ receivedText: { text: info.text?.text ?? "" }, sheetStatus: { text: "" } }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return merge(
      vars({ secret_input: "" }),
      update({ sheetStatus: { text: /password/i.test(message) ? "This Send needs its password" : message } }),
    );
  }
};
