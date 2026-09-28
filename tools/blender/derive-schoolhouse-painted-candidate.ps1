param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

Add-Type -AssemblyName System.Drawing

$input = Join-Path $ProjectRoot "assets/base/schoolhouse/schoolhouse_painted_premium_v2.png"
$output = Join-Path $ProjectRoot "tmp/blender/schoolhouse/schoolhouse_painted_premium_v2_214x291.png"
$comparison = Join-Path $ProjectRoot "screenshots/CORONEL-paint-test-side-by-side.png"
$woodcutterPath = Join-Path $ProjectRoot "assets/sprites/woodcutters/woodcutters_completo.png"
$grassPath = Join-Path $ProjectRoot "assets/sprites/terrain/grama.png"
$targetWidth = 214
$targetHeight = 291

function Get-AlphaBounds([System.Drawing.Bitmap]$image) {
  $x0 = $image.Width; $y0 = $image.Height; $x1 = -1; $y1 = -1
  for ($y = 0; $y -lt $image.Height; $y++) {
    for ($x = 0; $x -lt $image.Width; $x++) {
      if ($image.GetPixel($x, $y).A -gt 16) {
        if ($x -lt $x0) { $x0 = $x }; if ($y -lt $y0) { $y0 = $y }
        if ($x -gt $x1) { $x1 = $x }; if ($y -gt $y1) { $y1 = $y }
      }
    }
  }
  if ($x1 -lt $x0) { throw "Candidata sem alpha visivel" }
  [System.Drawing.Rectangle]::FromLTRB($x0, $y0, $x1 + 1, $y1 + 1)
}

$source = [System.Drawing.Bitmap]::FromFile($input)
$sprite = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sprite)
try {
  $bounds = Get-AlphaBounds $source
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $targetWidth, $targetHeight), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
  $sprite.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $source.Dispose()
}

$sheet = [System.Drawing.Bitmap]::new(560, 380, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sheetGraphics = [System.Drawing.Graphics]::FromImage($sheet)
$grass = [System.Drawing.Bitmap]::FromFile($grassPath)
$woodcutter = [System.Drawing.Bitmap]::FromFile($woodcutterPath)
try {
  for ($y = 0; $y -lt $sheet.Height; $y += $grass.Height) {
    for ($x = 0; $x -lt $sheet.Width; $x += $grass.Width) { $sheetGraphics.DrawImage($grass, $x, $y) }
  }
  $ground = 350
  $sheetGraphics.DrawImage($sprite, 70, $ground - $sprite.Height, $sprite.Width, $sprite.Height)
  $sheetGraphics.DrawImage($woodcutter, 340, $ground - $woodcutter.Height, $woodcutter.Width, $woodcutter.Height)
  $sheet.Save($comparison, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $woodcutter.Dispose(); $grass.Dispose(); $sheetGraphics.Dispose(); $sheet.Dispose(); $sprite.Dispose()
}

@{ sprite = $output; comparison = $comparison; tamanho = @($targetWidth, $targetHeight) } | ConvertTo-Json
