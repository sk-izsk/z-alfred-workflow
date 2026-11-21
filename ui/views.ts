import {
  arrows,
  closeWindow,
  footer,
  footerButton,
  json,
  type Json,
  key,
  inlineLabel,
  label,
  on,
  run,
  searchField,
  secretVars,
  selectionColours,
  symbol,
  window,
} from "./shared.ts";

const sel = (list: string) => `{value:${list}.selected.uid}`;
const item = (action: string) => run(["item", action, sel("items")]);

// ───────────────────────── Search Vault ─────────────────────────

const rowCell: Json = {
  id: "rowCell",
  type: "view",
  layout: "border",
  padding: 6,
  spacing: 10,
  cornerradius: 8,
  events: [on("doubleclicked", run(["item", "primary", "{data:uid}"]))],
  components: [
    symbol("rowIcon", "globe", {
      // Fixed 26px column so names line up; the image keeps its aspect inside it.
      constraints: {
        region: "left",
        position: "centre",
        size: { width: 26, height: 26 },
        insets: { left: 2, right: 2 },
      },
      resize: "fit",
      image: { type: "symbol", src: "globe", size: { height: 19 } },
    }),
    {
      constraints: { region: "centre", position: "left", stretch: "horizontal" },
      type: "view",
      layout: "inline",
      direction: "vertical",
      spacing: 1,
      components: [
        label("rowTitle", { font: { size: 14, weight: "medium" }, constraints: { size: { height: 18 } } }),
        label("rowSubtitle", {
          colour: "secondaryLabelColor",
          font: { size: 11 },
          constraints: { size: { height: 15 } },
        }),
      ],
    },
    {
      constraints: { region: "right", position: "centre" },
      type: "view",
      layout: "inline",
      spacing: 8,
      components: [
        symbol("rowSuggested", "location.fill", {
          tooltip: "Matches the page you're on",
          contenttintcolour: "systemBlueColor",
        }),
        {
          id: "rowFolderPill",
          type: "view",
          layout: "inline",
          constraints: { position: "centre" },
          spacing: 3,
          components: [
            symbol("rowFolderIcon", "folder", {
              image: { type: "symbol", src: "folder", size: { height: 12 } },
              contenttintcolour: "tertiaryLabelColor",
            }),
            inlineLabel("rowFolder", { colour: "secondaryLabelColor", font: { size: 12.5 } }),
          ],
        },
        symbol("rowPasskey", "person.badge.key", { tooltip: "Has a passkey" }),
        symbol("rowLock", "lock", { tooltip: "Master password re-prompt" }),
        {
          // One fixed TOTP slot: the live code + ring, or (code hidden) a clock centred in it.
          type: "view",
          layout: "stack",
          constraints: { size: { width: 104, height: 24 }, position: "centre" },
          components: [
            {
              type: "view",
              layout: "inline",
              spacing: 8,
              constraints: { position: "centre" },
              components: [
                inlineLabel("rowCode", {
                  hidden: true,
                  text: "000 000",
                  textalign: "right",
                  constraints: { size: { width: 70 } },
                  font: { size: 15, weight: "light", monospaced: "digits" },
                  tooltip: "Current TOTP · ⌘T to copy",
                }),
                {
                  // Countdown ring with the seconds inside it.
                  id: "rowRingBox",
                  type: "view",
                  layout: "stack",
                  hidden: true,
                  constraints: { size: 22, position: "centre" },
                  components: [
                    { id: "rowRing", type: "progress", style: "round", thickness: 2 },
                    inlineLabel("rowSecs", {
                      text: "30",
                      textalign: "centre",
                      font: { size: 8, weight: "medium", monospaced: "digits" },
                    }),
                  ],
                },
              ],
            },
            symbol("rowTotp", "clock", { tooltip: "Has a TOTP key" }),
          ],
        },
        symbol("rowStar", "star.fill", { tooltip: "Favorite", contenttintcolour: "systemYellowColor" }),
      ],
    },
  ],
};

const searchList: Json = {
  constraints: { region: "centre" },
  id: "items",
  type: "dataview",
  padding: 6,
  spacing: 2,
  placeholder: "No matching items",
  behaviour: { selection: { wrap: "none" } },
  data: {
    type: "basic",
    src: [],
    filter: {
      type: "basic",
      args: "match",
      match: "{value:searchField.text}",
      matchmode: "wordmatchanyorder",
    },
  },
  cell: {
    height: 40,
    ...selectionColours(
      "rowCell",
      ["rowTitle", "rowSubtitle", "rowFolder"],
      ["rowIcon", "rowLock", "rowTotp", "rowPasskey", "rowFolderIcon"],
    ),
    root: rowCell,
  },
  events: [
    on("changed", [
      json({}, { selected_id: sel("items") }),
      run(["selected", sel("items")], { async: true }),
    ]),
  ],
};

const searchTop: Json = {
  constraints: { region: "top" },
  type: "view",
  layout: "border",
  padding: 12,
  spacing: 10,
  components: [
    {
      constraints: { region: "centre" },
      ...searchField("searchField", "Search Vault", "items", item("primary")),
    },
    {
      constraints: { region: "right", position: "centre" },
      id: "folderPicker",
      type: "picker",
      tooltip: "Folder ⌘P",
      items: [{ text: "All Items", value: "all" }],
      selected: "{var:folder_filter}",
      events: [on("changed", run(["folder", "{value:self.selected.value}"]))],
    },
  ],
};

export const search = window(
  {
    type: "view",
    layout: "border",
    events: [
      on("preload", run(["search-init"])),
      on("launched", [run(["search-site"], { async: true }), run(["search-refresh"], { async: true })]),
    ],
    shortcuts: [
      ...arrows("items"),
      key("⌘C", item("copy-password")),
      key("⌘U", item("copy-username")),
      key("⌘T", item("copy-totp")),
      key("⌘O", item("open-url")),
      key("⌘Y", item("details")),
      key("⌘I", item("details")),
      key("{var:actions_shortcut}", item("menu")),
      key("⌘R", run(["sync"], { async: true })),
      key("⌘L", run(["lock-ui"])),
      key("⌘P", json({ update: { ids: { folderPicker: { focus: true } } } })),
      key("⌘F", json({ update: { ids: { searchField: { focus: true } } } })),
    ],
    components: [
      searchTop,
      searchList,
      footer([
        // Sized to its text: hidden in row mode, so it must not reserve space.
        inlineLabel("totpLabel", {
          hidden: true,
          font: { size: "small", monospaced: "digits" },
          tooltip: "Current TOTP · ⌘T to copy",
        }),
        footerButton("primaryButton", "Autofill  ↩", item("primary")),
        footerButton("actionsButton", "Actions  {var:actions_shortcut}", item("menu")),
        // ⌘↩ as a root shortcut swallows every ⌘ key in Alfred UI; a button key equivalent doesn't.
        footerButton("pasteButton", "", item("paste-password"), {
          shortcut: "⌘↩",
          opacity: 0,
          constraints: { size: { width: 0, height: 0 } },
        }),
      ]),
    ],
  },
  {
    variablesconfig: {
      ...secretVars,
      page_url: { scriptenv: true, default: "" },
      totp_seeds: { scriptenv: true, default: "" },
      fill_data: { scriptenv: true, default: "" },
      selected_id: { scriptenv: true, default: "" },
      folder_filter: { persist: true, scriptenv: true, default: "all" },
      actions_shortcut: { src: "variable", default: "⌘K" },
    },
    // Started by loadVault (`{ pulse: { interval: 1 } }`); a static pulse alone doesn't run.
    pulse: { interval: 1, intervalmode: "regular", src: "../bin/bwa", args: ["search-tick"] },
  },
);

// ───────────────────────── Generate Password ─────────────────────────

const GEN = [
  "type",
  "length",
  "upper",
  "lower",
  "number",
  "special",
  "words",
  "separator",
  "capitalize",
  "includeNumber",
];
const genArgs = (source: "value" | "var") => [
  "gen",
  ...(source === "var"
    ? GEN.map((k) => `{var:gen_${k}}`)
    : [
        "{value:genType.selected.value}",
        "{value:genLength.text}",
        "{value:genUpper.checked}",
        "{value:genLower.checked}",
        "{value:genNumber.checked}",
        "{value:genSpecial.checked}",
        "{value:genWords.text}",
        "{value:genSeparator.text}",
        "{value:genCapitalize.checked}",
        "{value:genIncludeNumber.checked}",
      ]),
];
const regenerate = run(genArgs("value"));

const formLabel = (text: string): Json => ({
  type: "label",
  text,
  colour: "secondaryLabelColor",
  constraints: { position: "right", size: { width: 150 } },
});
const textInput = (id: string, varName: string, width = 90): Json => ({
  id,
  type: "textfield",
  text: `{var:${varName}}`,
  focusring: false,
  textinsets: { horizontal: 6, vertical: 4 },
  constraints: { size: { width } },
  events: [on("typingstopped", regenerate)],
});
/** Every control column is 260 wide, so the stacked forms line up under "Type". */
const CONTROL_WIDTH = 260;
const checkbox = (id: string, varName: string, text: string): Json => ({
  id,
  type: "checkbox",
  constraints: { size: { width: CONTROL_WIDTH } },
  text,
  checked: `{var:${varName}}`,
  events: [on("changed", regenerate)],
});
const form = (id: string, components: Json[]): Json => ({
  id,
  type: "view",
  layout: "form",
  spacing: 8,
  components,
});

export const generator = window(
  {
    type: "view",
    layout: "border",
    events: [on("launched", run(genArgs("var"), { async: true }))],
    components: [
      {
        constraints: { region: "top" },
        type: "view",
        layout: "border",
        padding: 20,
        components: [
          {
            ...formLabel("🔑 Password"),
            constraints: { region: "left", size: { width: 150 }, insets: { right: 12 } },
          },
          {
            constraints: { region: "centre" },
            id: "preview",
            type: "label",
            text: "",
            selectable: true,
            linebreak: "charwrap",
            font: { size: 18, monospaced: true },
          },
        ],
      },
      {
        constraints: { region: "centre", position: "top", stretch: "horizontal" },
        type: "view",
        layout: "inline",
        direction: "vertical",
        padding: 16,
        spacing: 10,
        components: [
          {
            ...form("genMain", [
              formLabel("Type"),
              {
                id: "genType",
                type: "picker",
                constraints: { size: { width: CONTROL_WIDTH } },
                focus: true,
                items: [
                  { text: "Password", value: "password" },
                  { text: "Passphrase", value: "passphrase" },
                ],
                selected: "{var:gen_type}",
                events: [on("changed", regenerate)],
              },
            ]),
            constraints: { position: "centre" },
          },
          {
            // Both option groups overlap; only the visible one shows (hidden views keep their space).
            type: "view",
            layout: "stack",
            constraints: { position: "centre" },
            components: [
              {
                ...form("passwordOptions", [
                  formLabel("Length"),
                  textInput("genLength", "gen_length"),
                  formLabel("Uppercase characters"),
                  checkbox("genUpper", "gen_upper", "A–Z"),
                  formLabel("Lowercase characters"),
                  checkbox("genLower", "gen_lower", "a–z"),
                  formLabel("Numeric characters"),
                  checkbox("genNumber", "gen_number", "0–9"),
                  formLabel("Special characters"),
                  checkbox("genSpecial", "gen_special", "!@#$%^&*"),
                ]),
                constraints: { position: "top" },
              },
              {
                ...form("passphraseOptions", [
                  formLabel("Number of words"),
                  textInput("genWords", "gen_words"),
                  formLabel("Word separator"),
                  textInput("genSeparator", "gen_separator", 50),
                  formLabel("Capitalise"),
                  checkbox("genCapitalize", "gen_capitalize", "This-Is-A-Passphrase"),
                  formLabel("Include number"),
                  checkbox("genIncludeNumber", "gen_includeNumber", "This2-Is-A-Passphrase"),
                ]),
                constraints: { position: "top" },
              },
            ],
          },
        ],
      },
      footer([
        footerButton("regenButton", "Regenerate  ⌘R", regenerate, { shortcut: "⌘R" }),
        footerButton("pasteButton", "Paste  ⌘↩", run(["gen-copy", "paste"]), { shortcut: "⌘↩" }),
        footerButton("copyButton", "Copy Password  ↩", run(["gen-copy"]), { shortcut: "↩" }),
      ]),
    ],
  },
  {
    variablesconfig: {
      generated: { scriptenv: true, default: "" },
      query: { src: "args[0]", default: "" },
      gen_type: { persist: true, default: "password" },
      gen_length: { persist: true, default: 16 },
      gen_upper: { persist: true, default: true },
      gen_lower: { persist: true, default: true },
      gen_number: { persist: true, default: true },
      gen_special: { persist: true, default: false },
      gen_words: { persist: true, default: 3 },
      gen_separator: { persist: true, default: "-" },
      gen_capitalize: { persist: true, default: true },
      gen_includeNumber: { persist: true, default: true },
    },
  },
);

// ───────────────────────── Authenticator ─────────────────────────

export const authenticator = window(
  {
    type: "view",
    layout: "border",
    events: [on("preload", run(["auth-init"])), on("launched", run(["auth-load"], { async: true }))],
    shortcuts: [...arrows("codes")],
    components: [
      {
        constraints: { region: "top" },
        type: "view",
        layout: "stack",
        padding: 12,
        components: [
          searchField("searchField", "Search Authenticator", "codes", run(["auth-copy", sel("codes")])),
        ],
      },
      {
        constraints: { region: "centre" },
        id: "codes",
        type: "dataview",
        padding: 6,
        spacing: 2,
        placeholder: "Loading…",
        data: {
          type: "basic",
          src: [],
          filter: {
            type: "basic",
            args: "match",
            match: "{value:searchField.text}",
            matchmode: "wordmatchanyorder",
          },
        },
        cell: {
          height: 52,
          ...selectionColours("authCell", ["authName", "authUser", "authTime"]),
          root: {
            id: "authCell",
            type: "view",
            layout: "border",
            padding: 8,
            cornerradius: 8,
            events: [on("doubleclicked", run(["auth-copy", "{data:uid}"]))],
            components: [
              {
                constraints: { region: "centre" },
                type: "view",
                layout: "inline",
                direction: "vertical",
                spacing: 2,
                components: [
                  label("authName", { font: { size: 15 } }),
                  label("authUser", { font: { size: "small" } }),
                ],
              },
              {
                constraints: { region: "right" },
                type: "view",
                layout: "inline",
                spacing: 10,
                components: [
                  label("authCode", { font: { size: 24, weight: "light", monospaced: "digits" } }),
                  {
                    id: "authProgress",
                    type: "progress",
                    style: "round",
                    thickness: 3,
                    constraints: { size: 20, position: "centre" },
                  },
                  label("authTime", {
                    font: { size: "small", monospaced: "digits" },
                    constraints: { size: { width: 28 }, position: "centre" },
                  }),
                ],
              },
            ],
          },
        },
      },
      footer([
        footerButton("pasteButton", "Paste  ⌘↩", run(["auth-copy", sel("codes"), "paste"]), {
          shortcut: "⌘↩",
        }),
        footerButton("copyButton", "Copy Code  ↩", run(["auth-copy", sel("codes")])),
      ]),
    ],
  },
  {
    variablesconfig: { ...secretVars, auth_entries: { scriptenv: true, default: "" } },
    pulse: { interval: 0, intervalmode: "regular", src: "../bin/bwa", args: ["auth-tick"] },
  },
);

// ───────────────────────── Sends ─────────────────────────

const sheetText = (id: string, placeholder: string, extra: Json = {}): Json => ({
  id,
  type: "textfield",
  placeholder,
  focusring: false,
  textinsets: { horizontal: 6, vertical: 5 },
  ...extra,
});
const sheetStatus = label("sheetStatus", {
  colour: "systemRedColor",
  font: { size: "small" },
  linebreak: "wordwrap",
});
const buttonRow = (buttons: Json[]): Json => ({
  constraints: { position: "right" },
  type: "view",
  layout: "inline",
  spacing: 8,
  components: buttons,
});
const button = (text: string, action: Json | Json[], extra: Json = {}): Json => ({
  type: "button",
  text,
  events: [on("actioned", action)],
  ...extra,
});

const newSendSheet = json({
  sheet: {
    id: "newSendSheet",
    root: {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 20,
      spacing: 10,
      constraints: { size: { width: 440 } },
      components: [
        { type: "label", text: "New Send", font: { size: 17, weight: "semibold" } },
        {
          id: "sendType",
          type: "picker",
          items: [
            { text: "Text", value: "text" },
            { text: "File", value: "file" },
          ],
        },
        sheetText("sendName", "Name", { focus: true }),
        {
          id: "sendTextArea",
          type: "textarea",
          text: "",
          editable: true,
          bordertype: "bezel",
          textinsets: { horizontal: 6, vertical: 6 },
          constraints: { size: { height: 100 } },
        },
        {
          type: "view",
          layout: "inline",
          spacing: 8,
          components: [
            button(
              "Choose File…",
              json({
                opendialog: {
                  prompt: "Choose",
                  setvariable: "send_file",
                  action: json({
                    update: {
                      ids: { sendFileLabel: { text: "{var:send_file}" }, sendType: { selected: "file" } },
                    },
                  }),
                },
              }),
            ),
            label("sendFileLabel", {
              colour: "secondaryLabelColor",
              font: { size: "small" },
              linebreak: "truncatemiddle",
            }),
          ],
        },
        {
          type: "view",
          layout: "form",
          spacing: 8,
          components: [
            { type: "label", text: "Delete after", constraints: { position: "right" } },
            {
              id: "sendDays",
              type: "picker",
              items: [1, 2, 3, 7, 14, 30].map((d) => ({
                text: d === 1 ? "1 day" : `${d} days`,
                value: String(d),
              })),
              selected: "7",
            },
            { type: "label", text: "Max views", constraints: { position: "right" } },
            sheetText("sendMaxViews", "Unlimited", { constraints: { size: { width: 100 } } }),
            { type: "label", text: "Password", constraints: { position: "right" } },
            {
              id: "sendPassword",
              type: "passwordfield",
              placeholder: "Optional",
              focusring: false,
              textinsets: { horizontal: 6, vertical: 5 },
            },
            {},
            { id: "sendHidden", type: "checkbox", text: "Hide text by default" },
          ],
        },
        sheetStatus,
        buttonRow([
          button("Cancel", json({ sheet: { close: "newSendSheet" } })),
          button(
            "Create & Copy Link",
            [
              json({}, { secret_input: "{value:sendPassword.text}", send_text: "{value:sendTextArea.text}" }),
              run([
                "send-create",
                "{value:sendType.selected.value}",
                "{value:sendName.text}",
                "{value:sendDays.selected.value}",
                "{value:sendMaxViews.text}",
                "{value:sendHidden.checked}",
                "{var:send_file}",
              ]),
            ],
            { shortcut: "⌘↩" },
          ),
        ]),
      ],
    },
  },
});

const receiveAction = [
  json({}, { secret_input: "{value:receivePassword.text}" }),
  run(["send-receive", "{value:receiveUrl.text}"]),
];

const receiveSheet = json({
  sheet: {
    id: "receiveSheet",
    root: {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 20,
      spacing: 10,
      constraints: { size: { width: 440 } },
      components: [
        { type: "label", text: "Receive Send", font: { size: 17, weight: "semibold" } },
        sheetText("receiveUrl", "https://send.bitwarden.com/#…", {
          focus: true,
          events: [on("actioned", receiveAction)],
        }),
        {
          id: "receivePassword",
          type: "passwordfield",
          placeholder: "Password (if it has one)",
          focusring: false,
          textinsets: { horizontal: 6, vertical: 5 },
        },
        {
          id: "receivedText",
          type: "textarea",
          text: "",
          editable: false,
          selectable: true,
          bordertype: "bezel",
          textinsets: { horizontal: 6, vertical: 6 },
          constraints: { size: { height: 120 } },
        },
        sheetStatus,
        buttonRow([
          button("Close", json({ sheet: { close: "receiveSheet" } })),
          button("Copy Text", json({ copy: { type: "text", src: "{value:receivedText.text}" } })),
          button("Receive", receiveAction),
        ]),
      ],
    },
  },
});

export const sends = window(
  {
    type: "view",
    layout: "border",
    events: [on("preload", run(["sends-init"])), on("launched", run(["sends-load"], { async: true }))],
    shortcuts: [...arrows("sends"), key("⌘N", newSendSheet), key("⌘R", receiveSheet)],
    components: [
      {
        constraints: { region: "top" },
        type: "view",
        layout: "stack",
        padding: 12,
        components: [searchField("searchField", "Search Sends", "sends", run(["send-copy", sel("sends")]))],
      },
      {
        constraints: { region: "centre" },
        id: "sends",
        type: "dataview",
        padding: 6,
        spacing: 2,
        placeholder: "No Sends",
        data: {
          type: "basic",
          src: [],
          filter: {
            type: "basic",
            args: "match",
            match: "{value:searchField.text}",
            matchmode: "wordmatchanyorder",
          },
        },
        cell: {
          height: 48,
          ...selectionColours("sendCell", ["sendName", "sendInfo"], ["sendIcon"]),
          root: {
            id: "sendCell",
            type: "view",
            layout: "border",
            padding: 6,
            spacing: 10,
            cornerradius: 8,
            components: [
              symbol("sendIcon", "text.alignleft", {
                constraints: { region: "left", position: "centre", insets: { left: 4, right: 4 } },
                image: { type: "symbol", src: "text.alignleft", size: { height: 16 } },
              }),
              {
                constraints: { region: "centre", position: "left", stretch: "horizontal" },
                type: "view",
                layout: "inline",
                direction: "vertical",
                spacing: 1,
                components: [
                  label("sendName", {
                    font: { size: 14, weight: "medium" },
                    constraints: { size: { height: 18 } },
                  }),
                  label("sendInfo", { font: { size: 11 }, constraints: { size: { height: 15 } } }),
                ],
              },
            ],
          },
        },
      },
      footer([
        footerButton("receiveButton", "Receive  ⌘R", receiveSheet),
        footerButton("newButton", "New  ⌘N", newSendSheet),
        {
          type: "button",
          text: "Delete  ⌘⌫",
          bordered: false,
          shortcut: "⌘⌫",
          font: { size: "small", weight: "medium" },
          events: [
            {
              triggers: "actioned",
              confirm: {
                message: "Delete this Send?",
                informativetext: "The link stops working for everyone.",
                confirmbuttontext: "Delete",
              },
              action: run(["send-delete", sel("sends")]),
            },
          ],
        },
        footerButton("copyButton", "Copy Link  ↩", run(["send-copy", sel("sends")])),
      ]),
    ],
  },
  {
    variablesconfig: {
      ...secretVars,
      send_urls: { scriptenv: true, default: "" },
      send_text: { scriptenv: true, default: "" },
      send_file: { scriptenv: true, default: "" },
    },
  },
);

// ───────────────────────── New Login / Note ─────────────────────────

const save = [
  json(
    {},
    {
      secret_input: "{value:newPassword.text}",
      secret_totp: "{value:newTotp.text}",
      secret_notes: "{value:newNotes.text}",
    },
  ),
  run([
    "new-save",
    "{value:newType.selected.value}",
    "{value:newName.text}",
    "{value:newUsername.text}",
    "{value:newUrl.text}",
    "{value:newFolder.selected.value}",
    "{value:newFavorite.checked}",
  ]),
];

const field = (text: string, control: Json): Json[] => [formLabel(text), control];
const input = (id: string, placeholder: string, extra: Json = {}): Json =>
  sheetText(id, placeholder, { constraints: { size: { width: 320 } }, ...extra });

export const newLogin = window(
  {
    type: "view",
    layout: "border",
    events: [on("preload", run(["new-init"])), on("launched", run(["new-check"]))],
    components: [
      {
        constraints: { region: "centre" },
        type: "view",
        layout: "inline",
        direction: "vertical",
        padding: 20,
        spacing: 10,
        components: [
          form("newMain", [
            ...field("Type", {
              id: "newType",
              type: "picker",
              items: [
                { text: "Login", value: "login" },
                { text: "Secure Note", value: "note" },
              ],
              events: [on("changed", run(["new-type", "{value:self.selected.value}"]))],
            }),
            ...field("Name", input("newName", "e.g. GitHub", { focus: true })),
          ]),
          form("loginFields", [
            ...field("Username", input("newUsername", "Email or username")),
            ...field("Password", {
              type: "view",
              layout: "inline",
              spacing: 6,
              constraints: { position: "left" },
              components: [
                input("newPassword", "Password", {
                  font: { monospaced: true },
                  constraints: { size: { width: 280 } },
                }),
                {
                  type: "button",
                  bordered: false,
                  image: { type: "symbol", src: "arrow.triangle.2.circlepath" },
                  tooltip: "Generate ⌘G",
                  shortcut: "⌘G",
                  events: [on("actioned", run(["new-generate"]))],
                },
              ],
            }),
            ...field("Website", input("newUrl", "https://")),
            ...field(
              "Authenticator key",
              input("newTotp", "Optional TOTP setup key", { font: { monospaced: true } }),
            ),
          ]),
          form("newExtra", [
            ...field("Folder", {
              id: "newFolder",
              type: "picker",
              items: [{ text: "No Folder", value: "" }],
            }),
            ...field("Notes", {
              id: "newNotes",
              type: "textarea",
              text: "",
              editable: true,
              bordertype: "bezel",
              textinsets: { horizontal: 6, vertical: 6 },
              constraints: { size: { width: 320, height: 80 } },
            }),
            {},
            { id: "newFavorite", type: "checkbox", text: "Favorite" },
          ]),
        ],
      },
      footer([
        footerButton("cancelButton", "Cancel  ⎋", closeWindow),
        footerButton("saveButton", "Save  ⌘S", save, { shortcut: "⌘S" }),
      ]),
    ],
  },
  {
    variablesconfig: {
      ...secretVars,
      secret_totp: { scriptenv: true, default: "" },
      secret_notes: { scriptenv: true, default: "" },
    },
  },
);

export const packages: Record<string, Json> = {
  "search.alfredui": search,
  "generator.alfredui": generator,
  "authenticator.alfredui": authenticator,
  "sends.alfredui": sends,
  "newlogin.alfredui": newLogin,
};
