param([string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path)

Add-Type -AssemblyName System.Drawing
$input = Join-Path $ProjectRoot "assets/base/storehouse/storehouse_blender_premium_v2.png"
$output = Join-Path $ProjectRoot "tmp/blender/storehouse/storehouse_candidate_214.png"
$source = [System.Drawing.Bitmap]::FromFile($input)
try {
  $x0=$source.Width; $y0=$source.Height; $x1=-1; $y1=-1
  for($y=0;$y -lt $source.Height;$y++) { for($x=0;$x -lt $source.Width;$x++) {
    if($source.GetPixel($x,$y).A -gt 16) { if($x -lt $x0){$x0=$x}; if($y -lt $y0){$y0=$y}; if($x -gt $x1){$x1=$x}; if($y -gt $y1){$y1=$y} }
  }}
  $bounds=[System.Drawing.Rectangle]::FromLTRB($x0,$y0,$x1+1,$y1+1)
  $width=214; $height=[Math]::Round($bounds.Height*$width/$bounds.Width)
  $sprite=[System.Drawing.Bitmap]::new($width,$height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics=[System.Drawing.Graphics]::FromImage($sprite)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($source,[System.Drawing.Rectangle]::new(0,0,$width,$height),$bounds,[System.Drawing.GraphicsUnit]::Pixel)
    $sprite.Save($output,[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $sprite.Dispose() }
  @{path=$output;tamanho=@($width,$height);bounds=@($bounds.X,$bounds.Y,$bounds.Width,$bounds.Height)}|ConvertTo-Json
} finally { $source.Dispose() }
