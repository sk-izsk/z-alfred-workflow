/** Native section headings, single-line rows and value badges used by supplied workflow references. */
export type ReferenceRow = {
  id: string;
  name: string;
  description?: string;
  group?: string;
  badge?: string;
  tone?: string;
  icon?: string;
  note?: string;
};
export type Json = Record<string, any>;
export const toneColour = (tone = "neutral"): string =>
  ({
    green: "systemGreenColor",
    yellow: "systemYellowColor",
    orange: "systemOrangeColor",
    red: "systemRedColor",
    blue: "systemBlueColor",
  })[tone] || "secondaryLabelColor";
export const toneBackground = (tone = "neutral"): Json => ({
  light:
    {
      green: "#328B601A",
      yellow: "#AA84251A",
      orange: "#CC88331A",
      red: "#DC4B501A",
      blue: "#3189D71A",
    }[tone] || "#88888822",
  dark:
    {
      green: "#86C88D22",
      yellow: "#D4B26422",
      orange: "#D79A6422",
      red: "#E97C8422",
      blue: "#7CB5ED22",
    }[tone] || "#88888822",
});
const symbol = (name = "doc"): string =>
  ({
    disk: "externaldrive",
    externaldrive: "externaldrive",
    file: "doc",
    memory: "memorychip",
    battery: "battery.100",
    warning: "exclamationmark.triangle",
    check: "checkmark",
    network: "network",
  })[name] || name;
export const referenceCell = (prefix: string, height = 42): Json => ({
  height,
  init: {
    [`${prefix}Body.opacity`]: 1,
    [`${prefix}Header.opacity`]: 0,
    [`${prefix}Body.background`]: null,
    [`${prefix}Title.colour`]: "labelColor",
    [`${prefix}Subtitle.colour`]: "secondaryLabelColor",
    [`${prefix}Note.text`]: "",
    [`${prefix}BadgeLabel.text`]: "",
    [`${prefix}Badge.background`]: null,
  },
  selected: {
    [`${prefix}Body.background`]: "alfredSelectedResultBackgroundColor",
    [`${prefix}Title.colour`]: "alfredSelectedResultTextColor",
    [`${prefix}Subtitle.colour`]: "alfredSelectedResultTextColor",
  },
  root: {
    type: "view",
    layout: "stack",
    padding: 2,
    components: [
      {
        id: `${prefix}Body`,
        type: "view",
        layout: "border",
        padding: 7,
        spacing: 10,
        cornerradius: 8,
        components: [
          {
            id: `${prefix}Icon`,
            type: "imageview",
            image: { type: "symbol", src: "doc" },
            constraints: { region: "left", position: "centre", size: { width: 21, height: 21 } },
          },
          {
            type: "view",
            layout: "inline",
            spacing: 8,
            constraints: { region: "right", position: "centre" },
            components: [
              {
                id: `${prefix}Badge`,
                type: "view",
                layout: "inline",
                padding: 4,
                cornerradius: 4,
                components: [
                  {
                    id: `${prefix}BadgeLabel`,
                    type: "label",
                    text: "",
                    font: { size: 12, weight: "medium" },
                    linebreak: "truncatetail",
                  },
                ],
              },
              {
                id: `${prefix}Note`,
                type: "label",
                text: "",
                font: { size: 11 },
                colour: "secondaryLabelColor",
                linebreak: "truncatetail",
              },
            ],
          },
          {
            type: "view",
            layout: "border",
            spacing: 8,
            constraints: { region: "centre" },
            components: [
              {
                id: `${prefix}Title`,
                type: "label",
                text: "",
                font: { size: 14, weight: "medium" },
                linebreak: "truncatetail",
                constraints: { region: "centre", position: "centre", stretch: "horizontal" },
              },
              {
                id: `${prefix}Subtitle`,
                type: "label",
                text: "",
                font: { size: 11 },
                colour: "secondaryLabelColor",
                linebreak: "truncatetail",
                constraints: { region: "right", position: "centre", size: { width: 90 } },
              },
            ],
          },
        ],
      },
      {
        id: `${prefix}Header`,
        type: "label",
        text: "",
        font: { size: 11, weight: "medium" },
        colour: "secondaryLabelColor",
        constraints: { position: "left", insets: { left: 8 } },
      },
    ],
  },
});
export const referenceData = (rows: ReferenceRow[], prefix: string, headers = true): Json[] => {
  const data: Json[] = [];
  let previous = "";
  for (const row of rows) {
    if (headers && row.group && row.group !== previous) {
      data.push({
        uid: `heading:${row.group}`,
        header: true,
        [`${prefix}Body.opacity`]: 0,
        [`${prefix}Header.opacity`]: 1,
        [`${prefix}Header.text`]: row.group,
      });
      previous = row.group;
    }
    data.push({
      uid: row.id,
      header: false,
      [`${prefix}Title.text`]: row.name,
      [`${prefix}Title.tooltip`]: row.name,
      [`${prefix}Subtitle.text`]: row.description || "",
      [`${prefix}Subtitle.tooltip`]: row.description || "",
      [`${prefix}BadgeLabel.text`]: row.badge || "",
      [`${prefix}BadgeLabel.colour`]: toneColour(row.tone),
      [`${prefix}Badge.background`]: row.badge ? toneBackground(row.tone) : null,
      [`${prefix}Note.text`]: row.note || "",
      [`${prefix}Icon.image.type`]: "symbol",
      [`${prefix}Icon.image.src`]: symbol(row.icon),
      [`${prefix}Icon.contenttintcolour`]: row.tone ? toneColour(row.tone) : "labelColor",
    });
  }
  return data;
};
/** Section headings are display rows, not an extra navigation level. */
export const skipHeading = (
  rows: Json[],
  selected: string,
  previous: string,
  list = "items",
): Json => {
  const next = rows.findIndex((r) => r.uid === selected),
    before = rows.findIndex((r) => r.uid === previous);
  const direction = next >= before ? 1 : -1;
  let index = next;
  while (index >= 0 && index < rows.length && rows[index]?.header) index += direction;
  const uid =
    rows[index]?.uid ||
    (rows.some((r) => r.uid === previous && !r.header)
      ? previous
      : rows.find((r) => !r.header)?.uid || "");
  return { update: { ids: { [list]: { select: uid } } } };
};
