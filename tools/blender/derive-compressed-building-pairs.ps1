param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path,
  [switch]$Promote
)

Add-Type -AssemblyName System.Drawing

$specs = @(
  @{
    Id = 'storehouse'; Width = 214; Height = 254
    Complete = 'tmp/blender/compressed-rebuild/storehouse/storehouse_completo_painted.png'
    Wood = 'tmp/blender/compressed-rebuild/storehouse/storehouse_madeira_painted.png'
    BaseComplete = 'assets/base/storehouse/storehouse_blender_compressed_premium_v3.png'
    BaseWood = 'assets/base/storehouse/storehouse_madeira_compressed_premium_v3.png'
  },
  @{
    Id = 'quarry'; Width = 192; Height = 151
    Complete = 'tmp/blender/compressed-rebuild/quarry/quarry_completo_painted.png'
    Wood = 'tmp/blender/compressed-rebuild/quarry/quarry_madeira_painted.png'
    BaseComplete = 'assets/base/quarry/quarry_blender_compressed_premium_v3.png'
    BaseWood = 'assets/base/quarry/quarry_madeira_compressed_premium_v3.png'
  }
)

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

function Get-Union([System.Drawing.Rectangle]$A, [System.Drawing.Rectangle]$B, [int]$MaxWidth, [int]$MaxHeight) {
  $pad = 4
  $left = [Math]::Max(0, [Math]::Min($A.Left, $B.Left) - $pad)
  $top = [Math]::Max(0, [Math]::Min($A.Top, $B.Top) - $pad)
  $right = [Math]::Min($MaxWidth, [Math]::Max($A.Right, $B.Right) + $pad)
  $bottom = [Math]::Min($MaxHeight, [Math]::Max($A.Bottom, $B.Bottom) + $pad)
  [System.Drawing.Rectangle]::FromLTRB($left, $top, $right, $bottom)
}

function Convert-PairImage(
  [System.Drawing.Bitmap]$Source,
  [System.Drawing.Rectangle]$Crop,
  [int]$Width,
  [int]$Height,
  [string]$Output
) {
  $parent = Split-Path -Parent $Output
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $result = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($result)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($Source, [System.Drawing.Rectangle]::new(0, 0, $Width, $Height), $Crop, [System.Drawing.GraphicsUnit]::Pixel)
    # Imagegen deixa cor de matte em pixels quase transparentes; no jogo isso
    # vira um halo vermelho/verde sobre a grama. Remova apenas a franja subvisual.
    for ($y = 0; $y -lt $Height; $y++) {
      for ($x = 0; $x -lt $Width; $x++) {
        if ($result.GetPixel($x, $y).A -lt 32) {
          $result.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
      }
    }
    $result.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose(); $result.Dispose()
  }
}

function Write-Icon([string]$SourcePath, [string]$OutputPath) {
  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $bounds = Get-AlphaBounds $source
    $scale = [Math]::Min(68.0 / $bounds.Width, 68.0 / $bounds.Height)
    $w = [Math]::Max(1, [Math]::Round($bounds.Width * $scale))
    $h = [Math]::Max(1, [Math]::Round($bounds.Height * $scale))
    $icon = [System.Drawing.Bitmap]::new(72, 72, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($icon)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.DrawImage($source, [System.Drawing.Rectangle]::new([Math]::Floor((72-$w)/2), [Math]::Floor((72-$h)/2), $w, $h), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
      $icon.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $icon.Dispose() }
  } finally { $source.Dispose() }
}

$results = @()
foreach ($spec in $specs) {
  $completePath = Join-Path $ProjectRoot $spec.Complete
  $woodPath = Join-Path $ProjectRoot $spec.Wood
  $complete = [System.Drawing.Bitmap]::FromFile($completePath)
  $wood = [System.Drawing.Bitmap]::FromFile($woodPath)
  try {
    if ($complete.Width -ne $wood.Width -or $complete.Height -ne $wood.Height) {
      throw "$($spec.Id): os estados nao compartilham canvas de pintura"
    }
    $crop = Get-Union (Get-AlphaBounds $complete) (Get-AlphaBounds $wood) $complete.Width $complete.Height
    $root = if ($Promote) { Join-Path $ProjectRoot "assets/sprites/$($spec.Id)" } else { Join-Path $ProjectRoot "tmp/blender/derived/$($spec.Id)" }
    $completeOut = Join-Path $root "$($spec.Id)_completo.png"
    $woodOut = Join-Path $root "$($spec.Id)_madeira.png"
    Convert-PairImage $complete $crop $spec.Width $spec.Height $completeOut
    Convert-PairImage $wood $crop $spec.Width $spec.Height $woodOut
    if ($Promote) {
      Copy-Item -LiteralPath $completePath -Destination (Join-Path $ProjectRoot $spec.BaseComplete) -Force
      Copy-Item -LiteralPath $woodPath -Destination (Join-Path $ProjectRoot $spec.BaseWood) -Force
      Write-Icon $completeOut (Join-Path $root 'icone.png')
    }
    $results += [PSCustomObject]@{ id=$spec.Id; tamanho=@($spec.Width,$spec.Height); crop=@($crop.X,$crop.Y,$crop.Width,$crop.Height); completo=$completeOut; madeira=$woodOut }
  } finally { $complete.Dispose(); $wood.Dispose() }
}

$results | ConvertTo-Json -Depth 5
