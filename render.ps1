# Final renders: every social size, H.264, yuv420p so the files play everywhere.
#
# Usage: .\render.ps1                    renders all four
#        .\render.ps1 -Only l            renders one  (l | v | p | s)
#        .\render.ps1 -Scale 0.5         half-size proof renders, for looking at
#        .\render.ps1 -Concurrency 1     one browser tab; slower, least memory
#
# Masters are NOT committed -- tens of MB each, four of them (the landscape one
# measures 27.1 MB), and git keeps every version forever. They ship as GitHub
# Release assets. See docs/release.md and .gitignore.

param(
  [ValidateSet("all", "l", "v", "p", "s")] [string] $Only = "all",
  [double] $Scale = 1.0,

  # Remotion's default concurrency is roughly half the core count, which on this
  # 16 GB machine is 4+ and gets renders KILLED. Each worker is a headless Chrome
  # holding a world that spans 17,800 x 18,305 units, and the box is shared with
  # the founder's own browser. 2 renders this film reliably; 4 did not. Raise it
  # only on a machine with memory to spare, and watch the first minute.
  [ValidateRange(1, 16)] [int] $Concurrency = 2
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

# --- orphans ---------------------------------------------------------------
#
# A killed Remotion render does not clean up after itself. Each one leaves a
# remotion.exe, a node.exe and a handful of chrome-headless-shell.exe processes
# still holding their memory. Three killed renders had accumulated 5.3 GB across
# 18 orphans on this 16 GB box, which then caused the NEXT render to be killed
# for memory -- a loop that reads as "this film is too heavy to render" and is
# not. So look before rendering, and say what was found.
#
# Two filters, and both are load-bearing. The PATH is the project's own
# node_modules, so the founder's own Chrome can never appear in this list. The
# NAME list keeps out anything that merely mentions that path on its command
# line -- a terminal grepping for it, or the kill command printed below, both of
# which match the path glob and are not renders.
#
# Nothing is killed automatically. A human decides, because one of these could be
# a render someone else started on purpose -- which is also why the wording below
# says "already running" rather than asserting they are orphans.
$projectGlob = "*archcanvas-promo-remotion\node_modules*"
$remotionNames = @("remotion.exe", "chrome-headless-shell.exe", "node.exe", "esbuild.exe")
$orphans = @(
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $remotionNames -contains $_.Name } |
    Where-Object { $_.CommandLine -like $projectGlob -or $_.ExecutablePath -like $projectGlob }
)

if ($orphans.Count -gt 0) {
  $gb = [math]::Round((($orphans | Measure-Object -Property WorkingSetSize -Sum).Sum) / 1GB, 2)
  Write-Host ""
  Write-Host "$($orphans.Count) Remotion process(es) already running from this project, holding $gb GB:" -ForegroundColor Yellow
  $orphans |
    Group-Object Name |
    Sort-Object { ($_.Group | Measure-Object -Property WorkingSetSize -Sum).Sum } -Descending |
    ForEach-Object {
      $sum = [math]::Round((($_.Group | Measure-Object -Property WorkingSetSize -Sum).Sum) / 1MB, 0)
      Write-Host ("  {0,-28} x{1,-3} {2,6} MB   pids: {3}" -f $_.Name, $_.Count, $sum, (($_.Group.ProcessId | Sort-Object) -join ", "))
    }
  Write-Host "  If no render is meant to be running, these are orphans from a killed one." -ForegroundColor Yellow
  Write-Host "  Nothing has been killed. To clear them yourself:" -ForegroundColor Yellow
  Write-Host "    Get-CimInstance Win32_Process | Where-Object { `$_.Name -in @('$($remotionNames -join "','")') -and `$_.CommandLine -like '$projectGlob' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force }"
  Write-Host "  Leaving them in place is how the next render gets killed for memory."
} else {
  Write-Host ""
  Write-Host "no orphaned Remotion processes from this project"
}

foreach ($t in $targets) {
  Write-Host ""
  Write-Host "-> $($t.comp)  --  $($t.note)"

  # A proof render must never be able to land on the master's own filename. It
  # would overwrite an uncommitted 27 MB file with a quarter-size one, silently,
  # and the only way back is a full re-render.
  $file = if ($Scale -ne 1.0) { $t.file -replace '\.mp4$', "_proof$($Scale.ToString().Replace('.', '-')).mp4" } else { $t.file }
  $outPath = Join-Path "out" $file

  # NOT $args. `$args` is an automatic variable, and `@args` in a native-command
  # call splats the AUTOMATIC one -- which, in a script whose arguments all bound
  # to param(), is empty. `& npx @args` therefore ran npx with no command at all,
  # npx answered by opening an interactive shell, that shell exited 0, and the
  # summary below then reported the master left over from a PREVIOUS render as if
  # this one had produced it. A green run that rendered nothing. Any name but
  # $args works; the variable still reads back as assigned, so this is invisible
  # from a `Write-Host $args`.
  $renderArgs = @(
    "remotion", "render", "src/index.ts", $t.comp, $outPath,
    "--codec=h264", "--crf=18", "--pixel-format=yuv420p", "--log=error",
    "--concurrency=$Concurrency"
  )
  if ($Scale -ne 1.0) { $renderArgs += "--scale=$Scale" }

  & npx @renderArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "render failed for $($t.comp) (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
  }
}

# Report what actually came out, rather than trusting that it did. `age` is here
# because a file existing is not evidence this run wrote it -- see the $renderArgs
# note above, where a run that rendered nothing reported a previous master.
Write-Host ""
Write-Host "rendered:"
$reported = @()
foreach ($t in $targets) {
  $file = if ($Scale -ne 1.0) { $t.file -replace '\.mp4$', "_proof$($Scale.ToString().Replace('.', '-')).mp4" } else { $t.file }
  $p = Join-Path "out" $file
  if (-not (Test-Path $p)) { Write-Host "  MISSING  $file" -ForegroundColor Red; continue }
  $item = Get-Item $p
  $mb   = [math]::Round($item.Length / 1MB, 1)
  $age  = [math]::Round(((Get-Date) - $item.LastWriteTime).TotalMinutes, 1)
  $probe = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=p=0 $p
  Write-Host ("  {0,-56} {1,6} MB   {2}   written {3} min ago" -f $file, $mb, $probe, $age)
  $reported += $file
}

if ($reported.Count -gt 0) {
  Write-Host ""
  Write-Host "next: node capture/check-flash.mjs out/$($reported[0])"
}
