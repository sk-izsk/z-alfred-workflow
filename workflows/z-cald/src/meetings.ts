export type MeetingLink = { url: string; provider: string };

/** Only actual conferencing hosts qualify; never execute arbitrary schemes from event notes. */
export const meetingLink = (value: string): MeetingLink | undefined => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase();
    let provider = "";
    if (host === "meet.google.com" && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname))
      provider = "Google Meet";
    if (
      (host === "zoom.us" ||
        host.endsWith(".zoom.us") ||
        host === "zoomgov.com" ||
        host.endsWith(".zoomgov.com")) &&
      /^\/(j|my|w)\//.test(url.pathname)
    )
      provider = "Zoom";
    if (
      (host === "teams.microsoft.com" || host === "teams.live.com") &&
      /^\/(l\/meetup-join|meet)\//.test(url.pathname)
    )
      provider = "Microsoft Teams";
    if (
      (host === "webex.com" || host.endsWith(".webex.com")) &&
      /\/(meet|join|j\.php|wbxmjs)/i.test(url.pathname)
    )
      provider = "Webex";
    return provider ? { url: url.href, provider } : undefined;
  } catch {
    return undefined;
  }
};

export const meetingLinks = (...fields: string[]): MeetingLink[] => {
  const found = new Map<string, MeetingLink>();
  for (const field of fields) {
    const text = field.replace(/&amp;/gi, "&");
    for (const match of text.matchAll(/https:\/\/[^\s<>"']+/gi)) {
      const link = meetingLink(match[0].replace(/[),.;\]}]+$/, ""));
      if (link) found.set(link.url, link);
    }
  }
  return [...found.values()];
};

export const validateMeetingURL = (value: string): string => {
  if (!value.trim()) return "";
  const link = meetingLink(value.trim());
  if (!link) throw new Error("Paste a valid HTTPS Google Meet, Zoom, Teams or Webex meeting link.");
  return link.url;
};
