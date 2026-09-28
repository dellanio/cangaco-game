param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

Add-Type -AssemblyName System.Drawing

$sourceComplete = Join-Path $ProjectRoot "tmp/blender/schoolhouse/schoolhouse_render_512.png"
$sourceWood = Join-Path $ProjectRoot "tmp/blender/schoolhouse/schoolhouse_madeira_render_512.png"
$baseComplete = Join-Path $ProjectRoot "assets/base/schoolhouse/schoolhouse_blender_completo.png"
$baseWood = Join-Path $ProjectRoot "assets/base/schoolhouse/schoolhouse_blender_madeira.png"
$outputComplete = Join-Path $ProjectRoot "assets/sprites/schoolhouse/schoolhouse_completo.png"
$outputWood = Join-Path $ProjectRoot "assets/sprites/schoolhouse/schoolhouse_madeira.png"
Copy-Item -LiteralPath $sourceComplete -Destination $baseComplete -Force
Copy-Item -LiteralPath $sourceWood -Destination $baseWood -Force

function Get-AlphaBounds([System.Drawing.Bitmap]$Image) {
  $x0 = $Image.Width
  $y0 = $Image.Height
  $x1 = -1
  $y1 = -1
  for ($y = 0; $y -lt $Image.Height; $y++) {
    for ($x = 0; $x -lt $Image.Width; $x++) {
      if ($Image.GetPixel($x, $y).A -gt 16) {
        if ($x -lt $x0) { $x0 = $x }
        if ($y -lt $y0) { $y0 = $y }
        if ($x -gt $x1) { $x1 = $x }
        if ($y -gt $y1) { $y1 = $y }
      }
    }
  }
  if ($x1 -lt $x0 -or $y1 -lt $y0) { throw "Imagem sem alpha visivel" }
  return [System.Drawing.Rectangle]::new($x0, $y0, $x1 - $x0 + 1, $y1 - $y0 + 1)
}

function Write-FittedSprite(
  [string]$InputPath,
  [string]$OutputPath,
  [System.Drawing.Rectangle]$Bounds
) {
  $source = [System.Drawing.Bitmap]::FromFile($InputPath)
  # A camera canonica ja rende 64 px por unidade/tile. Recortar sem redimensionar
  # preserva a regua humana e deixa telhado, beiral e escada transbordarem o lote.
  $canvas = [System.Drawing.Bitmap]::new($Bounds.Width, $Bounds.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  try {
    $graphics.DrawImage(
      $source,
      [System.Drawing.Rectangle]::new(0, 0, $Bounds.Width, $Bounds.Height),
      $Bounds,
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    return @{ output = $OutputPath; tamanho = @($Bounds.Width, $Bounds.Height) }
  } finally {
    $graphics.Dispose()
    $canvas.Dispose()
    $source.Dispose()
  }
}

$completeBitmap = [System.Drawing.Bitmap]::FromFile($sourceComplete)
$woodBitmap = [System.Drawing.Bitmap]::FromFile($sourceWood)
try {
  $completeBounds = Get-AlphaBounds $completeBitmap
  $woodBounds = Get-AlphaBounds $woodBitmap
} finally {
  $completeBitmap.Dispose()
  $woodBitmap.Dispose()
}

$sharedBounds = [System.Drawing.Rectangle]::FromLTRB(
  [Math]::Min($completeBounds.Left, $woodBounds.Left),
  [Math]::Min($completeBounds.Top, $woodBounds.Top),
  [Math]::Max($completeBounds.Right, $woodBounds.Right),
  [Math]::Max($completeBounds.Bottom, $woodBounds.Bottom)
)

$complete = Write-FittedSprite $sourceComplete $outputComplete $sharedBounds
$wood = Write-FittedSprite $sourceWood $outputWood $sharedBounds

@{
  complete = $complete
  wood = $wood
  bases = @($baseComplete, $baseWood)
  sharedBounds = @($sharedBounds.X, $sharedBounds.Y, $sharedBounds.Width, $sharedBounds.Height)
} | ConvertTo-Json -Depth 5
