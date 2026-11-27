import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { bool, cacheMinutes } from "./env.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { randomUUID } from "node:crypto";
import { create, read, save, pin, pinned, type State } from "./state.ts";
import { apiKey, loadRates, removeApiKey, saveApiKey } from "./api.ts";
import { parseQuery, validDate } from "./expression.ts";
import {
  components,
  rows,
  run,
  button,
  label,
  converted,
  amountText,
  flag,
  quickBaseButtons,
} from "../ui/window.ts";
import {
  print,
  merge,
  update,
  vars,
  errorStatus,
  popup,
  menuItem,
  copy,
  open,
  sheet,
  finish,
  type Action,
} from "./ui.ts";
import { quickBases, baseMatches, toggleQuickFavorite } from "./base-currencies.ts";
import { currencyCode2Name as names, currencyCode2CountryAndRegion as countries } from "./catalog.ts";
const populate = (s: State): Action => {
  const data = rows(s);
  return merge(
    update({
      items: {
        data: { src: data },
        select: s.selected && data.some((r) => r.uid === s.selected) ? s.selected : data[0]?.uid || "",
      },
    }),
    {
      pulse: {
        src: "../bin/fx",
        args: ["tick", s.id],
        interval: bool("auto_refresh", true) ? 60 : 0,
        now: false,
      },
    },
  );
};
const render = (s: State): Action =>
  merge(vars({ fx_session: s.id }), update({ root: { components: components(s) } }, true), {
    pulse: { src: "../bin/fx", args: ["populate", s.id], interval: 0, now: true },
  });
const load = async (s: State, fresh = false, initial = true): Promise<Action> => {
  const parsed = parseQuery(s.query);
  const requested = parsed.date || s.date,
    ticket = randomUUID();
  s.request = ticket;
  s.lastAttempt = Date.now();
  save(s);
  const rates =
    s.rates &&
    !fresh &&
    s.rates.date === requested &&
    Date.now() - s.rates.fetched < cacheMinutes("cache_minutes", 60) * 60000
      ? s.rates
      : await loadRates(requested, fresh);
  const latest = read(s.id);
  if (latest.request !== ticket) return {};
  latest.amount = parsed.amount;
  latest.filter = parsed.filter;
  latest.rates = rates;
  latest.date = requested;
  save(latest);
  if (initial) return render(latest);
  return merge(
    populate(latest),
    update(
      {
        sectionTitle: {
          text: `${latest.amount} ${latest.base} · ${rates.date || "Rate date unavailable"} · ${Object.keys(rates.rates).length} currencies · Pinned first`,
        },
        statusLabel: {
          text: rates.stale
            ? "Cached rates · provider stale or refresh failed"
            : `${rates.provider} · Reference rates`,
          colour: rates.stale ? "systemOrangeColor" : "secondaryLabelColor",
          tooltip: `Fetched ${new Date(rates.fetched).toISOString()} · Provider timestamp ${rates.asof}`,
        },
      },
      true,
    ),
  );
};
const baseRows = (s: State, query = "") =>
  baseMatches(s, query).map((code) => ({
    uid: code,
    code,
    "baseFavorite.text": quickBases(s).includes(code) ? "★" : "☆",
    "baseFavorite.tooltip": quickBases(s).includes(code) ? "Remove Quick Favorite" : "Add Quick Favorite",
    "baseFavorite.contenttintcolour": quickBases(s).includes(code)
      ? "systemYellowColor"
      : "secondaryLabelColor",
    "baseFlag.text": flag(code),
    "baseCode.text": code,
    "baseDescription.text": `${names[code] || code} · ${countries[code] || ""}`,
  }));
const chooseBaseSheet = (s: State): Action =>
  sheet(
    "baseSheet",
    {
      type: "view",
      layout: "border",
      padding: 16,
      spacing: 10,
      shortcuts: [
        { shortcut: "↑", action: { type: "function", src: "baseItems", args: "selectprevious" } },
        { shortcut: "↓", action: { type: "function", src: "baseItems", args: "selectnext" } },
      ],
      components: [
        {
          id: "baseSearch",
          type: "textfield",
          text: "",
          placeholder: "Search code, currency or country…",
          focus: true,
          background: null,
          bordered: false,
          constraints: { region: "top", size: { width: 510 } },
          events: [
            { triggers: "typingstopped", action: run("base-search", ["{value:self.text}"], false) },
            { triggers: "actioned", action: run("choose-base", ["{value:baseItems.selected.uid}"], false) },
          ],
        },
        {
          id: "baseItems",
          type: "dataview",
          data: { type: "basic", src: baseRows(s) },
          select: s.rates?.rates[s.base] ? s.base : baseMatches(s)[0] || "",
          placeholder: "No matching currencies",
          padding: 4,
          spacing: 2,
          constraints: { region: "centre", size: { width: 510, height: 300 } },
          events: [
            { triggers: "actioned", action: run("choose-base", ["{value:self.selected.uid}"], false) },
          ],
          cell: {
            height: 44,
            root: {
              id: "baseRow",
              type: "view",
              layout: "border",
              padding: 6,
              cornerradius: 6,
              components: [
                {
                  type: "view",
                  layout: "inline",
                  spacing: 4,
                  constraints: { region: "left", position: "centre", size: { width: 124, height: 26 } },
                  components: [
                    button(
                      "baseFavorite",
                      "☆",
                      run("base-favorite", ["{data:code}", "{value:baseSearch.text}"], false),
                      {
                        font: { size: 19 },
                        constraints: { position: "centre", size: { width: 26, height: 26 } },
                      },
                    ),
                    label("baseFlag", "", {
                      font: { size: 14 },
                      constraints: { position: "centre", size: { width: 22, height: 20 } },
                    }),
                    {
                      id: "baseCode",
                      type: "label",
                      text: "",
                      font: { size: 14, weight: "medium" },
                      constraints: { position: "centre", size: { width: 44, height: 20 } },
                    },
                  ],
                },
                {
                  id: "baseDescription",
                  type: "label",
                  text: "",
                  font: { size: 11 },
                  colour: "secondaryLabelColor",
                  linebreak: "truncatetail",
                  constraints: {
                    region: "centre",
                    position: "centre",
                    stretch: "horizontal",
                    size: { height: 20 },
                  },
                },
              ],
            },
            init: { "baseRow.background": null },
            selected: { "baseRow.background": "alfredSelectedResultBackgroundColor" },
          },
        },
        label("baseNotice", "Click ☆ to add a quick favorite; click ★ to remove. Limit: 3.", {
          font: { size: 11 },
          colour: "secondaryLabelColor",
          linebreak: "wordwrap",
          constraints: { region: "bottom", size: { width: 510, height: 30 } },
        }),
      ],
    },
    true,
    undefined,
    [
      button("applyBase", "Use Currency  ↩", run("choose-base", ["{value:baseItems.selected.uid}"], false), {
        shortcut: "↩",
      }),
    ],
  );
const main = async (): Promise<Action | void> => {
  const [command = "", id = "", ...args] = process.argv.slice(2);
  if (command === "prepare-origin") return vars(backVariables("fx_out", process.env.fx_query));
  if (command === "post") {
    if (process.env.fx_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (command === "launch") {
    const s = create(launchInput(process.env.fx_query).query);
    return merge(vars({ fx_session: s.id }), await load(s));
  }
  const s = read(id),
    code = command === "choose-base" ? args[0] || "" : args[0] || s.selected;
  if (command === "back") return finish(backVariables("fx_out", process.env.fx_query));
  if (command === "tick") {
    if (
      !bool("auto_refresh", true) ||
      !s.rates ||
      Date.now() - Math.max(s.rates.fetched, s.lastAttempt || 0) < cacheMinutes("cache_minutes", 60) * 60000
    )
      return {};
    return load(s, false, false);
  }
  if (command === "populate") return populate(s);
  if (command === "select") {
    s.selected = code || "";
    save(s);
    return {};
  }
  if (command === "query") {
    s.query = args[0] || "";
    s.date = "";
    save(s);
    const result = await load(s, false, false);
    return result;
  }
  if (command === "base-picker") return chooseBaseSheet(s);
  if (command === "base-favorite") {
    const favorites = quickBases(s);
    if (!favorites.includes(code) && favorites.length >= 3)
      return update(
        {
          baseNotice: {
            text: "Three favorites already pinned. Remove one ★ before adding another.",
            colour: "systemOrangeColor",
          },
        },
        true,
      );
    toggleQuickFavorite(s, code);
    return update(
      {
        baseItems: { data: { src: baseRows(s, args[1] || "") }, select: code },
        quickBaseButtons: { components: quickBaseButtons(s) },
        baseNotice: {
          text: "Click ☆ to add a quick favorite; click ★ to remove. Limit: 3.",
          colour: "secondaryLabelColor",
        },
      },
      true,
    );
  }
  if (command === "base-search") {
    const data = baseRows(s, args[0] || "");
    return update({
      baseItems: { data: { src: data }, select: data[0]?.uid || "" },
      applyBase: { enabled: data.length > 0 },
    });
  }
  if (command === "base" || command === "choose-base") {
    if (!s.rates?.rates[code]) throw new Error("Choose a supported currency.");
    s.base = code;
    save(s);
    return merge(
      command === "choose-base" ? { sheet: { close: "baseSheet" } } : {},
      update(
        {
          basePicker: { text: `${flag(s.base)} ${s.base} ▾` },
          ...Object.fromEntries(
            quickBases(s).map((value, i) => [
              `quickBase${i}`,
              { contenttintcolour: value === s.base ? "systemBlueColor" : "secondaryLabelColor" },
            ]),
          ),
          sectionTitle: {
            text: `${s.amount} ${s.base} · ${s.rates.date || "Rate date unavailable"} · ${Object.keys(s.rates.rates).length} currencies · Pinned first`,
          },
        },
        true,
      ),
      populate(s),
    );
  }
  if (command === "refresh") return load(s, true);
  if (command === "favorite") {
    const favorites = quickBases(s);
    if (!favorites.includes(code) && favorites.length >= 3)
      return sheet("favoriteLimit", {
        type: "view",
        layout: "border",
        padding: 18,
        spacing: 12,
        components: [
          label("favoriteLimitTitle", "Three quick favorites are already pinned", {
            font: { size: 17, weight: "semibold" },
            constraints: { region: "top" },
          }),
          label(
            "favoriteLimitMessage",
            "Remove one quick favorite from its Actions menu, then select another currency.",
            { linebreak: "wordwrap", constraints: { region: "centre", size: { width: 430, height: 60 } } },
          ),
        ],
      });
    toggleQuickFavorite(s, code);
    return render(s);
  }
  if (command === "pin") {
    pin(code);
    return populate(s);
  }
  if (command === "copy" || command === "copy-full") {
    if (!code) throw new Error("Select a currency first.");
    const n = converted(s, code);
    return copy(
      command === "copy"
        ? n.toFixed(4)
        : `${amountText(s.amount)} ${s.base} = ${amountText(n)} ${code}\nRate date: ${s.rates?.asof} · ${s.rates?.provider}${s.rates?.stale ? " · cached/stale" : ""}`,
    );
  }
  if (command === "date")
    return sheet("dateSheet", {
      type: "view",
      layout: "border",
      padding: 20,
      spacing: 14,
      components: [
        label("dateHeading", "Historical rate date", {
          font: { size: 21, weight: "semibold" },
          constraints: { region: "top" },
        }),
        {
          type: "view",
          layout: "inline",
          direction: "vertical",
          spacing: 10,
          constraints: { region: "centre", size: { width: 560 } },
          components: [
            { id: "dateField", type: "textfield", text: s.date, placeholder: "YYYY-MM-DD", focus: true },
            label("dateError", "Requires a provider and plan with historical access.", {
              font: { size: 12 },
              colour: "secondaryLabelColor",
            }),
          ],
        },
        button("applyDate", "Use Date", run("set-date", ["{value:dateField.text}"]), {
          bordered: true,
          shortcut: "↩",
          constraints: { region: "bottom", position: "right" },
        }),
      ],
    });
  if (command === "set-date") {
    try {
      s.date = validDate(args[0] || "");
      s.query = s.query.replace(/\s+at\s+\S+\s*$/i, "");
      save(s);
      const result = await load(s);
      return merge({ sheet: { close: "dateSheet" } }, result);
    } catch (error) {
      return update(
        {
          dateError: {
            text: error instanceof Error ? error.message : "Could not load this date.",
            colour: "systemRedColor",
          },
        },
        true,
      );
    }
  }
  if (command === "latest") {
    s.query = s.query.replace(/\s+at\s+\S+\s*$/i, "");
    s.date = "";
    save(s);
    return load(s);
  }
  if (command === "provider")
    return open(
      s.rates?.provider === "open-er"
        ? "https://www.exchangerate-api.com"
        : s.rates?.provider === "allratestoday"
          ? "https://allratestoday.com/central-bank-rates-api/ecb/"
          : s.rates?.provider === "unirate"
            ? "https://unirateapi.com"
            : "https://www.exchangerate-api.com/docs/overview",
    );
  if (command === "key") {
    // The key travels as a script environment variable (fx_key), never in argv.
    const saveKey = { ...run("key-save", [], false), variables: { fx_key: "{value:keyField.text}" } };
    return sheet("keySheet", {
      type: "view",
      layout: "border",
      padding: 20,
      spacing: 14,
      components: [
        label("keyHeading", "Provider API key", {
          font: { size: 21, weight: "semibold" },
          constraints: { region: "top" },
        }),
        {
          type: "view",
          layout: "inline",
          direction: "vertical",
          spacing: 10,
          constraints: { region: "centre", size: { width: 560 } },
          components: [
            {
              id: "keyField",
              type: "passwordfield",
              placeholder: "API key for ExchangeRate-API or UniRateAPI",
              focus: true,
              events: [{ triggers: "actioned", action: saveKey }],
            },
            label("keyNote", "Kept in your macOS Keychain, not in Alfred’s preferences.", {
              font: { size: 12 },
              colour: "secondaryLabelColor",
            }),
          ],
        },
        button("saveKey", "Save Key", saveKey, {
          bordered: true,
          shortcut: "↩",
          constraints: { region: "bottom", position: "right" },
        }),
      ],
    });
  }
  if (command === "key-save") {
    try {
      saveApiKey(process.env.fx_key ?? "");
    } catch (error) {
      return update({
        keyNote: { text: error instanceof Error ? error.message : String(error), colour: "systemRedColor" },
      });
    }
    return merge({ sheet: { close: "keySheet" } }, await load(s));
  }
  if (command === "key-remove") {
    removeApiKey();
    return load(s);
  }
  if (command === "menu")
    return popup("actionsButton", [
      menuItem("Copy to Clipboard", ["copy", id, code], "↩"),
      menuItem("Copy Full Conversion", ["copy-full", id, code]),
      menuItem(quickBases(s).includes(code) ? "Remove Quick Favorite" : "Add Quick Favorite", [
        "favorite",
        id,
        code,
      ]),
      menuItem(pinned().includes(code) ? "Unpin Currency" : "Pin Currency", ["pin", id, code]),
      menuItem("Choose Base Currency…", ["base-picker", id]),
      menuItem("Set Currency Date…", ["date", id]),
      menuItem("Use Latest Rates", ["latest", id]),
      menuItem("Refresh Rates", ["refresh", id], "⌘R"),
      menuItem("Rate Provider / API Documentation", ["provider", id]),
      menuItem("Set API Key…", ["key", id]),
      ...(apiKey() ? [menuItem("Remove API Key", ["key-remove", id])] : []),
    ]);
  throw new Error("Unknown Currency command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(errorStatus(error));
}
