import { encode, bw } from "../bw.ts";
import { copySecret, copyText, scheduleClear } from "../clipboard.ts";
import { bool, num, str } from "../env.ts";
import { readState, requireSession } from "../session.ts";
import { parseTotp, totpCode } from "../totp.ts";
import {
  type Action,
  finish,
  merge,
  open,
  popup,
  separator,
  script,
  sheet,
  status,
  update,
  vars,
} from "../ui.ts";
import { getItem, type Item, ItemType, readCache, TYPE_SYMBOL } from "../vault.ts";
import { type DetailField, detailsSheet, repromptSheet } from "../views.ts";
import { withSession } from "./account.ts";

// --- what each item can give us ---

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const nonEmpty = (fields: (DetailField | false)[]): DetailField[] =>
  fields.filter((f): f is DetailField => Boolean(f && f.value));

const f = (name: string, value: string | null | undefined, secret = false): DetailField => ({
  name,
  value: value ?? "",
  secret,
});

const customFields = (item: Item): DetailField[] =>
  (item.fields ?? []).map((c) =>
    f(c.name ?? "Field", c.type === 2 ? (c.value === "true" ? "Yes" : "No") : c.value, c.type === 1),
  );

/** The numbered rows of the details sheet (screenshots: card, identity, note). */
export const detailFields = (item: Item): DetailField[] => {
  const login = item.login;
  const card = item.card ?? {};
  const id = item.identity ?? {};
  const typed: Record<ItemType, (DetailField | false)[]> = {
    [ItemType.Login]: [
      f("Username", login?.username),
      f("Password", login?.password, true),
      Boolean(login?.totp) && f("TOTP", safeCode(login?.totp ?? "")),
      ...(login?.uris ?? []).map((u, i) => f(i ? `Website ${i + 1}` : "Website", u.uri)),
      (login?.fido2Credentials?.length ?? 0) > 0 && f("Passkey", "Stored · use it from your browser"),
    ],
    [ItemType.Card]: [
      f("Cardholder name", card.cardholderName),
      f("Brand", card.brand),
      f("Number", card.number, true),
      f(
        "Expiration month",
        card.expMonth ? `${card.expMonth.padStart(2, "0")} - ${MONTHS[Number(card.expMonth) - 1] ?? ""}` : "",
      ),
      f("Expiration year", card.expYear),
      f("Security code (CVV)", card.code, true),
    ],
    [ItemType.Identity]: [
      f("Title", id.title),
      f("First name", id.firstName),
      f("Middle name", id.middleName),
      f("Last name", id.lastName),
      f("Username", id.username),
      f("Company", id.company),
      f("Email", id.email),
      f("Phone", id.phone),
      f("Address", [id.address1, id.address2, id.address3].filter(Boolean).join(", ")),
      f("City", id.city),
      f("State", id.state),
      f("Postal code", id.postalCode),
      f("Country", id.country),
      f("Social security number", id.ssn, true),
      f("Passport number", id.passportNumber, true),
      f("License number", id.licenseNumber, true),
    ],
    [ItemType.Note]: [],
    [ItemType.SshKey]: [
      f("Public key", item.sshKey?.publicKey),
      f("Fingerprint", item.sshKey?.keyFingerprint),
      f("Private key", item.sshKey?.privateKey, true),
    ],
  };
  return nonEmpty([...(typed[item.type] ?? []), ...customFields(item), f("Notes", item.notes)]);
};

const safeCode = (seed: string): string => {
  try {
    return totpCode(seed);
  } catch {
    return "";
  }
};

// --- clipboard helpers ---

const clearSeconds = () => num("clipboard_clear", 60);

const copyOut = async (value: string, what: string): Promise<Action> => {
  if (!value) return status(`No ${what} on this item`, "systemOrangeColor");
  scheduleClear(await copySecret(value), clearSeconds());
  return bool("close_on_copy", true) ? finish() : status(`Copied ${what}`);
};

/** Copy now; Alfred closes the window and the post step presses ⌘V in your app. */
const pasteOut = async (value: string, what: string): Promise<Action> => {
  if (!value) return status(`No ${what} on this item`, "systemOrangeColor");
  return finish({ bw_out: "paste", bw_cc: String(await copySecret(value)) });
};

// --- actions ---

/** Actions that reveal a secret, so they honour Bitwarden's master-password re-prompt. */
const PROTECTED = new Set([
  "fill",
  "paste-password",
  "paste-totp",
  "copy-password",
  "copy-totp",
  "copy-notes",
  "details",
  "add-totp",
]);

const repromptFresh = () => Date.now() - (readState().repromptedAt ?? 0) < num("reprompt_grace", 5) * 60_000;

const primaryFor = (type: ItemType): string =>
  type === ItemType.Login ? str("enter_action", "fill") : "details";

type Handler = (item: () => Promise<Item>, id: string) => Promise<Action>;

const HANDLERS: Record<string, Handler> = {
  fill: async (_, id) => {
    // Instant path: the window already holds this login (see search.ts fillData).
    const data = (
      JSON.parse(process.env.fill_data || "{}") as Record<string, { u: string; p: string; t: string }>
    )[id];
    return finish({
      bw_out: "fill",
      item_id: id,
      ...(data && { fill_u: data.u, fill_p: data.p, fill_t: data.t, fill_ready: "1" }),
    });
  },
  "paste-password": async (item) => pasteOut((await item()).login?.password ?? "", "password"),
  "paste-username": async (item) => pasteOut((await item()).login?.username ?? "", "username"),
  "paste-totp": async (item) => pasteOut(safeCode((await item()).login?.totp ?? ""), "TOTP"),
  "copy-password": async (item) => copyOut((await item()).login?.password ?? "", "password"),
  "copy-username": async (item) => {
    const value = (await item()).login?.username ?? "";
    if (!value) return status("No username on this item", "systemOrangeColor");
    await copyText(value);
    return bool("close_on_copy", true) ? finish() : status("Copied username");
  },
  "copy-totp": async (item) => copyOut(safeCode((await item()).login?.totp ?? ""), "TOTP"),
  "copy-notes": async (item) => copyOut((await item()).notes ?? "", "notes"),
  "open-url": async (_, id) => {
    const url = readCache()?.items.find((m) => m.id === id)?.uris[0] ?? "";
    if (!url) return status("No website on this item", "systemOrangeColor");
    return merge(open(/^\w+:\/\//.test(url) ? url : `https://${url}`), finish());
  },
  details: async (item, id) => {
    const full = await item();
    return detailsSheet(id, full.name, TYPE_SYMBOL[full.type] ?? "doc", detailFields(full), full.notes ?? "");
  },
  favorite: async (item) => {
    const full = await item();
    await bw(["edit", "item", full.id], {
      session: await requireSession(),
      input: encode({ ...full, favorite: !full.favorite }),
    });
    const { loadVault } = await import("./search.ts");
    return merge(
      await loadVault(await requireSession(), true),
      status(full.favorite ? "Removed from favorites" : "Added to favorites"),
    );
  },
  "add-totp": async (_, id) => addTotpSheet(id),
  menu: async (_, id) => menuFor(id),
};

export const runItemAction = async (action: string, id: string, reprompted = false): Promise<Action> => {
  const meta = readCache()?.items.find((m) => m.id === id);
  if (!meta) return status("Select an item first", "systemOrangeColor");
  const resolved = action === "primary" ? primaryFor(meta.type) : action;
  if (meta.reprompt === 1 && PROTECTED.has(resolved) && !reprompted && !repromptFresh()) {
    return repromptSheet(resolved, id);
  }
  const handler = HANDLERS[resolved];
  if (!handler) return status(`Unknown action: ${resolved}`, "systemRedColor");
  return withSession("search", (active) => handler(() => getItem(active, id), id));
};

export const itemCommand = ([action = "", id = ""]: string[]): Promise<Action> => runItemAction(action, id);

/** Details sheet: copy field number N. */
export const fieldCommand = ([id = "", index = "0"]: string[]): Promise<Action> =>
  withSession("search", async (active) => {
    const field = detailFields(await getItem(active, id))[Number(index)];
    if (!field) return status("No field there", "systemOrangeColor");
    return field.secret
      ? copyOut(field.value, field.name.toLowerCase())
      : (await copyText(field.value),
        bool("close_on_copy", true) ? finish() : status(`Copied ${field.name.toLowerCase()}`));
  });

// --- ⌘K menu ---

const entry = (text: string, action: string, id: string): Action => ({
  text,
  action: script(["item", action, id]),
});

export const menuFor = (id: string): Action => {
  const meta = readCache()?.items.find((m) => m.id === id);
  if (!meta) return status("Select an item first", "systemOrangeColor");
  const login = meta.type === ItemType.Login;
  return popup(
    "actionsButton",
    [
      login && entry("Autofill  ↩", "fill", id),
      login && meta.hasPassword && entry("Copy Password  ⌘C", "copy-password", id),
      login && meta.hasPassword && entry("Paste Password  ⌘↩", "paste-password", id),
      login && meta.username && entry("Copy Username  ⌘U", "copy-username", id),
      login && meta.username && entry("Paste Username", "paste-username", id),
      login && meta.hasTotp && entry("Copy TOTP  ⌘T", "copy-totp", id),
      login && meta.hasTotp && entry("Paste TOTP", "paste-totp", id),
      login && meta.uris.length > 0 && entry("Open in Browser  ⌘O", "open-url", id),
      separator,
      entry("Show Details  ⌘Y", "details", id),
      entry("Copy Notes", "copy-notes", id),
      login && entry(meta.hasTotp ? "Replace TOTP Key…" : "Add TOTP Key…", "add-totp", id),
      entry(meta.favorite ? "Remove from Favorites" : "Add to Favorites", "favorite", id),
    ].filter(Boolean) as Action[],
  );
};

// --- add / replace a TOTP key on a login ---

const addTotpSheet = (id: string): Action => {
  const submit = [
    { type: "json", variables: { secret_input: "{value:totpKeyField.text}" } },
    script(["set-totp", id]),
  ];
  return sheet("totpSheet", {
    type: "view",
    layout: "inline",
    direction: "vertical",
    padding: 20,
    spacing: 10,
    constraints: { size: { width: 380 } },
    components: [
      { type: "label", text: "Authenticator key", font: { size: 17, weight: "semibold" } },
      {
        type: "label",
        text: "Paste the setup key or otpauth:// link the site shows when you enable 2FA.",
        colour: "secondaryLabelColor",
        linebreak: "wordwrap",
        font: { size: "small" },
      },
      {
        id: "totpKeyField",
        type: "textfield",
        placeholder: "JBSW Y3DP EHPK 3PXP",
        focus: true,
        focusring: false,
        textinsets: { horizontal: 6, vertical: 6 },
        font: { monospaced: true },
        events: [{ triggers: "actioned", action: submit }],
      },
      { id: "sheetStatus", type: "label", text: "", colour: "systemRedColor", font: { size: "small" } },
      {
        type: "view",
        layout: "inline",
        spacing: 8,
        constraints: { position: "right" },
        components: [
          {
            type: "button",
            text: "Cancel",
            events: [
              { triggers: "actioned", action: { type: "json", src: { sheet: { close: "totpSheet" } } } },
            ],
          },
          { type: "button", text: "Save", events: [{ triggers: "actioned", action: submit }] },
        ],
      },
    ],
  });
};

export const setTotp = ([id = ""]: string[]): Promise<Action> =>
  withSession("search", async (active) => {
    const key = str("secret_input");
    try {
      parseTotp(key);
      totpCode(key);
    } catch {
      return merge(
        update({ sheetStatus: { text: "That doesn't look like a valid authenticator key" } }),
        vars({ secret_input: "" }),
      );
    }
    const item = await getItem(active, id);
    if (!item.login) return status("Only logins can have a TOTP key", "systemOrangeColor");
    await bw(["edit", "item", id], {
      session: active,
      input: encode({ ...item, login: { ...item.login, totp: key.trim() } }),
    });
    const { loadVault } = await import("./search.ts");
    return merge(
      { sheet: { close: "totpSheet" } },
      vars({ secret_input: "" }),
      await loadVault(active, true),
      status(`TOTP saved · code ${totpCode(key)}`),
    );
  });
