import { str } from "./env.ts";
import { type Action, finish, script, sheet } from "./ui.ts";

/** Views that can be reloaded after logging in / unlocking. */
export type View = "search" | "auth" | "sends" | "newlogin";

const label = (text: string, extra: Action = {}): Action => ({ type: "label", text, ...extra });
const title = (text: string): Action => label(text, { font: { size: 17, weight: "semibold" } });
const muted = (text: string): Action =>
  label(text, { colour: "secondaryLabelColor", linebreak: "wordwrap", font: { size: "small" } });
const sheetStatus: Action = label("", {
  id: "sheetStatus",
  colour: "systemRedColor",
  linebreak: "wordwrap",
  font: { size: "small" },
});

const field = (id: string, placeholder: string, extra: Action = {}): Action => ({
  id,
  type: "textfield",
  placeholder,
  focusring: false,
  textinsets: { horizontal: 6, vertical: 6 },
  ...extra,
});

const secretField = (id: string, placeholder: string, onEnter: Action[], focus = false): Action => ({
  id,
  type: "passwordfield",
  placeholder,
  focus,
  focusring: false,
  textinsets: { horizontal: 6, vertical: 6 },
  events: [{ triggers: "actioned", action: onEnter }],
});

const button = (text: string, action: Action | Action[], extra: Action = {}): Action => ({
  type: "button",
  text,
  events: [{ triggers: "actioned", action }],
  ...extra,
});

const buttons = (...items: (Action | false)[]): Action => ({
  constraints: { position: "right" },
  type: "view",
  layout: "inline",
  spacing: 8,
  components: items.filter(Boolean),
});

/** Close the whole window (Cancel on a sheet that must not be dismissed). */
/** A sheet blocks `finish`, so close the sheet first (Alfred applies `sheet` before `finish`). */
const closeWindow: Action = { type: "json", src: { sheet: { close: "authSheet" }, ...finish() } };

const column = (components: Action[], width = 340): Action => ({
  type: "view",
  layout: "inline",
  direction: "vertical",
  padding: 20,
  spacing: 10,
  constraints: { size: { width } },
  components,
});

const logo: Action = {
  type: "imageview",
  image: { type: "file", src: "../icon.png", size: { width: 44, height: 44 } },
};

/** Secrets ride in `secret_*` variables (env for the script), then the script clears them. */
const withSecrets = (secrets: Record<string, string>, args: string[]): Action[] => [
  { type: "json", variables: secrets },
  script(args),
];

export type LoginMethod = "password" | "apikey";

/**
 * Email + master password keeps two-step login in force, so it is the default.
 * The API key skips two-step login; it stays for accounts that need it.
 */
export const loginSheet = (view: View, method: LoginMethod = "password"): Action => {
  const apiKey = method === "apikey";
  const submit = apiKey
    ? withSecrets({ secret_input: "{value:clientSecretField.text}" }, [
        "login",
        view,
        "{value:clientIdField.text}",
        "{value:serverField.text}",
      ])
    : withSecrets({ secret_input: "{value:masterField.text}", secret_pin: "{value:codeField.text}" }, [
        "login-password",
        view,
        "{value:emailField.text}",
        "{value:serverField.text}",
        "{value:twoStepField.selected.value}",
      ]);
  const fields = apiKey
    ? [
        muted(
          "Use your personal API key: web vault → Settings → Security → Keys → View API key. It skips two-step login.",
        ),
        field("serverField", "Server URL (blank = bitwarden.com)", { text: str("server_url") }),
        field("clientIdField", "client_id", { focus: true }),
        secretField("clientSecretField", "client_secret", submit),
      ]
    : [
        muted(
          "Log in with your email and master password. Leave the code blank: if Bitwarden asks for one, it says so here (and emails it when that is the method).",
        ),
        field("serverField", "Server URL (blank = bitwarden.com)", { text: str("server_url") }),
        field("emailField", "Email", { focus: true }),
        secretField("masterField", "Master password", submit),
        {
          id: "twoStepField",
          type: "picker",
          items: [
            { text: "Two-step login: automatic", value: "" },
            { text: "Authenticator app", value: "authenticator" },
            { text: "Email code", value: "email" },
            { text: "YubiKey OTP", value: "yubikey" },
          ],
        },
        secretField("codeField", "Two-step or new-device code", submit),
      ];
  return sheet(
    "authSheet",
    column(
      [
        logo,
        title("Log in to Bitwarden"),
        ...fields,
        sheetStatus,
        buttons(
          button(
            apiKey ? "Use Email & Password" : "Use API Key",
            script(["login-sheet", view, apiKey ? "password" : "apikey"]),
          ),
          button("Cancel", closeWindow),
          button("Log In", submit),
        ),
      ],
      400,
    ),
  );
};

export type UnlockOptions = { email: string; pinMode: boolean; pinSet: boolean; touchId: boolean };

export const unlockSheet = (view: View, opts: UnlockOptions): Action => {
  const submit = withSecrets(
    { secret_input: "{value:masterField.text}", secret_pin: "{value:pinField.text}" },
    ["unlock", view],
  );
  const usePin = opts.pinMode && opts.pinSet;
  return sheet(
    "authSheet",
    column(
      [
        logo,
        title("Unlock Vault"),
        muted(opts.email || "Locked"),
        usePin && secretField("pinField", "PIN", submit, true),
        secretField("masterField", usePin ? "…or master password" : "Master password", submit, !usePin),
        opts.pinMode && !opts.pinSet && secretField("pinField", "Set a PIN for next time (optional)", submit),
        sheetStatus,
        buttons(
          opts.touchId && button("Touch ID", script(["quick-unlock", view]), { shortcut: "⌘T" }),
          button("Cancel", closeWindow),
          button("Unlock", submit),
        ),
      ].filter(Boolean) as Action[],
    ),
  );
};

export const repromptSheet = (action: string, id: string): Action => {
  const submit = withSecrets({ secret_input: "{value:repromptField.text}" }, ["reprompt", action, id]);
  return sheet(
    "repromptSheet",
    column([
      title("Master password re-prompt"),
      muted("This item is protected. Confirm your master password."),
      secretField("repromptField", "Master password", submit, true),
      sheetStatus,
      buttons(
        button("Cancel", { type: "json", src: { sheet: { close: "repromptSheet" } } }),
        button("Confirm", submit),
      ),
    ]),
  );
};

// --- item details (cards, identities, notes, logins) ---

/** `secret` masks the value on screen. `concealCopy` only hides the copy from clipboard managers and clears it later. */
export type DetailField = { name: string; value: string; secret?: boolean; concealCopy?: boolean };

const MASK = "••••••••••";

export const detailsSheet = (
  id: string,
  name: string,
  symbol: string,
  fields: DetailField[],
  notes: string,
): Action => {
  const shortcuts = fields.slice(0, 9).map((_, i) => ({
    shortcut: `⌘${i + 1}`,
    action: script(["field", id, String(i)]),
  }));
  const rows = fields.map((f, i) => ({
    uid: String(i),
    "detailIndex.text": i < 9 ? `${i + 1}.` : "",
    "detailName.text": f.name,
    "detailValue.text": f.secret ? MASK : f.value,
  }));
  const table: Action = {
    id: "detailFields",
    type: "dataview",
    focus: true,
    constraints: { size: { width: 560, height: Math.min(Math.max(fields.length, 1) * 34 + 8, 340) } },
    placeholder: "No fields",
    cell: {
      height: 32,
      init: {
        "detailCell.background": null,
        "detailName.colour": "labelColor",
        "detailValue.colour": "labelColor",
        "detailIndex.colour": "secondaryLabelColor",
      },
      selected: {
        "detailCell.background": "alfredSelectedResultBackgroundColor",
        "detailName.colour": "alfredSelectedResultTextColor",
        "detailValue.colour": "alfredSelectedResultTextColor",
        "detailIndex.colour": "alfredSelectedResultTextColor",
      },
      root: {
        id: "detailCell",
        type: "view",
        layout: "flex",
        cols: 3,
        rows: 1,
        padding: 6,
        spacing: 8,
        cornerradius: 6,
        components: [
          {
            constraints: { grid: { col: 0 }, size: { width: 24 } },
            id: "detailIndex",
            type: "label",
            colour: "secondaryLabelColor",
            font: { monospaced: "digits" },
          },
          {
            constraints: { grid: { col: 1 }, size: { width: 170 } },
            id: "detailName",
            type: "label",
            font: { weight: "semibold" },
          },
          {
            constraints: { grid: { col: 2, colweight: 1 } },
            id: "detailValue",
            type: "label",
            selectable: false,
            linebreak: "truncatemiddle",
          },
        ],
      },
    },
    data: { type: "basic", src: rows },
    events: [
      { triggers: "doubleclicked", action: script(["field", id, "{value:detailFields.selected.uid}"]) },
    ],
  };
  const notesArea: Action = {
    type: "textarea",
    text: notes,
    editable: false,
    selectable: true,
    font: { monospaced: true },
    background: "#80808022",
    textinsets: { horizontal: 8, vertical: 8 },
    constraints: { size: { width: 560, height: fields.length ? 90 : 220 } },
  };
  return sheet("detailsSheet", {
    type: "view",
    layout: "inline",
    direction: "vertical",
    padding: 16,
    spacing: 12,
    shortcuts: [
      ...shortcuts,
      { shortcut: "↩", action: script(["field", id, "{value:detailFields.selected.uid}"]) },
      { shortcut: "↑", action: { type: "function", src: "detailFields", args: "selectprevious" } },
      { shortcut: "↓", action: { type: "function", src: "detailFields", args: "selectnext" } },
    ],
    components: [
      {
        type: "view",
        layout: "inline",
        spacing: 8,
        components: [
          {
            type: "imageview",
            image: { type: "symbol", src: symbol, size: { width: 22 } },
            contenttintcolour: "labelColor",
          },
          label(name, { font: { size: 20, weight: "bold" } }),
        ],
      },
      fields.length > 0 && table,
      notes !== "" && notesArea,
      label("↩ Copy field   ⌘1–⌘9 Copy by number   ⎋ Close sheet", {
        colour: "tertiaryLabelColor",
        font: { size: "small" },
      }),
    ].filter(Boolean),
  });
};
