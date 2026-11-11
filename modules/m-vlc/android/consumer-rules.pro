# libVLC looks up these classes by name from native code (JNI_OnLoad); R8 must not strip or rename them.
-keep class org.videolan.libvlc.** { *; }
-keep class org.videolan.medialibrary.** { *; }
-dontwarn org.videolan.**
