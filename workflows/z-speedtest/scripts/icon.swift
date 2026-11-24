import AppKit
let size = NSSize(width: 512, height: 512)
let image = NSImage(size: size)
image.lockFocus()
let rect = NSRect(origin: .zero, size: size)
NSColor(calibratedRed: 0.06, green: 0.11, blue: 0.22, alpha: 1).setFill()
NSBezierPath(roundedRect: rect.insetBy(dx: 16, dy: 16), xRadius: 104, yRadius: 104).fill()
let center = NSPoint(x: 256, y: 240)
let track = NSBezierPath()
track.appendArc(withCenter: center, radius: 155, startAngle: 215, endAngle: -35, clockwise: true)
track.lineWidth = 29; track.lineCapStyle = .round
NSColor(calibratedWhite: 0.28, alpha: 1).setStroke(); track.stroke()
let arc = NSBezierPath()
arc.appendArc(withCenter: center, radius: 155, startAngle: 215, endAngle: 40, clockwise: true)
arc.lineWidth = 29; arc.lineCapStyle = .round
NSColor(calibratedRed: 0.04, green: 0.58, blue: 1, alpha: 1).setStroke(); arc.stroke()
let needle = NSBezierPath()
needle.move(to: center); needle.line(to: NSPoint(x: 337, y: 326))
needle.lineWidth = 15; needle.lineCapStyle = .round
NSColor.white.setStroke(); needle.stroke()
NSColor.white.setFill(); NSBezierPath(ovalIn: NSRect(x: 238, y: 222, width: 36, height: 36)).fill()
let title = "SPEED"
let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 32, weight: .semibold), .foregroundColor: NSColor.white]
let width = title.size(withAttributes: attrs).width
title.draw(at: NSPoint(x: (512-width)/2, y: 108), withAttributes: attrs)
image.unlockFocus()
let data = NSBitmapImageRep(data: image.tiffRepresentation!)!.representation(using: .png, properties: [:])!
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
