# HarmonyOS Cron Loop Setup

**Date**: 2026-05-14
**Status**: DOCUMENTATION_ONLY (cron NOT installed)

## 1. Loop Command

The loop command is defined at:
```
.claude/commands/harmonyos-loop.md
```

It is invoked via:
```
/harmonyos-loop
```

## 2. Cron Configuration (OPTIONAL — NOT INSTALLED)

### Recommended Cron Expression

For automated polling every 10 minutes:

```
*/10 * * * *
```

To avoid the :00/:30 thundering herd, use an off-minute:

```
7,17,27,37,47,57 * * * *
```

### Recommended Command

```bash
cd "/Users/minliny/Documents/Reader for HarmonyOS" && claude --permission-mode bypassPermissions -p "/harmonyos-loop"
```

Or if using the Claude Code CLI with a session file:

```bash
cd "/Users/minliny/Documents/Reader for HarmonyOS" && claude -p "Run /harmonyos-loop. Execute exactly one READY task, update queue, and stop." --permission-mode bypassPermissions
```

### macOS Launchd Alternative (Recommended over cron)

macOS may restrict cron for security. A LaunchAgent is more reliable:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.reader.harmonyos.loop</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd "/Users/minliny/Documents/Reader for HarmonyOS" && claude -p "/harmonyos-loop" --permission-mode bypassPermissions</string>
    </array>
    <key>StartInterval</key>
    <integer>600</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/Users/minliny/Documents/Reader for HarmonyOS/logs/loop-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/minliny/Documents/Reader for HarmonyOS/logs/loop-stderr.log</string>
</dict>
</plist>
```

Install with:
```bash
mkdir -p "/Users/minliny/Documents/Reader for HarmonyOS/logs"
cp com.reader.harmonyos.loop.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.reader.harmonyos.loop.plist
```

Remove with:
```bash
launchctl unload ~/Library/LaunchAgents/com.reader.harmonyos.loop.plist
rm ~/Library/LaunchAgents/com.reader.harmonyos.loop.plist
```

### Claude Code `/loop` Command Alternative

Claude Code has a built-in `/loop` command that can run a prompt on an interval without cron:

```
/loop 10m /harmonyos-loop
```

This starts a Claude Code session-internal loop at 10-minute intervals. The session must remain active. This is the **simplest** approach and does not require system crontab access.

## 3. Environment Requirements

| Requirement | Current Status |
|-------------|---------------|
| macOS (Darwin) | YES (25.4.0) |
| `claude` CLI | Assumed available |
| Git repo | YES (clean) |
| Node.js | YES (v25.9.0) |
| ohpm | **MISSING** |
| hvigor | **MISSING** |

## 4. Loop Behavior

Each loop tick:
1. Checks git status (refuse to run if dirty with unknown changes)
2. Reads current task queue
3. Finds first READY task
4. Executes exactly that task
5. Updates task status
6. Writes loop report
7. Commits if changes made (planning docs only)
8. **Stops** — does not continue to next task

## 5. Safety Gates

| Gate | Behavior |
|------|----------|
| Dirty worktree (non-planning changes) | STOP, report, wait for human |
| No READY tasks | Report all BLOCKED reasons, stop |
| Environment missing | Document ENV_BLOCKED, continue planning |
| User decision required | Report decision, mark BLOCKED_BY_DECISION, stop |
| Reader-Core modified externally | Report new HEAD, re-audit if needed |

## 6. Manual Trigger (Recommended First)

Before enabling any automation, test manually:

```bash
cd "/Users/minliny/Documents/Reader for HarmonyOS"
/harmonyos-loop
```

The loop should execute HOS-0A-004 (or next READY task) and stop.

## 7. Installation Status

- [ ] Cron: **NOT INSTALLED** (requires user authorization)
- [ ] LaunchAgent: **NOT INSTALLED** (requires user authorization)
- [ ] `/loop` command: **NOT STARTED** (requires active Claude Code session)
- [x] Loop command file: **CREATED** (`.claude/commands/harmonyos-loop.md`)
- [x] This setup doc: **CREATED**

**User must explicitly authorize any cron/launchd/loop installation.**
