#!/system/bin/sh
# One caller-owned HDC shell, at most three native screenshot processes.
# Request staggering is relative to UITest command admission, NOT touch delivery.
# The output JPEGs are native original samples, never synthesized/interpolated.
# Fixed plan: baseline + 2/3 staggered + post-command + 3 sequential + late final.
# At parallel=3 this is exactly 9 captures; never repeat for desired pixels.
sheet_sample_scene="$1"
sheet_sample_x="$2"
sheet_sample_y="$3"
sheet_sample_run="$4"
sheet_sample_size="${5:-640}"
sheet_sample_parallel="${6:-3}"
case "$sheet_sample_scene" in dir-open|dir-close|mode-open|mode-close|settings-open|settings-close) ;; *) exit 2 ;; esac
for sheet_sample_integer in "$sheet_sample_x" "$sheet_sample_y" "$sheet_sample_run"
do
  case "$sheet_sample_integer" in ''|*[!0-9]*) exit 2 ;; esac
done
case "$sheet_sample_parallel" in 2|3) ;; *) exit 2 ;; esac
case "$sheet_sample_size" in full|640|320) ;; *) exit 2 ;; esac
sheet_sample_dir="/data/local/tmp/manga-windowed-progressive-$sheet_sample_run-$sheet_sample_scene"
if [ -e "$sheet_sample_dir" ]; then exit 3; fi
mkdir -p "$sheet_sample_dir" || exit 4
sheet_sample_failed=0
sheet_sample_planned_frames=$((sheet_sample_parallel + 6))
printf 'scene=%s size=%s parallel=%s stagger_ms=30,80,150 postcommand_sequential=3 late_gap_ms=800 planned_frames=%s max_native_snapshots=3 coordinate_space=original_display\n' \
  "$sheet_sample_scene" "$sheet_sample_size" "$sheet_sample_parallel" "$sheet_sample_planned_frames" > "$sheet_sample_dir/collector.txt"

sheet_sample_valid_time() {
  case "$1" in ''|*[!0-9.]*|.*|*.|*.*.*) return 1 ;; esac
  case "$1" in *.*) ;; *) return 1 ;; esac
  sheet_sample_fraction="${1#*.}"
  # Native %N must be nine decimal digits; a literal/empty format is rejected.
  [ "${#sheet_sample_fraction}" -eq 9 ]
}
sheet_sample_ordered() {
  sheet_sample_left_seconds="${1%%.*}"
  sheet_sample_right_seconds="${2%%.*}"
  if [ "$sheet_sample_right_seconds" -gt "$sheet_sample_left_seconds" ]; then return 0; fi
  [ "$sheet_sample_right_seconds" -eq "$sheet_sample_left_seconds" ] && \
    [ "${2#*.}" -ge "${1#*.}" ]
}
sheet_sample_capture() {
  sheet_sample_index="$1"
  sheet_sample_start=$(date +%s.%N) || return 1
  sheet_sample_valid_time "$sheet_sample_start" || return 1
  case "$sheet_sample_size" in
    full) snapshot_display -i 0 -f "$sheet_sample_dir/frame-$sheet_sample_index.jpeg" -t jpeg \
      > "$sheet_sample_dir/snapshot-$sheet_sample_index.log" 2>&1 ;;
    640) snapshot_display -i 0 -f "$sheet_sample_dir/frame-$sheet_sample_index.jpeg" -t jpeg -w 640 -h 1416 \
      > "$sheet_sample_dir/snapshot-$sheet_sample_index.log" 2>&1 ;;
    320) snapshot_display -i 0 -f "$sheet_sample_dir/frame-$sheet_sample_index.jpeg" -t jpeg -w 320 -h 708 \
      > "$sheet_sample_dir/snapshot-$sheet_sample_index.log" 2>&1 ;;
  esac
  sheet_sample_code=$?
  sheet_sample_end=$(date +%s.%N) || return 1
  sheet_sample_valid_time "$sheet_sample_end" || return 1
  printf 'frame-%s start=[%s] end=[%s] exit=%s\n' "$sheet_sample_index" \
    "$sheet_sample_start" "$sheet_sample_end" "$sheet_sample_code" > "$sheet_sample_dir/frame-$sheet_sample_index-time.txt"
  [ "$sheet_sample_code" -eq 0 ] && [ -s "$sheet_sample_dir/frame-$sheet_sample_index.jpeg" ] && \
    sheet_sample_ordered "$sheet_sample_start" "$sheet_sample_end"
}
sheet_sample_capture 0 || exit 1
(
  sheet_sample_click_start=$(date +%s.%N) || {
    printf 'click command date failed\n' > "$sheet_sample_dir/click-invalid.txt"
    exit 1
  }
  if ! sheet_sample_valid_time "$sheet_sample_click_start"; then
    printf 'invalid click command timestamp\n' > "$sheet_sample_dir/click-invalid.txt"
    exit 1
  fi
  # Admission marker only: UITest initialization/injection happens afterwards.
  printf 'command_start=[%s]\n' "$sheet_sample_click_start" > "$sheet_sample_dir/click-command-ready.txt"
  uitest uiInput click "$sheet_sample_x" "$sheet_sample_y" > "$sheet_sample_dir/click-output.txt" 2>&1
  sheet_sample_click_code=$?
  sheet_sample_click_end=$(date +%s.%N) || {
    printf 'click command end date failed\n' > "$sheet_sample_dir/click-invalid.txt"
    exit 1
  }
  if ! sheet_sample_valid_time "$sheet_sample_click_end"; then
    printf 'invalid click command end timestamp\n' > "$sheet_sample_dir/click-invalid.txt"
    exit 1
  fi
  printf 'click start=[%s] end=[%s] exit=%s\n' "$sheet_sample_click_start" \
    "$sheet_sample_click_end" "$sheet_sample_click_code" > "$sheet_sample_dir/click-time.txt"
  [ "$sheet_sample_click_code" -eq 0 ] && sheet_sample_ordered "$sheet_sample_click_start" "$sheet_sample_click_end"
) &
sheet_sample_click_pid=$!
sheet_sample_polls=0
while [ ! -s "$sheet_sample_dir/click-command-ready.txt" ] && [ ! -e "$sheet_sample_dir/click-invalid.txt" ]
do
  sheet_sample_polls=$((sheet_sample_polls + 1))
  if [ "$sheet_sample_polls" -ge 200 ]; then sheet_sample_failed=1; break; fi
  sleep 0.005
done
if [ -s "$sheet_sample_dir/click-command-ready.txt" ]; then
  (sleep 0.03; sheet_sample_capture 1) &
  sheet_sample_first_pid=$!
  (sleep 0.08; sheet_sample_capture 2) &
  sheet_sample_second_pid=$!
  if [ "$sheet_sample_parallel" -eq 3 ]; then
    (sleep 0.15; sheet_sample_capture 3) &
    sheet_sample_third_pid=$!
  fi
  wait "$sheet_sample_first_pid" || sheet_sample_failed=1
  wait "$sheet_sample_second_pid" || sheet_sample_failed=1
  if [ "$sheet_sample_parallel" -eq 3 ]; then wait "$sheet_sample_third_pid" || sheet_sample_failed=1; fi
else
  sheet_sample_failed=1
fi
wait "$sheet_sample_click_pid" || sheet_sample_failed=1
# This is a post-command sample, not a fabricated assertion that animation ended.
sheet_sample_final_index=$((sheet_sample_parallel + 1))
sheet_sample_capture "$sheet_sample_final_index" || sheet_sample_failed=1
# Exactly three additional original screenshots, one completing before the next.
# No scheduled gap: the capture command itself determines spacing. No retries.
sheet_sample_sequential_remaining=3
while [ "$sheet_sample_sequential_remaining" -gt 0 ]
do
  sheet_sample_final_index=$((sheet_sample_final_index + 1))
  sheet_sample_capture "$sheet_sample_final_index" || sheet_sample_failed=1
  sheet_sample_sequential_remaining=$((sheet_sample_sequential_remaining - 1))
done
# A separate late original sample, not a duration assertion.
sleep 0.8
sheet_sample_final_index=$((sheet_sample_final_index + 1))
sheet_sample_capture "$sheet_sample_final_index" || sheet_sample_failed=1
: > "$sheet_sample_dir/timestamps.txt"
sheet_sample_index=0
while [ "$sheet_sample_index" -le "$sheet_sample_final_index" ]
do
  if [ -s "$sheet_sample_dir/frame-$sheet_sample_index-time.txt" ]; then
    cat "$sheet_sample_dir/frame-$sheet_sample_index-time.txt" >> "$sheet_sample_dir/timestamps.txt"
  else
    printf 'frame-%s missing_time\n' "$sheet_sample_index" >> "$sheet_sample_dir/timestamps.txt"
    sheet_sample_failed=1
  fi
  sheet_sample_index=$((sheet_sample_index + 1))
done
cat "$sheet_sample_dir/click-time.txt" "$sheet_sample_dir/timestamps.txt"
printf 'result directory=%s failed=%s\n' "$sheet_sample_dir" "$sheet_sample_failed"
exit "$sheet_sample_failed"
