import {
  accessButton,
  button,
  footer,
  header,
  hiddenKey,
  json,
  key,
  label,
  on,
  privacyKey,
  run,
  window,
  type Json,
} from "./shared.ts";

const field = (id: string, placeholder = "", extra: Json = {}): Json => ({
  id,
  type: "textfield",
  placeholder,
  ...extra,
});
const line = (caption: string, component: Json): Json => ({
  type: "view",
  layout: "border",
  spacing: 12,
  components: [
    label(`${component.id}Caption`, {
      text: caption,
      colour: "secondaryLabelColor",
      textalign: "right",
      constraints: { region: "left", position: "centre", size: { width: 85 } },
    }),
    { ...component, constraints: { region: "centre", stretch: "horizontal", position: "centre" } },
  ],
});
const refresh = [run(["create-refresh"]), run(["create-pickers", "{value:calendarPicker.selected.value}"])];
const reload = [run(["create-init", "{var:cal_query}"]), ...refresh];
const fields: Record<string, string> = {
  cal_title: "{value:titleField.text}",
  cal_calendar: "{value:calendarPicker.selected.value}",
  cal_start_date: "{value:startDate.text}",
  cal_start_time: "{value:startTime.text}",
  cal_end_date: "{value:endDate.text}",
  cal_end_time: "{value:endTime.text}",
  cal_all_day: "{value:allDay.checked}",
  cal_location: "{value:locationField.text}",
  cal_notes: "{value:notesField.text}",
  cal_meeting_url: "{value:meetingField.text}",
};
const save = [
  json(
    { update: { ids: { createButton: { enabled: false }, statusLabel: { text: "Saving event…" } } } },
    fields,
  ),
  run(["create-save"], { async: true }),
];

export const create = window(
  "Create Event",
  {
    events: [on("launched", reload)],
    shortcuts: [key("⌘R", refresh)],
    components: [
      header(label("createTitle", { text: "Create Event", font: { size: 25, weight: "light" } })),
      {
        type: "view",
        layout: "inline",
        direction: "vertical",
        spacing: 10,
        constraints: {
          region: "centre",
          position: "top",
          stretch: "horizontal",
          insets: { left: 20, right: 20 },
        },
        components: [
          line("Title", field("titleField", "Team sync", { focus: true })),
          line("Calendar", {
            id: "calendarPicker",
            type: "picker",
            items: [{ text: "Loading calendars…", value: "" }],
          }),
          line("Starts", {
            id: "startLine",
            type: "view",
            layout: "border",
            spacing: 10,
            components: [
              { ...field("startDate", "YYYY-MM-DD"), constraints: { region: "centre" } },
              { ...field("startTime", "HH:MM"), constraints: { region: "right", size: { width: 100 } } },
            ],
          }),
          line("Ends", {
            id: "endLine",
            type: "view",
            layout: "border",
            spacing: 10,
            components: [
              { ...field("endDate", "YYYY-MM-DD"), constraints: { region: "centre" } },
              { ...field("endTime", "HH:MM"), constraints: { region: "right", size: { width: 100 } } },
            ],
          }),
          line("", {
            id: "allDay",
            type: "checkbox",
            text: "All day (end date is the last day included)",
            checked: false,
            events: [on("changed", run(["create-all-day", "{value:self.checked}"]))],
          }),
          line("Location", field("locationField", "Optional location")),
          line("Meeting", field("meetingField", "Paste a Google Meet, Zoom, Teams or Webex link")),
          line("Notes", field("notesField", "Optional notes", { multiline: true })),
          label("timezoneLabel", { colour: "secondaryLabelColor", font: { size: 11 } }),
        ],
      },
      footer([
        accessButton,
        button("createButton", "Create Event  ⌘↩", save, { enabled: false, shortcut: "⌘↩" }),
        privacyKey,
        hiddenKey("refreshCalendarsKey", "⇧⌘R", refresh),
      ]),
    ],
  },
  Object.fromEntries(Object.keys(fields).map((name) => [name, { default: "", scriptenv: true }])),
);
