<p align="center"><img src="assets/icon.png" width="120" /></p>

<h1 align="center">M</h1>

<div dir="rtl">

مركز وسائط حديث لنظام iOS يجمع الأفلام والمسلسلات من **إضافات تعمل ببروتوكول Stremio المفتوح**، بتصميم زجاجي (Liquid Glass) وحركة سلسة، ودعم كامل للعربية والإنجليزية.

> الاسم «M» مؤقت.

## المزايا

- واجهة رئيسية بعرض مميّز متحرّك وصفوف أفقية، وتصفية حسب الأفلام أو المسلسلات.
- صفحة عمل كاملة: التقييم والوصف والبطولة والمواسم والحلقات وأعمال مشابهة.
- مشغّل مخصّص: شريط تقديم، وتقديم وإرجاع، وسرعات، وترجمات (من المصدر أو OpenSubtitles)، وتخطّي المقدّمة، والحلقة التالية تلقائيًا، وقفل الشاشة، وصورة داخل صورة.
- «تابع المشاهدة» و«قائمتي» لكل ملف شخصي.
- ملفات شخصية متعددة، وملف للأطفال، وتصنيف عمري، وقفل برمز PIN.
- إدارة الإضافات: تثبيت برابط manifest.json، وتفعيل وتعطيل وحذف.
- ستة سمات ألوان، ومظهر ترجمة قابل للتخصيص.
- حركة افتتاحية أصلية، وتحترم إعداد «تقليل الحركة».

## المصادر

يشغّل التطبيق الروابط المباشرة (MP4 / HLS)، ويدعم **إضافات التورنت** اختياريًا: يحوّل التطبيق مصدر التورنت (infoHash / magnet) إلى رابط مباشر عبر **خدمة Debrid** (Real-Debrid أو TorBox) بمفتاحك الخاص، أو عبر **خادم بث** تديره أنت (مثل خادم Stremio). فعّل ذلك من الإعدادات ← التورنت. روابط «أين تشاهده» تفتح الخدمات الرسمية.
الإضافات الافتراضية: Cinemeta، وأفلام مفتوحة المصدر (Blender، رخصة CC BY)، وWatchHub، وOpenSubtitles.

**أنت المسؤول عن الإضافات التي تثبّتها.** راجع [شروط الاستخدام](TERMS.md) و[سياسة الخصوصية](PRIVACY.md).

## التثبيت

ابنِ ملف IPA من GitHub Actions (‏build-ipa)، ثم ثبّته عبر SideStore أو AltStore.

</div>

---

## English

A modern iOS media center for **Stremio-protocol add-ons**: Liquid Glass UI, smooth motion, full Arabic (RTL) and English.

- Built with Expo SDK 58, expo-router native tabs, expo-glass-effect, Reanimated 4, expo-video.
- Direct streams, plus optional torrent add-on support: torrent sources are resolved to direct URLs through a debrid service (Real-Debrid / TorBox, your own token) or a streaming server you run (Settings → Torrents). "Where to watch" opens official services.
- Profiles (kids, maturity, PIN), My List, Continue Watching, subtitles, skip intro, auto next episode, themes.
- No analytics. Data is stored on the device; an optional account syncs it across your devices.

Build: run the `build-ipa` workflow (unsigned IPA) and sideload with SideStore/AltStore.

Developer: [za7ef](https://github.com/za7ef) · Not affiliated with Stremio or any streaming service.
