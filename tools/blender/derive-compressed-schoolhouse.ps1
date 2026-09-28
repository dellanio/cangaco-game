param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path,
  [switch]$Promote
)

Add-Type -AssemblyName System.Drawing

$width = 214
$height = 240
$sourceDir = Join-Path $ProjectRoot 'tmp/blender/schoolhouse-compressed'
$derivedDir = Join-Path $ProjectRoot 'tmp/blender/derived/schoolhouse'
New-Item -ItemType Directory -Force -Path $derivedDir | Out-Null

function Get-AlphaBounds([System.Drawing.Bitmap]$Image) {
  $x0 = $Image.Width; $y0 = $Image.Height; $x1 = -1; $y1 = -1
  for ($y = 0; $y -lt $Image.Height; $y++) {
    for ($x = 0; $x -lt $Image.Width; $x++) {
      if ($Image.GetPixel($x, $y).A -gt 16) {
        $x0 = [Math]::Min($x0, $x); $y0 = [Math]::Min($y0, $y)
        $x1 = [Math]::Max($x1, $x); $y1 = [Math]::Max($y1, $y)
      }
    }
  }
  if ($x1 -lt $x0) { throw 'Imagem sem alfa visivel' }
  [System.Drawing.Rectangle]::FromLTRB($x0, $y0, $x1 + 1, $y1 + 1)
}

function Convert-State([string]$InputPath, [string]$OutputPath) {
  $source = [System.Drawing.Bitmap]::FromFile($InputPath)
  try {
    $bounds = Get-AlphaBounds $source
    $result = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($result)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $width, $height), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
      for ($y = 0; $y -lt $height; $y++) {
        for ($x = 0; $x -lt $width; $x++) {
          if ($result.GetPixel($x, $y).A -lt 32) {
            $result.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
          }
        }
      }
      $result.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose(); $result.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function Write-Icon([string]$SourcePath, [string]$OutputPath) {
  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $icon = [System.Drawing.Bitmap]::new(72, 72, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($icon)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 3, 72, 65))
      $icon.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose(); $icon.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

$completeOut = Join-Path $derivedDir 'schoolhouse_completo.png'
$woodOut = Join-Path $derivedDir 'schoolhouse_madeira.png'
Convert-State (Join-Path $sourceDir 'schoolhouse_completo_cut_join_painted.png') $completeOut
Convert-State (Join-Path $sourceDir 'schoolhouse_madeira_cut_join_painted.png') $woodOut

if ($Promote) {
  Copy-Item $completeOut (Join-Path $ProjectRoot 'assets/sprites/schoolhouse/schoolhouse_completo.png') -Force
  Copy-Item $woodOut (Join-Path $ProjectRoot 'assets/sprites/schoolhouse/schoolhouse_madeira.png') -Force
  Copy-Item (Join-Path $sourceDir 'schoolhouse_completo_cut_join_painted.png') (Join-Path $ProjectRoot 'assets/base/schoolhouse/schoolhouse_blender_compressed_premium_v3.png') -Force
  Copy-Item (Join-Path $sourceDir 'schoolhouse_madeira_cut_join_painted.png') (Join-Path $ProjectRoot 'assets/base/schoolhouse/schoolhouse_madeira_compressed_premium_v3.png') -Force
  Write-Icon $completeOut (Join-Path $ProjectRoot 'assets/sprites/schoolhouse/icone.png')
}

[PSCustomObject]@{
  width = $width
  height = $height
  complete = $completeOut
  madeira = $woodOut
  promoted = [bool]$Promote
} | ConvertTo-Json
