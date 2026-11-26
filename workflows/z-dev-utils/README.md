# Dev Utils for Alfred 6

Type `devutils` or choose Dev Utils in `dev`. Local toolbox with a searchable operation list and editable Input / read-only Output editors. Empty invocation reads clipboard text by default; disable that in Workflow Configuration. Input/output stay local and are not written into session cache files. Session files store only tool selection, search and navigation metadata. Editor text goes to scripts through nonpersistent UI variables/environment, not command arguments.

![Native local transformation editors](assets/screenshots/editor.png)

Includes JSON format/minify/key sorting, UTF-8 Base64, URL encode/decode, query-string parsing with duplicate values, JWT decoding, SHA-256/SHA-512/MD5, UUID, Unix/date conversion, case conversion, line cleanup/sorting/deduplication, JSON string escapes, HTML entity encoding/common-entity decoding and text inspection. **JWT decoding does not verify signatures or claims. MD5 is only a legacy fingerprint.** These operations use built-in local libraries; no API, subscription or extra app is required.

Command-K offers Copy Output, Paste Output, Use Output as Input, Read Clipboard, Clear Input, Open Input in DevUtils App, DevUtils Website and Configuration. Copy uses the exact displayed output, including generated UUIDs. Paste requires macOS Automation/Accessibility as applicable. Text areas scroll on overflow. Limits: input 50,000 UTF-16 units / 120 KB, output 120 KB. Invalid input shows an error without changing the source editor.

The pinned Raycast DevUtils extension is a launcher for the separate **DevUtils app**, rather than an implementation of its tools. The optional app action follows its documented `devutils://auto?clipboard` handoff and requires that app to be installed. Native local transformations also take inspiration from the installed Alfred Text Transformer workflow. Advanced features such as full language formatters, YAML conversion, QR generation and regex testing remain in the optional external app; they are not presented as local implementations here.

Hyper+B restores the previous Dev launcher session; standard screen-aware width 780 and compact footer labels follow UI_CONVENTIONS.md. Node.js or Bun required. Build/test/package with `bun run check` and `bun run package`; install locally with `bun run link`.

Built with help from AI tools. References: [Raycast DevUtils](https://github.com/raycast/extensions/tree/18750b5bc7fe87eb76991e86f0cda47200daa48f/extensions/devutils/), installed Text Transformer (`com.alfredapp.vitor.texttransformer`) and [DevUtils](https://devutils.com). Independent implementation; no third-party code or binaries bundled.
