param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

Add-Type -AssemblyName System.Drawing

$renderDir = Join-Path $ProjectRoot "tmp/blender/azimuth-comparison"
$tilePath = Join-Path $ProjectRoot "assets/sprites/terrain/grama.png"
$outputPath = Join-Path $renderDir "reference_house_azimuth_10_20_grid.png"
$variants = @(
  @{ Azimuth = 10; BaseWidth = 191.25 },
  @{ Azimuth = 20; BaseWidth = 189.70 }
)

$panelWidth = 512
$panelHeight = 560
$tileSize = 64
$footprintWidth = 192
$footprintHeight = 128
$footprintLeft = 160
$footprintBottom = 420
$footprintTop = $footprintBottom - $footprintHeight

$canvas = [System.Drawing.Bitmap]::new(
  $panelWidth * 2,
  $panelHeight,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$tile = [System.Drawing.Image]::FromFile($tilePath)
$gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(145, 42, 32, 20), 1)
$footprintPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(230, 244, 204, 76), 3)
$labelFont = [System.Drawing.Font]::new("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$detailFont = [System.Drawing.Font]::new("Segoe UI", 13)
$labelBrush = [System.Drawing.Brushes]::White
$labelBack = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(210, 36, 31, 26))

try {
  for ($index = 0; $index -lt $variants.Count; $index++) {
    $variant = $variants[$index]
    $offsetX = $index * $panelWidth

    for ($y = 0; $y -lt 512; $y += $tileSize) {
      for ($x = 0; $x -lt $panelWidth; $x += $tileSize) {
        $graphics.DrawImage($tile, $offsetX + $x, $y, $tileSize, $tileSize)
      }
    }

    for ($line = 0; $line -le $panelWidth; $line += $tileSize) {
      $graphics.DrawLine($gridPen, $offsetX + $line, 0, $offsetX + $line, 512)
      $graphics.DrawLine($gridPen, $offsetX, $line, $offsetX + $panelWidth, $line)
    }

    $graphics.DrawRectangle(
      $footprintPen,
      $offsetX + $footprintLeft,
      $footprintTop,
      $footprintWidth,
      $footprintHeight
    )

    $renderPath = Join-Path $renderDir ("reference_house_azimuth_{0:D2}.png" -f $variant.Azimuth)
    $render = [System.Drawing.Bitmap]::FromFile($renderPath)
    try {
      $minimumX = $render.Width
      $minimumY = $render.Height
      $maximumX = 0
      $maximumY = 0
      for ($y = 0; $y -lt $render.Height; $y++) {
        for ($x = 0; $x -lt $render.Width; $x++) {
          if ($render.GetPixel($x, $y).A -gt 8) {
            if ($x -lt $minimumX) { $minimumX = $x }
            if ($x -gt $maximumX) { $maximumX = $x }
            if ($y -lt $minimumY) { $minimumY = $y }
            if ($y -gt $maximumY) { $maximumY = $y }
          }
        }
      }

      $scale = $footprintWidth / [double]$variant.BaseWidth
      $sourceWidth = $maximumX - $minimumX + 1
      $sourceHeight = $maximumY - $minimumY + 1
      $destinationWidth = [int][Math]::Round($sourceWidth * $scale)
      $destinationHeight = [int][Math]::Round($sourceHeight * $scale)
      $destinationX = $offsetX + 256 - [int][Math]::Round($destinationWidth / 2)
      $destinationY = $footprintBottom - $destinationHeight

      $graphics.DrawImage(
        $render,
        [System.Drawing.Rectangle]::new($destinationX, $destinationY, $destinationWidth, $destinationHeight),
        [System.Drawing.Rectangle]::new($minimumX, $minimumY, $sourceWidth, $sourceHeight),
        [System.Drawing.GraphicsUnit]::Pixel
      )
    }
    finally {
      $render.Dispose()
    }

    $graphics.FillRectangle($labelBack, $offsetX, 512, $panelWidth, 48)
    $graphics.DrawString(("azimute {0} deg" -f $variant.Azimuth), $labelFont, $labelBrush, $offsetX + 16, 516)
    $graphics.DrawString("footprint 3x2 = 192x128 px", $detailFont, $labelBrush, $offsetX + 258, 525)
  }

  $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $outputPath
}
finally {
  $labelBack.Dispose()
  $detailFont.Dispose()
  $labelFont.Dispose()
  $footprintPen.Dispose()
  $gridPen.Dispose()
  $tile.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}
