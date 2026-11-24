import {
  accessButton,
  button,
  call,
  footer,
  header,
  hiddenKey,
  key,
  label,
  on,
  privacyKey,
  run,
  selected,
  selection,
  window,
} from "./shared.ts";

const event = (action: string) => run(["event", action, selected("items")]);
const refresh = [run(["agenda-load"]), run(["agenda-pickers"])];

const cell = {
  type: "view",
  id: "rowCell",
  layout: "border",
  padding: 10,
  spacing: 14,
  cornerradius: 8,
  events: [on("doubleclicked", run(["event", "join", "{data:uid}"]))],
  components: [
    {
      type: "view",
      layout: "border",
      spacing: 10,
      constraints: { region: "left", position: "centre", size: { width: 108, height: 40 } },
      components: [
        {
          id: "rowStripe",
          type: "view",
          cornerradius: 2,
          constraints: { region: "left", position: "centre", size: { width: 3, height: 32 } },
        },
        {
          type: "view",
          layout: "border",
          constraints: { region: "centre" },
          components: [
            label("rowTime", {
              textalign: "left",
              font: { size: 13, weight: "medium" },
              constraints: { region: "top" },
            }),
            label("rowDay", { textalign: "left", font: { size: 10.5 }, constraints: { region: "bottom" } }),
          ],
        },
      ],
    },
    {
      type: "view",
      layout: "border",
      spacing: 4,
      constraints: { region: "centre", position: "centre", stretch: "horizontal", size: { height: 40 } },
      components: [
        label("rowTitle", {
          textalign: "left",
          font: { size: 14, weight: "medium" },
          constraints: { region: "top" },
        }),
        label("rowCalendar", {
          textalign: "left",
          colour: "secondaryLabelColor",
          font: { size: 11.5 },
          constraints: { region: "bottom" },
        }),
      ],
    },
    {
      id: "rowProviderPill",
      type: "view",
      layout: "border",
      padding: 7,
      spacing: 7,
      cornerradius: 6,
      constraints: { region: "right", position: "centre", size: { width: 120, height: 34 } },
      components: [
        {
          id: "rowProviderIcon",
          type: "imageview",
          resize: "fit",
          image: { type: "symbol", src: "calendar", size: { width: 19, height: 19 } },
          constraints: { region: "left", position: "centre", size: { width: 19, height: 19 } },
          contenttintcolour: "secondaryLabelColor",
        },
        label("rowProvider", {
          textalign: "left",
          font: { size: 11.5, weight: "medium" },
          constraints: { region: "centre", position: "centre" },
        }),
      ],
    },
  ],
};

export const agenda = window(
  "Upcoming Events",
  {
    events: [on("launched", refresh)],
    shortcuts: [
      key("↑", call("items", "selectprevious")),
      key("↓", call("items", "selectnext")),
      key("{var:actions_shortcut}", event("menu")),
      key("⌘R", refresh),
      key("⌘O", event("open")),
      key("⌘N", event("create")),
      key("⌘F", { type: "json", src: { update: { ids: { searchField: { focus: true } } } } }),
    ],
    components: [
      header(
        {
          id: "searchField",
          type: "textfield",
          text: "{var:cal_query}",
          placeholder: "Search events…",
          background: null,
          textinsets: { horizontal: 0, vertical: 6 },
          focus: true,
          bordered: false,
          focusring: false,
          font: { size: 24, weight: "light" },
          events: [on("changed", call("items", "filterdata")), on("actioned", event("join"))],
        },
        {
          type: "view",
          layout: "inline",
          spacing: 8,
          components: [
            {
              id: "viewPicker",
              type: "picker",
              bordered: false,
              items: [
                { text: "Meetings only", value: "meetings" },
                { text: "Timed events", value: "timed" },
                { text: "All events", value: "all" },
              ],
              selected: "meetings",
              tooltip: "Meetings only hides holidays and events without a meeting link",
              events: [
                on(
                  "changed",
                  run([
                    "agenda-filter",
                    "{value:calendarPicker.selected.value}",
                    "{value:viewPicker.selected.value}",
                  ]),
                ),
              ],
            },
            {
              id: "calendarPicker",
              type: "picker",
              bordered: false,
              items: [{ text: "All Calendars", value: "" }],
              tooltip: "Filter by calendar and account",
              events: [
                on(
                  "changed",
                  run([
                    "agenda-filter",
                    "{value:calendarPicker.selected.value}",
                    "{value:viewPicker.selected.value}",
                  ]),
                ),
              ],
            },
          ],
        },
      ),
      {
        id: "items",
        type: "dataview",
        padding: 8,
        spacing: 3,
        placeholder: "No events. Allow Calendar access, then refresh with ⌘R.",
        constraints: { region: "centre" },
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
          height: 68,
          root: cell,
          ...selection("rowCell", ["rowTitle", "rowCalendar", "rowTime", "rowDay", "rowProvider"]),
        },
        events: [on("changed", event("selected")), on("actioned", event("join"))],
      },
      footer([
        accessButton,
        button("primaryButton", "Join / Open  ↩", event("join")),
        button("actionsButton", "Actions  {var:actions_shortcut}", event("menu")),
        privacyKey,
        hiddenKey("copyDetailsKey", "⇧⌘C", event("copy")),
      ]),
    ],
  },
  { cal_filter: { default: "", scriptenv: true }, cal_view: { default: "", scriptenv: true } },
);
