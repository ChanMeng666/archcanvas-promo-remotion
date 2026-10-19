# Cut the music bed out of a full-length take and level it.
#
# The window start comes from tools/analyze-music.mjs (shape-led table) and, if
# the lift needs pinning to the frame, tools/locate-drop.mjs. Nothing here ducks
# the bed under the narration: CLAUDE.md's last Don't is "don't hand-place a
# music duck window — derive it from where the voice is", and where the voice is
# lives in src/data/vo.json. The duck belongs in the composition, which reads
# that file. This script's whole job is to hand the composition a clean bed.
#
# Ported from an earlier promo-film repo's tools/
# prepare-bed.ps1, with two things taken from ../archcanvas-promo-video/scripts/
# prepare-bed.mjs because they were better there:
#
#   * it reports the SOURCE's true peak, not just the output's. That take was
#     delivered at +0.2 dBFS — already clipping — and you want to know that
#     before you wonder why the bed distorts under a voice.
#   * fades, with the fade-out start left as a parameter so it can be put on a
#     real onset rather than mid-phrase. Default 0 = no fade-out here; this
#     film's bed ends on a 4-second hold and the composition owns that shape.
#
# The archcanvas .mjs also baked a hard-coded duck into the file. Deliberately
# not carried over — see above.
#
# Usage:
#   pwsh -File tools/prepare-bed.ps1                       # defaults, whole take
#   pwsh -File tools/prepare-bed.ps1 -Start 100.511 -Length 85
#   pwsh -File tools/prepare-bed.ps1 -Source "audio/source/take.mp3" -Start 0.46 -Length 85 -TargetLufs -20
param(
  [string]$Source,
  [double]$Start = 0,
  [double]$Length = 85,
  # -20 LUFS. This is NOT a mistake, and it is not a drift from the old film.
  #
  # ../archcanvas-promo-video shipped its bed at -16.9 LUFS because that film
  # was SILENT: the music was the only thing in the mix, so it was mastered to
  # sit where a listener expects programme material to sit. This film has a
  # narrator. The narration is mastered to -16 (scripts/measure-vo.mjs), and a
  # bed at the same level does not sit under a voice, it sits ON it. -20 puts
  # roughly 4 dB between them before the composition ducks anything -- which
  # also means there is something left TO duck. A bed already at speak-level
  # can only be ducked by an amount you can hear happening, and audible
  # pumping is on the Exclude Styles list in docs/suno-prompt.md for a reason.
  #
  # If you are comparing the two numbers: -16.9 was right for a film with no
  # voice, -20 is right for this one. Change it only if the narration target in
  # measure-vo.mjs changes too; they are one decision, not two.
  [double]$TargetLufs = -20.0,
  [double]$FadeIn = 0.35,
  # 0 = no fade-out. Set it to a measured onset (locate-drop.mjs) if the take
  # needs one; a fade that starts mid-phrase is audible as a mistake.
  [double]$FadeOutAt = 0,
  [string]$Out = "public\audio\bgm.mp3"
)

# ffmpeg writes progress and warnings to stderr, which PowerShell turns into
# error records. Under "Stop" that aborts the script on a harmless
# "Guessed Channel Layout" line, so exit codes are checked by hand instead.
$ErrorActionPreference = "Continue"

$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
  if (-not $Source) {
    # No -Source: use the single take in audio/source/. Resolving it rather than
    # declaring the parameter Mandatory keeps `pwsh -File` non-interactive — a
    # mandatory parameter with no value prompts on a console that has no stdin,
    # and the script hangs instead of failing.
    $takes = @(Get-ChildItem -Path "audio\source" -File -Include *.mp3, *.wav, *.flac -Recurse -ErrorAction SilentlyContinue)
    if ($takes.Count -eq 1) {
      $Source = $takes[0].FullName
    } elseif ($takes.Count -eq 0) {
      throw "no -Source given and audio/source/ is empty. Drop the SUNO take there (see docs/suno-prompt.md)."
    } else {
      throw "no -Source given and audio/source/ holds $($takes.Count) files: $($takes.Name -join ', '). Pass -Source."
    }
  }
  if (-not (Test-Path $Source)) { throw "source not found: $Source" }

  New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
  $tmp = Join-Path $env:TEMP "bed-cut-$PID.wav"

  function Invoke-FFmpeg {
    param([string[]]$FFArgs)
    $out = & ffmpeg -hide_banner -nostdin @FFArgs 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Write-Host $out; throw "ffmpeg failed ($LASTEXITCODE)" }
    return $out
  }
  function Read-Lufs {
    param([string]$Log, [string]$Label = "I")
    $m = [regex]::Matches($Log, "$Label`:\s+(-?\d+\.\d+)")
    if ($m.Count -eq 0) { return $null }
    return [double]$m[$m.Count - 1].Groups[1].Value
  }

  # What did we start with? A take delivered above 0 dBFS true peak is already
  # clipping, and no amount of downward gain un-clips it.
  $srcLog = Invoke-FFmpeg @("-v", "info", "-vn", "-i", $Source, "-af", "ebur128=peak=true", "-f", "null", "NUL")
  $srcLufs = Read-Lufs $srcLog "I"
  $srcPeak = Read-Lufs $srcLog "Peak"
  $srcDur = & ffprobe -v error -show_entries format=duration -of csv=p=0 $Source

  # -ss AFTER -i is output seeking: slower, but sample accurate. Input seeking on
  # an mp3 can land up to a frame (~26ms) out, which is the whole point here.
  # -vn drops the embedded cover art, which would otherwise become a video stream.
  Invoke-FFmpeg @("-y", "-v", "error", "-i", $Source, "-ss", $Start, "-t", $Length, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", $tmp) | Out-Null
  if (-not (Test-Path $tmp)) { throw "cut failed" }

  # Measure the CUT, then apply a single flat gain. A flat gain keeps the track's
  # own dynamics intact, where loudnorm's dynamic mode would squash the build —
  # and in this film the build IS the picture: the ground washes from graphite
  # night to ivory daylight over 85 seconds and the music makes the same journey.
  # Normalise that dynamically and the journey is gone.
  $log = Invoke-FFmpeg @("-v", "info", "-i", $tmp, "-af", "ebur128=peak=true", "-f", "null", "NUL")
  $lufs = Read-Lufs $log "I"
  if ($null -eq $lufs) { throw "could not read loudness" }
  $gain = [math]::Round($TargetLufs - $lufs, 2)
  Write-Host ("segment {0:N1} LUFS  ->  target {1:N1}  ->  gain {2:N2} dB" -f $lufs, $TargetLufs, $gain)

  # alimiter catches any peak the gain pushes over; at a negative gain it is a
  # no-op, but it keeps the command safe if a future take is quieter.
  $chain = @("volume=${gain}dB", "alimiter=limit=0.95")
  if ($FadeIn -gt 0) { $chain += "afade=t=in:st=0:d=$FadeIn" }
  if ($FadeOutAt -gt 0) {
    $fadeStart = [math]::Round($FadeOutAt - $Start, 3)
    $fadeDur = [math]::Round($Length - $fadeStart, 3)
    if ($fadeStart -le 0 -or $fadeDur -le 0) { throw "-FadeOutAt $FadeOutAt is outside the window $Start..$($Start + $Length)" }
    $chain += "afade=t=out:st=${fadeStart}:d=${fadeDur}"
  }
  $af = $chain -join ","

  Invoke-FFmpeg @("-y", "-v", "error", "-i", $tmp, "-af", $af, "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", $Out) | Out-Null
  Remove-Item $tmp -Force

  $dur = & ffprobe -v error -show_entries format=duration -of csv=p=0 $Out
  $check = Invoke-FFmpeg @("-v", "info", "-i", $Out, "-af", "ebur128=peak=true", "-f", "null", "NUL")
  $finalLufs = Read-Lufs $check "I"
  $finalPeak = Read-Lufs $check "Peak"

  Write-Host ""
  Write-Host "  prepare-bed"
  Write-Host ("    source     {0}" -f $Source)
  Write-Host ("               {0:N3}s · {1} LUFS · true peak {2} dBFS{3}" -f [double]$srcDur, $srcLufs, $srcPeak, $(if ($srcPeak -gt 0) { "   <- clipping as delivered" } else { "" }))
  Write-Host ("    window     {0}s -> {1}s   (output seeking, so the cut lands on the sample it names)" -f $Start, ($Start + $Length))
  Write-Host ("    gain       {0}{1:N2} dB flat  -> target {2:N1} LUFS" -f $(if ($gain -ge 0) { "+" } else { "" }), $gain, $TargetLufs)
  Write-Host ("    chain      {0}" -f $af)
  Write-Host ("    written    {0}" -f $Out)
  Write-Host ("               {0:N3}s · {1:N1}KB · {2} LUFS · true peak {3} dBFS" -f [double]$dur, ((Get-Item $Out).Length / 1KB), $finalLufs, $finalPeak)
  Write-Host ""
}
finally {
  Pop-Location
}
