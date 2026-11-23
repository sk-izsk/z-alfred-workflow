import { currentTabUrl } from "../browser.ts";
import { bw, bwJson, encode } from "../bw.ts";
import { str } from "../env.ts";
import { getSession } from "../session.ts";
import { parseTotp } from "../totp.ts";
import { type Action, finish, merge, notify, status, update, vars } from "../ui.ts";
import { hostOf } from "../uri.ts";
import { type Folder, readCache } from "../vault.ts";
import { isAuthError, withSession } from "./account.ts";
import { DEFAULTS, generate, savedOptions } from "./generator.ts";

const folderItems = (folders: Folder[]) => [
  { text: "No Folder", value: "" },
  ...folders.filter((f) => f.id).map((f) => ({ text: f.name, value: f.id })),
];

/** preload: folders from cache, and the current tab as the website + name. */
export const newInit = async (): Promise<Action> => {
  const url = await currentTabUrl().catch(() => "");
  const host = hostOf(url);
  const name = host ? (host.split(".").slice(-2, -1)[0] ?? host) : "";
  return merge(
    update({
      newFolder: { items: folderItems(readCache()?.folders ?? []) },
      ...(url && { newUrl: { text: new URL(url).origin } }),
      ...(name && { newName: { text: name.charAt(0).toUpperCase() + name.slice(1) } }),
    }),
    status((await getSession()) ? "⌘S save · ⌘G generate password" : "Locked"),
  );
};

export const newGenerate = async (): Promise<Action> => {
  const options = savedOptions();
  const value = await generate(options.type === "password" ? options : { ...DEFAULTS, length: 20 });
  return update({ newPassword: { text: value } });
};

/** Type picker: notes hide the login-only fields. */
export const newType = ([type = "login"]: string[]): Action =>
  update({ loginFields: { hidden: type !== "login" } });

/**
 * Save. Plain fields come as args; password, TOTP key and notes come in env vars
 * (`secret_input`, `secret_totp`, `secret_notes`) so they never show up in `ps`.
 */
export const newSave = ([
  type = "login",
  name = "",
  username = "",
  url = "",
  folderId = "",
  favorite = "false",
]: string[]): Promise<Action> =>
  withSession("newlogin", async (active) => {
    const totp = str("secret_totp");
    try {
      if (!name.trim()) throw new Error("Give the item a name");
      if (totp) parseTotp(totp);
      const isLogin = type === "login";
      const item = {
        type: isLogin ? 1 : 2,
        name: name.trim(),
        notes: process.env.secret_notes || null,
        favorite: favorite === "true" || favorite === "1",
        folderId: folderId || null,
        organizationId: null,
        fields: [],
        reprompt: 0,
        secureNote: isLogin ? null : { type: 0 },
        login: isLogin
          ? {
              username: username || null,
              password: process.env.secret_input || null, // exactly as typed: no trimming
              totp: totp || null,
              uris: url ? [{ match: null, uri: url }] : [],
            }
          : null,
      };
      await bw(["create", "item"], { session: active, input: encode(item) });
      return merge(
        vars({ secret_input: "", secret_totp: "", secret_notes: "" }),
        notify("Bitwarden", `Saved “${item.name}”`),
        finish(),
      );
    } catch (error) {
      if (isAuthError(error)) throw error; // let withSession ask for the master password again
      return merge(
        vars({ secret_input: "", secret_totp: "", secret_notes: "" }),
        status(
          error instanceof Error && error.message.includes("authenticator")
            ? "Invalid TOTP key"
            : String(error instanceof Error ? error.message : error),
          "systemRedColor",
        ),
      );
    }
  });

/** Keyword "New Folder": Run Script, prints the notification text. */
export const createFolder = async ([name = ""]: string[]): Promise<void> => {
  const active = await getSession();
  if (!active) return void process.stdout.write("Vault is locked. Open it with the search keyword first.");
  if (!name.trim()) return void process.stdout.write("Type a folder name after the keyword");
  const folder = await bwJson<Folder>(["create", "folder"], {
    session: active,
    input: encode({ name: name.trim() }),
  });
  process.stdout.write(`Folder “${folder.name}” created`);
};

/** launched: ask to unlock if needed (sheets can't open during preload). */
export const newCheck = (): Promise<Action> =>
  withSession("newlogin", async () => status("⌘S save · ⌘G generate password"));
