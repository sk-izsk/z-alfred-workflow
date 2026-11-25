import { randomUUID } from "node:crypto";
import { create, read, save, pin, pinned, type State } from "./state.ts";
import { loadRates } from "./api.ts";
import { parseQuery, validDate } from "./expression.ts";
import { components, rows, run, button, label, converted, amountText } from "../ui/window.ts";
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
import { osascript } from "./proc.ts";
const populate = (s: State): Action => {
  const data = rows(s);
  return update({
    items: {
      data: { src: data },
      select: s.selected && data.some((r) => r.uid === s.selected) ? s.selected : data[0]?.uid || "",
    },
  });
};
const render = (s: State): Action =>
  merge(vars({ fx_session: s.id }), update({ root: { components: components(s) } }, true), {
    pulse: { src: "../bin/fx", args: ["populate", s.id], interval: 0, now: true },
  });
const load = async (s: State, fresh = false): Promise<Action> => {
  const parsed = parseQuery(s.query);
  const requested = parsed.date || s.date,
    ticket = randomUUID();
  s.request = ticket;
  save(s);
  const rates = s.rates && !fresh && s.rates.date === requested ? s.rates : await loadRates(requested, fresh);
  const latest = read(s.id);
  if (latest.request !== ticket) return {};
  latest.amount = parsed.amount;
  latest.filter = parsed.filter;
  latest.rates = rates;
  latest.date = requested;
  save(latest);
  return render(latest);
};
const main = async (): Promise<Action | void> => {
  const [command = "", id = "", ...args] = process.argv.slice(2);
  if (command === "post") {
    if (process.env.fx_out === "back")
      await osascript('tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)', "");
    return;
  }
  if (command === "launch") {
    const s = create(process.env.fx_query || "");
    return merge(vars({ fx_session: s.id }), await load(s));
  }
  const s = read(id),
    code = args[0] || s.selected;
  if (command === "back") return finish({ fx_out: "back" });
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
    const result = await load(s);
    return result;
  }
  if (command === "base") {
    if (!s.rates?.rates[code]) throw new Error("Choose a supported currency.");
    s.base = code;
    save(s);
    return merge(
      update({ sectionTitle: { text: `${s.amount} ${s.base} · ${s.rates.asof} · Pinned first` } }, true),
      populate(s),
    );
  }
  if (command === "refresh") return load(s, true);
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
      s.rates?.provider === "allratestoday"
        ? "https://allratestoday.com/central-bank-rates-api/ecb/"
        : s.rates?.provider === "unirate"
          ? "https://unirateapi.com"
          : "https://www.exchangerate-api.com/docs/overview",
    );
  if (command === "menu")
    return popup("actionsButton", [
      menuItem("Copy to Clipboard", ["copy", id, code], "↩"),
      menuItem("Copy Full Conversion", ["copy-full", id, code]),
      menuItem(pinned().includes(code) ? "Unpin Currency" : "Pin Currency", ["pin", id, code]),
      menuItem("Set Currency Date…", ["date", id]),
      menuItem("Use Latest Rates", ["latest", id]),
      menuItem("Refresh Rates", ["refresh", id], "⌘R"),
      menuItem("Rate Provider / API Documentation", ["provider", id]),
    ]);
  throw new Error("Unknown Currency command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(errorStatus(error));
}
