# Third-party notices

## Raycast Notion extension

Source: https://github.com/raycast/extensions/tree/459326f4f557692a79246dba2d013746f56d724b/extensions/notion

Extension by Henri Chabrand and contributors. `assets/icon.png` is copied from that revision's
`assets/notion-logo.png`. The Alfred implementation follows its commands and actions, and adapts
its Notion object mapping, property conversion, add-note logic and option colours. No Raycast
runtime code is bundled.

MIT License

Copyright (c) 2021 Raycast

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Bundled libraries (compiled into `bin/nt.mjs`)

- **@notionhq/client** (Notion SDK for JavaScript), MIT, © Notion Labs, Inc.
- **@tryfabric/martian** (Markdown to Notion blocks), MIT, © Fabric.
- **notion-to-md** (Notion blocks to Markdown), MIT, © Souvik Kar Mahapatra.
- **@mozilla/readability**, Apache License 2.0, © Mozilla.
- **linkedom**, ISC, © Andrea Giammarchi.

Their full license texts ship in each package on npm.

## Notion

Notion is a trademark of Notion Labs, Inc.; this workflow is not affiliated with or endorsed by
Notion. Data comes from the Notion API with your own integration.
