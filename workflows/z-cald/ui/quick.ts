import { button, call, footer, header, hiddenKey, key, label, on, run, selected, window } from "./shared.ts";

const act = (action: string) => run(["quick", action, selected("days")]);
const shift = (delta: number) => run(["quick", "shift", String(delta)]);

export const quick = window(
  "Quick Calendar",
  {
    events: [on("launched", run(["quick", "init", "{var:cal_query}"]))],
    shortcuts: [
      key("←", shift(-1)),
      key("→", shift(1)),
      key("↑", call("days", "selectup")),
      key("↓", call("days", "selectdown")),
      key("⌘T", run(["quick", "today"])),
      key("⌘N", act("create")),
      key("⌘C", act("copy")),
      key("↩", act("agenda")),
      key("{var:actions_shortcut}", act("menu")),
    ],
    components: [
      header(label("monthTitle", { font: { size: 25, weight: "light" } }), {
        type: "view",
        layout: "inline",
        spacing: 12,
        components: [
          button("previousButton", "‹", shift(-1)),
          button("todayButton", "Today", run(["quick", "today"])),
          button("nextButton", "›", shift(1)),
        ],
      }),
      {
        type: "view",
        layout: "border",
        padding: 14,
        spacing: 8,
        constraints: { region: "centre" },
        components: [
          {
            type: "view",
            layout: "border",
            constraints: { region: "top" },
            components: [
              label("weekCaption", {
                text: "ISO",
                colour: "tertiaryLabelColor",
                font: { size: 10 },
                constraints: { region: "left", size: { width: 32 } },
              }),
              {
                type: "view",
                layout: "grid",
                rows: 1,
                cols: 7,
                constraints: { region: "centre", size: { height: 26 } },
                components: Array.from({ length: 7 }, (_, i) =>
                  label(`weekday${i}`, {
                    textalign: "centre",
                    colour: "secondaryLabelColor",
                    font: { size: 12, weight: "medium" },
                  }),
                ),
              },
            ],
          },
          {
            type: "view",
            layout: "inline",
            direction: "vertical",
            spacing: 0,
            constraints: { region: "left", size: { width: 32 } },
            components: Array.from({ length: 6 }, (_, i) =>
              label(`week${i}`, {
                textalign: "centre",
                colour: "tertiaryLabelColor",
                font: { size: 11 },
                constraints: { size: { height: 58 } },
              }),
            ),
          },
          {
            id: "days",
            type: "dataview",
            cols: 7,
            padding: 0,
            spacing: 0,
            focus: true,
            constraints: { region: "centre" },
            data: { type: "basic", src: [] },
            cell: {
              height: 58,
              init: { "dayCell.background": null },
              selected: {
                "dayCell.background": "alfredSelectedResultBackgroundColor",
                "dayNumber.colour": "alfredSelectedResultTextColor",
                "todayMarker.colour": "alfredSelectedResultTextColor",
              },
              root: {
                id: "dayCell",
                type: "view",
                layout: "inline",
                direction: "vertical",
                padding: 8,
                spacing: 2,
                cornerradius: 8,
                events: [on("doubleclicked", run(["quick", "agenda", "{data:uid}"]))],
                components: [
                  label("dayNumber", { textalign: "centre", font: { size: 19, weight: "medium" } }),
                  label("todayMarker", { textalign: "centre", colour: "systemRedColor", font: { size: 9 } }),
                ],
              },
            },
            events: [on("changed", act("selected"))],
          },
        ],
      },
      footer([
        button("primaryButton", "View Events  ↩", act("agenda")),
        button("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
        hiddenKey("previousYearKey", "⇧←", shift(-12)),
        hiddenKey("nextYearKey", "⇧→", shift(12)),
        hiddenKey("previousDayKey", "⌥←", call("days", "selectprevious")),
        hiddenKey("nextDayKey", "⌥→", call("days", "selectnext")),
      ]),
    ],
  },
  { cal_month: { default: "", scriptenv: true } },
);
