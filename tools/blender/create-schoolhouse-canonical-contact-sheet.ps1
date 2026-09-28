param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

Add-Type -AssemblyName System.Drawing

$dir = Join-Path $ProjectRoot "tmp/blender/schoolhouse-canonical-azimuths"
$items = @(
  @{ Name = "DIREITA"; Detail = "az 0 deg | el 56,7754 deg"; File = "schoolhouse_direita.png" },
  @{ Name = "FRONTAL"; Detail = "az 10 deg | el 59,5051 deg"; File = "schoolhouse_frontal.png" },
  @{ Name = "ESQUERDA"; Detail = "az 20 deg | el 63,2080 deg"; File = "schoolhouse_esquerda.png" }
)

$sheet = [System.Drawing.Bitmap]::new(1536, 590, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$titleFont = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$detailFont = [System.Drawing.Font]::new("Segoe UI", 12)
$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 235, 229, 214))
$detailBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 188, 180, 162))
try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(255, 34, 31, 27))
  for ($index = 0; $index -lt $items.Count; $index++) {
    $item = $items[$index]
    $image = [System.Drawing.Bitmap]::FromFile((Join-Path $dir $item.File))
    try {
      $x = $index * 512
      $graphics.DrawImage($image, $x, 64, 512, 512)
      $graphics.DrawString($item.Name, $titleFont, $titleBrush, $x + 16, 6)
      $graphics.DrawString($item.Detail, $detailFont, $detailBrush, $x + 16, 36)
    } finally {
      $image.Dispose()
    }
  }
  $output = Join-Path $dir "schoolhouse_canonical_three_up.png"
  $sheet.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
  $output
} finally {
  $detailBrush.Dispose(); $titleBrush.Dispose(); $detailFont.Dispose(); $titleFont.Dispose()
  $graphics.Dispose(); $sheet.Dispose()
}
