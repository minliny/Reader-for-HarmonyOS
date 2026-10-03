# Settings theme consumer — accepted selection versus save receipt

The Settings theme segmented control now captures the current page presentation
identity. Its business method checks that identity, mounted state and exact
captured Runtime before invoking the existing ThemeHost; a delayed native failure
toast repeats those checks. Disappear retires the captured Runtime. This fixes
both a misleading old rollback claim and the old physical callback that could
write a successor ThemeHost after its original page retired/reopened.

The failure text is now “主题保存尚未确认，当前选择已保留，请稍后重试”. Current
accepted theme, style, selection and original geometry stay unchanged. The leaf
never compensates by saving an older theme. Store/Preferences and ThemeHost are
existing owners; this commit does not change their persistence behavior.

`test-settings-theme-write-consumer.mjs` compiles the actual Settings segmented
consumer, invokes its emitted callback and production method, and continues
through the actual ThemeHost, AppearanceStore and platform Preferences adapter.
Native seam failures before/after put and flush prove accepted night selection,
truthful toast, unsaved state and exactly one original put with no old-theme
compensation. SDK selectedIndex is checked after failure. Reopened presentation,
replaced Runtime and retired toast callbacks are rejected. This is local and SDK
consumer evidence; target native persistence/layout and visual acceptance remain
separate.
