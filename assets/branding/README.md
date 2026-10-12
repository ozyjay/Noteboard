# Noteboard app icon

The icon represents one Note branching to two related Notes. It uses the app's yellow, sage and plum palette on a dark green tile. The master PNG was created with the built-in image generation tool; transparency is preserved during size conversion.

- `noteboard-icon-master.png`: original generated artwork.
- `Noteboard.icns`: macOS bundle icon, including standard and Retina sizes.
- `../../public/noteboard-icon.png`: 512-pixel Dock/window icon.
- `../../public/favicon.png`: 32-pixel browser favicon.

Regenerate the derived assets on macOS from the repository root:

```powershell
pwsh -NoProfile -File scripts/build-icons.ps1
```

The packaging script includes the ICNS file and sets `CFBundleIconFile`. Vite copies the public PNGs into the build. Rebuild/reinstall the desktop app to apply the icon to an installed bundle.

## Generation prompt

Use case: logo-brand. Asset type: production macOS app icon for Noteboard, a spatial conversation app built around sticky Notes connected by human-created branches. Create one premium, modern, cool-looking icon, square 1024 x 1024 composition. A dark forest-green rounded-square app tile with generous clear transparent space outside the tile, subtle luminous sage edge, softly bevelled corners, restrained tactile 3D depth. Central bold graphic: three beautifully simplified folded-corner sticky notes, one larger warm butter-yellow note on the left connected by a clean branching sage line to two smaller notes on the right, upper pale mint and lower muted plum. Arrange as a distinctive compact silhouette, plenty of breathing room, crisp strong shapes that read at 32px. Each note is blank, no writing or fake UI. Beautiful soft studio lighting, sophisticated matte paper against satin dark tile, minimal subtle shadows, slight dimensionality but mostly front-on for legibility. Icon artwork only, no mockup, no desk, no surrounding scenery, no text, no letters, no watermark. Transparent pixels outside the rounded tile. Make the tile occupy approximately 86% of the canvas width, perfectly centred.
