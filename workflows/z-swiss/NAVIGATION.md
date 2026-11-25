# Swiss navigation protocol v1

Swiss launches only a fixed registry bundle/trigger. Its argument is `swiss:v1:` followed by base64url
JSON `{ "returnTo": "<Swiss session UUID>", "query": "<tool launch query>" }`.

A tool's `launchInput` validates the UUID, envelope size and query type/length, then passes only query
to its normal launch route. Direct arguments are unchanged. Do not treat the envelope as user text,
a city name, a process filter or a speed-test mode.

Only the tool's root Back includes `swiss_return` in its finish variables. Its existing internal
history runs first. The post script validates the token and calls the fixed `open` trigger in
`com.izsk.swiss` with `resume:<UUID>`. It never uses a bundle/URL supplied by the envelope. A missing
token returns to Alfred main search. Sheets retain their existing close-to-parent actions.

Initial/loading Back prepares the token before a JSON finish action, so network errors or incomplete
first loads do not lose the parent. The return token must be forwarded through finish variables;
Alfred UI variables are not automatically inherited by the downstream workflow script.

Swiss reads its own cache session, restoring query and selected row. No token carries API keys,
process IDs, arbitrary filesystem paths or executable commands. Sessions expire after 24 hours.
Keep the parser tests aligned across independent workflows when changing the protocol version.
