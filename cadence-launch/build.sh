#!/bin/sh
# Rebuild "Where did the day go?" (Cadence launch film) from scratch: sh build.sh
set -e
LIB=${LIB:-/Users/sujal/lemo-opuscar}
export LIB
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
cd "$LIB"
mkdir -p "$HERE/out"
[ -f "$HERE/voices/dur.json" ] || "$PY" core/tts/tts.py "$HERE/lines.json" "$HERE/voices"   # 1. Kokoro voice-over (af_heart)
"$PY" core/tts/asr_check.py "$HERE/lines.json" "$HERE/voices"                               # 2. speech-to-text check of every line
node core/render/events.mjs "$HERE"                                                         # 3. timeline + sound events → events.json
"$PY" "$HERE/score.py"                                                                      # 4. original score → out/music.wav
"$PY" "$HERE/mix.py"                                                                        # 5. foley + ambience + voice + ducking → out/mix.wav, out/srt.json
"$PY" core/render/srt.py "$HERE/out/srt.json" "$HERE/cadence-launch.srt"                    # 6. subtitles
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --out "$HERE/out/video.mp4"         # 7. every frame
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/cadence-launch.mp4" 24 0   # 8. −14 LUFS, no grain
node core/render/still.mjs "$HERE" 0 --q scene=poster --out "$HERE/out/still" --prefix po_ && cp "$HERE/out/still/po_0.jpg" "$HERE/poster.jpg"
