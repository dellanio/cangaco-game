param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

Add-Type -AssemblyName System.Drawing

function Get-AlphaBounds([System.Drawing.Bitmap]$Image) {
  $x0 = $Image.Width; $y0 = $Image.Height; $x1 = -1; $y1 = -1
  for ($y = 0; $y -lt $Image.Height; $y++) {
    for ($x = 0; $x -lt $Image.Width; $x++) {
      if ($Image.GetPixel($x, $y).A -gt 16) {
        if ($x -lt $x0) { $x0 = $x }; if ($y -lt $y0) { $y0 = $y }
        if ($x -gt $x1) { $x1 = $x }; if ($y -gt $y1) { $y1 = $y }
      }
    }
  }
  if ($x1 -lt $x0) { throw "Imagem sem alfa visivel" }
  [System.Drawing.Rectangle]::FromLTRB($x0, $y0, $x1 + 1, $y1 + 1)
}

function Convert-Sprite([string]$InputPath, [string]$OutputPath) {
  $source = [System.Drawing.Bitmap]::FromFile($InputPath)
  try {
    $bounds = Get-AlphaBounds $source
    $width = 192
    $height = [Math]::Max(1, [Math]::Round($bounds.Height * $width / $bounds.Width))
    $sprite = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sprite)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $width, $height), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
      $sprite.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose(); $sprite.Dispose()
    }
    [PSCustomObject]@{ path = $OutputPath; width = $width; height = $height; bounds = @($bounds.X, $bounds.Y, $bounds.Width, $bounds.Height) }
  } finally {
    $source.Dispose()
  }
}

$outDir = Join-Path $ProjectRoot "tmp/blender/material-azimuth-test"
$quarry = Convert-Sprite `
  (Join-Path $ProjectRoot "assets/base/quarry/quarry_blender_premium_v2.png") `
  (Join-Path $outDir "quarry_candidate_192.png")
$wood = Convert-Sprite `
  (Join-Path $ProjectRoot "assets/base/woodcutters/woodcutters_blender_premium_v2.png") `
  (Join-Path $outDir "woodcutters_candidate_192.png")

$grass = [System.Drawing.Bitmap]::FromFile((Join-Path $ProjectRoot "assets/sprites/terrain/grama.png"))
$qImage = [System.Drawing.Bitmap]::FromFile($quarry.path)
$wImage = [System.Drawing.Bitmap]::FromFile($wood.path)
$sheet = [System.Drawing.Bitmap]::new(640, 360, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
try {
  for ($y = 0; $y -lt $sheet.Height; $y += $grass.Height) {
    for ($x = 0; $x -lt $sheet.Width; $x += $grass.Width) { $graphics.DrawImage($grass, $x, $y) }
  }
  $ground = 326
  $graphics.DrawImage($qImage, 70, $ground - $qImage.Height, $qImage.Width, $qImage.Height)
  $graphics.DrawImage($wImage, 370, $ground - $wImage.Height, $wImage.Width, $wImage.Height)
  $comparison = Join-Path $ProjectRoot "screenshots/MATERIAIS-AZIMUTES-pedreira-lenhador.png"
  $sheet.Save($comparison, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $sheet.Dispose(); $wImage.Dispose(); $qImage.Dispose(); $grass.Dispose()
}

@{ quarry = $quarry; woodcutters = $wood; comparison = $comparison } | ConvertTo-Json -Depth 5
