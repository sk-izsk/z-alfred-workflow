import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { bw, bwJson, encode } from "../bw.ts";
import { copyText } from "../clipboard.ts";
import { getSession, windowBinding, windowValid } from "../session.ts";
import { type Action, closeSheet, finish, fn, merge, status, update, vars } from "../ui.ts";
import { isAuthError, withSession } from "./account.ts";

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
  const binding = windowBinding(); // the unlock this load started under
  const sends = (await bwJson<Send[]>(["send", "list"], { session: active })).toSorted(
    (a, b) => Date.parse(a.deletionDate) - Date.parse(b.deletionDate),
  );
  return merge(
    vars({
      send_urls: JSON.stringify(Object.fromEntries(sends.map((s) => [s.id, s.accessUrl]))),
      ...binding,
    }),
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
  if (!(await windowValid())) return status("Vault locked. Reopen Sends to unlock.", "systemOrangeColor");
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

/** Blank = unlimited. Anything else must be a whole number of 1 or more, never silently "unlimited". */
export const parseMaxViews = (raw: string): number | null => {
  const text = raw.trim();
  if (text === "") return null;
  if (!/^\d+$/.test(text) || Number(text) < 1)
    throw new Error("Max views must be a whole number of 1 or more");
  return Number(text);
};

/**
 * Where a received file is saved: always inside `dir` (a hostile file name such as `../../x` is
 * reduced to its last part) and never over an existing file (`name (1).ext`, `name (2).ext`, …).
 */
export const downloadTarget = (
  dir: string,
  fileName: string,
  exists: (path: string) => boolean = existsSync,
): string => {
  const base = [...basename(fileName.replaceAll("\\", "/"))].filter((c) => c.charCodeAt(0) >= 32).join("");
  const safe = base === "" || base === "." || base === ".." ? "send" : base;
  const ext = extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  let target = join(dir, safe);
  for (let n = 1; exists(target); n++) target = join(dir, `${stem} (${n})${ext}`);
  return target;
};

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
    const password = process.env.secret_input ?? ""; // exactly as typed: spaces count
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
        const limit = parseMaxViews(maxViews);
        // Without --fullObject the CLI prints only the access URL, which is not JSON.
        const args = [
          "send",
          "-n",
          name,
          "-d",
          String(deletionDays),
          ...(limit ? ["-a", String(limit)] : []),
          "--fullObject",
          "-f",
          file,
        ];
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
          maxAccessCount: parseMaxViews(maxViews),
          deletionDate: isoInDays(deletionDays),
          expirationDate: null,
          password: password || null,
          disabled: false,
          hideEmail: false,
        };
        created = await bwJson<Send>(["send", "create"], { session: active, input: encode(payload) });
      }
      // The Send now exists. A failure from here on must not leave the sheet open to create it twice.
      let note = "Send created · link copied";
      try {
        await copyText(created.accessUrl);
      } catch {
        note = "Send created, but the link could not be copied";
      }
      let list: Action;
      try {
        list = await loadSends(active);
      } catch {
        list = status("Send created, but the list could not refresh");
        note = "";
      }
      return merge(
        closeSheet("newSendSheet"),
        vars({ secret_input: "", send_text: "" }),
        list,
        note !== "" && status(note),
      );
    } catch (error) {
      if (isAuthError(error)) throw error; // let withSession ask for the master password again
      return merge(
        update({ sheetStatus: { text: error instanceof Error ? error.message : String(error) } }),
        vars({ secret_input: "" }),
      );
    }
  });

/** Receive a Send link: text shows in the sheet, files go to ~/Downloads. */
export const sendReceive = async ([url = ""]: string[]): Promise<Action> => {
  const password = process.env.secret_input ?? "";
  try {
    if (!/^https?:\/\//.test(url.trim())) throw new Error("Paste a Send link");
    const info = JSON.parse(
      await bw(["send", "receive", url.trim(), "--obj"], {
        input: password ? `${password}\n` : "",
        interactive: true,
      }),
    ) as Send;
    if (info.type === 1) {
      const target = downloadTarget(join(homedir(), "Downloads"), info.file?.fileName ?? "send");
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
