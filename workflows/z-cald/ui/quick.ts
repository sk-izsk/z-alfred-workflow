import { emptyPreview } from "./quick-preview.ts";
import { back, button, footer, hiddenKey, key, label, on, run, window } from "./shared.ts";

const act = (action: string) => run(["quick", action, "{var:cal_selected}"]);
const refreshPreview = run(["quick-preview", "{var:cal_selected}"], { async: true });
const today = [run(["quick", "today"]), refreshPreview];
const shift = (delta: number) => [run(["quick", "shift", String(delta)]), refreshPreview];
const move = (delta: number) => [run(["quick", "move", String(delta)]), refreshPreview];

export const quick = window(
  "Quick Calendar",
  {
    events: [
      on("launched", [run(["quick", "init", "{var:cal_query}"]), refreshPreview]),
      on("quit", run(["quick-preview-cleanup"])),
    ],
    shortcuts: [
      key("←", move(-1)),
      key("→", move(1)),
      key("↑", move(-7)),
      key("↓", move(7)),
      key("c", today),
      key("⌘T", today),
      key("⌘O", act("agenda")),
      key("⌘J", run(["quick-preview-join"])),
      key("⌘N", act("create")),
      key("⌘C", act("copy")),
      key("↩", today),
      key("{var:actions_shortcut}", act("menu")),
    ],
    components: [
      {
        type: "view",
        layout: "border",
        constraints: { region: "top", size: { height: 42 } },
        components: [
          button("backButton", "‹", back, {
            shortcut: "{var:back_shortcut}",
            tooltip: "Back {var:back_shortcut}",
            font: { size: 20 },
            constraints: {
              region: "left",
              position: "centre",
              insets: { left: 12 },
              size: { width: 24, height: 24 },
            },
          }),
          {
            type: "view",
            background: "separatorColor",
            constraints: { region: "bottom", size: { height: 1 } },
          },
        ],
      },
      {
        type: "view",
        layout: "inline",
        direction: "vertical",
        spacing: 10,
        constraints: {
          region: "centre",
          position: "top",
          stretch: "horizontal",
          insets: { left: 14, right: 14, top: 12 },
        },
        components: [
          label("monthTitle", {
            font: { size: 18, weight: "semibold" },
            textalign: "left",
            constraints: { stretch: "horizontal" },
          }),
          {
            id: "calendarTable",
            type: "view",
            constraints: { stretch: "horizontal", size: { height: 224 } },
            components: [],
          },
          emptyPreview(),
        ],
      },
      footer(
        [
          button("primaryButton", "Current Month  ↩", today),
          button("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
          hiddenKey("previousYearKey", "⇧←", shift(-12)),
          hiddenKey("nextYearKey", "⇧→", shift(12)),
          hiddenKey("previousMonthKey", "⌘←", shift(-1)),
          hiddenKey("nextMonthKey", "⌘→", shift(1)),
          hiddenKey("copyCalendarKey", "⌘↩", act("copy-calendar")),
        ],
        true,
      ),
    ],
  },
  {
    cal_month: { default: "", scriptenv: true },
    cal_selected: { default: "", scriptenv: true },
    cal_window: { default: "", scriptenv: true },
    cal_preview: { default: "", scriptenv: true },
    cal_scroll_title: { default: "", scriptenv: true },
    cal_scroll_started: { default: "0", scriptenv: true },
  },
  { width: 700, height: 450, minHeight: 450 },
);
