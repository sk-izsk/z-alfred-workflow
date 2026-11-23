// Renders the workflow's icons from SF Symbols: `swift scripts/icons.swift` → assets/icons/*.png.
// Original artwork (no editor logos), so the repo can ship them under MIT.
import AppKit

let icons: [(name: String, symbol: String, top: NSColor, bottom: NSColor)] = [
  ("icon", "chevron.left.forwardslash.chevron.right", .systemTeal, .systemBlue),
  ("projects", "clock.arrow.circlepath", .systemTeal, .systemBlue),
  ("find", "magnifyingglass", .systemIndigo, .systemPurple),
  ("finder", "folder", .systemCyan, .systemBlue),
  ("clone", "arrow.down.circle", .systemGreen, .systemTeal),
  ("extensions", "puzzlepiece.extension", .systemOrange, .systemRed),
  ("install", "square.and.arrow.down", .systemYellow, .systemOrange),
  ("window", "macwindow.badge.plus", .systemGray, .darkGray),
  ("agents", "sparkles", .systemPink, .systemPurple),
]

let size: CGFloat = 256
let out = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "assets/icons")

for icon in icons {
  let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
    let inset = rect.insetBy(dx: 12, dy: 12)
    let shape = NSBezierPath(roundedRect: inset, xRadius: 52, yRadius: 52)
    NSGradient(starting: icon.top, ending: icon.bottom)!.draw(in: shape, angle: -90)
    let config = NSImage.SymbolConfiguration(pointSize: 120, weight: .semibold)
      .applying(.init(paletteColors: [.white]))
    let glyph = NSImage(systemSymbolName: icon.symbol, accessibilityDescription: nil)!
      .withSymbolConfiguration(config)!
    let g = glyph.size
    glyph.draw(in: NSRect(x: (size - g.width) / 2, y: (size - g.height) / 2, width: g.width, height: g.height))
    return true
  }
  let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
  try! rep.representation(using: .png, properties: [:])!.write(to: out.appendingPathComponent("\(icon.name).png"))
}
print("Rendered \(icons.count) icons into \(out.path)")
