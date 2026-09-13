# AOSP brightness curve source

Pinned version: `android-15.0.0_r1`, frameworks/base/packages/SettingsLib/DisplayUtils/src/com/android/settingslib/display/BrightnessUtils.java.
Source: https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/packages/SettingsLib/DisplayUtils/src/com/android/settingslib/display/BrightnessUtils.java
SHA256: `7d9a706e4b4ff49ae8decef1406719ca8c6b518d652488f171a22e1800785247`.
License: Apache-2.0, original header retained. Runtime thin port: `entry/src/main/ets/features/reading/ReaderBrightnessCurve.ts`.
Only the HLG numeric conversion is reused. Reader supplies UI coordinates, validated Settings observations, window ownership and restoration. Java Android APIs are not imported into HarmonyOS. The inverse remains continuous until UI mapping; no per-MOVE integer backlight quantization is introduced. This curve allocates low-level control distance; it is not proof of vendor backlight linearity or physical-nits calibration.
