# Final renders: every social size, H.264, yuv420p so the files play everywhere.
#
# Usage: .\render.ps1              renders all four
#        .\render.ps1 -Only l      renders one  (l | v | p | s)
#        .\render.ps1 -Scale 0.5   half-size proof renders, for looking at
#
# Masters are NOT committed -- ~90MB each, four of them, and git keeps every
# version forever. They ship as GitHub Release assets. See .gitignore.

param(
  [ValidateSet("all", "l", "v", "p", "s")] [string] $Only = "all",
  [double] $Scale = 1.0
)

# ffmpeg and the Remotion CLI write progress to stderr, which PowerShell turns
# into terminating error records under the default "Stop". Exit codes are
# checked by hand below instead.
$ErrorActionPreference = "Continue"

$stamp = "2026-09"
$base  = "archcanvas-zoom-out-$stamp"

$targets = @(
  @{ tag = "l"; comp = "Zoom-Landscape-16x9"; file = "${base}_landscape_1920x1080.mp4"; note = "YouTube / LinkedIn / the website / playing in the room" },
  @{ tag = "v"; comp = "Zoom-Vertical-9x16";  file = "${base}_vertical_1080x1920.mp4";  note = "Reels / Stories / TikTok / Shorts / LinkedIn vertical" },
  @{ tag = "p"; comp = "Zoom-Portrait-4x5";   file = "${base}_portrait_1080x1350.mp4";  note = "Instagram + Facebook feed (tallest the feed allows)" },
  @{ tag = "s"; comp = "Zoom-Square-1x1";     file = "${base}_square_1080x1080.mp4";    note = "LinkedIn + Instagram feed, and anywhere a square is safest" }
)

if ($Only -ne "all") { $targets = $targets | Where-Object { $_.tag -eq $Only } }

if (-not (Test-Path "out")) { New-Item -ItemType Directory "out" | Out-Null }

foreach ($t in $targets) {
  Write-Host ""
  Write-Host "-> $($t.comp)  --  $($t.note)"

  $outPath = Join-Path "out" $t.file

  $args = @(
    "remotion", "render", "src/index.ts", $t.comp, $outPath,
    "--codec=h264", "--crf=18", "--pixel-format=yuv420p", "--log=error"
  )
  if ($Scale -ne 1.0) { $args += "--scale=$Scale" }

  & npx @args
  if ($LASTEXITCODE -ne 0) {
    Write-Host "render failed for $($t.comp) (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
  }
}

# Report what actually came out, rather than trusting that it did.
Write-Host ""
Write-Host "rendered:"
foreach ($t in $targets) {
  $p = Join-Path "out" $t.file
  if (-not (Test-Path $p)) { Write-Host "  MISSING  $($t.file)" -ForegroundColor Red; continue }
  $mb  = [math]::Round((Get-Item $p).Length / 1MB, 1)
  $probe = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=p=0 $p
  Write-Host ("  {0,-52} {1,6} MB   {2}" -f $t.file, $mb, $probe)
}

Write-Host ""
Write-Host "next: node capture/check-flash.mjs out/$($targets[0].file)"
