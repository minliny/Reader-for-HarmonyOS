reader_probe_child=''
reader_probe_cleanup() {
 if [ -n "$reader_probe_child" ]; then
  kill -CONT "$reader_probe_child" 2>/dev/null
  wait "$reader_probe_child"
  reader_probe_child=''
 fi
}
trap reader_probe_cleanup EXIT
trap 'reader_probe_cleanup; exit 130' HUP INT TERM
uinput -T -m 1000 1350 540 1350 -k 2200 400 > /data/local/tmp/reader-control-slide-quiet-next-valid-input.log 2>&1 &
reader_probe_child=$!
reader_probe_wait=0
while ! grep -q '^smoothTimeMs:' /data/local/tmp/reader-control-slide-quiet-next-valid-input.log; do
 reader_probe_wait=$((reader_probe_wait + 1))
 if [ "$reader_probe_wait" -gt 100 ]; then exit 7; fi
 sleep 0.02
done
sleep 0.7
kill -STOP "$reader_probe_child" || exit 5
read reader_probe_time reader_probe_idle < /proc/uptime
printf 'QUIET_BEGIN uptime=%s\n' "$reader_probe_time"
sleep 1.2
kill -CONT "$reader_probe_child" || exit 6
read reader_probe_time reader_probe_idle < /proc/uptime
printf 'QUIET_END uptime=%s\n' "$reader_probe_time"
wait "$reader_probe_child"
reader_probe_status=$?
cat /data/local/tmp/reader-control-slide-quiet-next-valid-input.log
reader_probe_child=''
trap - EXIT HUP INT TERM
exit "$reader_probe_status"
