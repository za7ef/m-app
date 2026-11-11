# سجل التغييرات / Changelog

## 1.1.3 — 2026-11-11

<div dir="rtl">

- دعم اختياري لإضافات التورنت: تُعرض مصادر التورنت (info-hash / magnet) في صفحة العمل، وتُحوَّل إلى رابط مباشر عبر حساب Debrid خاص بك (Real-Debrid أو TorBox) أو عبر خادم تشغّله. الميزة معطّلة افتراضيًا.
- قسم «التورنت» في الإعدادات مع اختبار الاتصال. يُحفظ المفتاح في التخزين الآمن على الجهاز، ولا يُزامَن المفتاح ولا عنوان الخادم.
- تحديث شروط الاستخدام وسياسة الخصوصية.

</div>

- Optional torrent add-on support: torrent sources (info-hash / magnet) appear on the title page and are resolved to a direct link through your own debrid account (Real-Debrid / TorBox) or a server you run. Off by default.
- New Settings → Torrents section with a connection test. The token is kept in the device's secure storage; the token and server address are never synced.
- Updated Terms of Use and Privacy Policy.

## 1.1.2 — 2026-11-11

<div dir="rtl">

- إصلاح عدم ظهور شاشة تسجيل الدخول وشاشة «من يشاهد؟» عند التشغيل الأول.
- أسماء ملفات التنزيل تتضمّن رقم الإصدار.

</div>

- Fixed the sign-in and "Who's watching?" screens not appearing on first launch.
- Download file names now include the version number.

## 1.1.1 — 2026-11-11

<div dir="rtl">

- إصلاح إغلاق التطبيق عند التشغيل على Android.
- شاشة تعرض تفاصيل الخطأ عند حدوثه، مع إمكانية مشاركتها.
- إصلاح حالة نادرة كان فيها التطبيق لا يعرض شاشة تسجيل الدخول أو اختيار الملف الشخصي.

</div>

- Fixed the launch crash on Android.
- An error screen now shows details when something goes wrong, with a Share button.
- Fixed a rare case where the sign-in / profile screen didn't appear.

## 1.1.0 — 2026-11-11

<div dir="rtl">

- إصدار Android من الشيفرة نفسها: أيقونة متكيّفة، وشريط تنقّل سفلي أصلي، ودعم كامل للعربية.
- على Android يُستبدل التأثير الزجاجي بخلفية شبه شفافة.
- نافذة تأكيد كلمة المرور عند حذف الحساب تعمل على النظامين.

</div>

- Android version from the same codebase: adaptive icon, native bottom navigation, full Arabic RTL.
- On Android, glass surfaces fall back to translucent panels.
- Password confirmation for account deletion now works on both platforms.

## 1.0.3 — 2026-11-11

<div dir="rtl">

- حسابات اختيارية: إنشاء حساب وتسجيل الدخول بالبريد الإلكتروني أو Google، واستعادة كلمة المرور.
- مزامنة سحابية للملفات الشخصية وقائمتي ومواضع المشاهدة لكل حلقة والإعدادات والإضافات، مع العمل دون اتصال.
- قسم «الحساب» في الإعدادات: حالة المزامنة، وتسجيل الخروج، وحذف الحساب وبياناته السحابية.
- حفظ موضع المشاهدة لكل حلقة على حدة.
- تحديث سياسة الخصوصية وشروط الاستخدام.

</div>

- Optional accounts: email sign-up/sign-in, Google sign-in, password reset.
- Cloud sync of profiles, My List, per-episode progress, settings and add-ons; works offline.
- Settings → Account: sync status, sign out, delete account and its cloud data.
- Watch position is now saved per episode.
- Updated Privacy Policy and Terms.

## 1.0.2 — 2026-11-11

<div dir="rtl">

- أصبحت «الإعدادات» تبويبًا في الشريط السفلي، وتُدار الملفات الشخصية من داخلها.
- نُقل البحث من الشريط السفلي إلى زر زجاجي في أعلى الشاشة الرئيسية.
- أصبح الشريط العلوي عند التمرير زجاجيًا متدرّجًا يتلاشى نحو الأسفل دون حافة حادة.
- أُزيل زر الصورة الرمزية من أعلى الشاشة الرئيسية.

</div>

- Settings is now a tab in the bottom bar; profiles are managed from inside it.
- Search moved from the tab bar to a glass button at the top of Home.
- The scrolling top bar is now a gradient glass that fades out downward, with no hard edge.
- Removed the avatar button from the top of Home.

## 1.0.1 — 2026-11-11

<div dir="rtl">

- إصلاح تشغيل «أفلام مفتوحة المصدر»: توقّف الخادم السابق عن إتاحة الملفات، فاستُبدلت به روابط HTTPS موثوقة مع رابط احتياطي لكل فيلم.
- ينتقل المشغّل تلقائيًا إلى الرابط الاحتياطي عند تعذّر المصدر، ويعرض سطرًا صغيرًا بتفاصيل الخطأ.
- توسيط أيقونة التشغيل في صور الحلقات.
- عرض النصوص الإنجليزية داخل الواجهة العربية بالاتجاه الصحيح، فتظهر علامات الترقيم في موضعها.
- جعل الشريط العلوي في صفحة العمل معتمًا، فلا يبدو زر التشغيل مقطوعًا عند التمرير.

</div>

- Fixed Open Movies playback: the old host stopped serving the files; switched to reliable HTTPS mirrors with a fallback per title.
- The player now falls back to the next mirror automatically and shows a small error-details line.
- Centered the play icon on episode thumbnails.
- English text inside the Arabic UI now uses its own direction, so punctuation sits correctly.
- Solid title-page header bar so the Play button never looks cut off.

## 1.0.0 — 2026-11-11

<div dir="rtl">

- الإصدار الأول.
- واجهة رئيسية وبحث وقائمتي وإدارة إضافات.
- صفحة العمل مع المواسم والحلقات.
- مشغّل مخصّص مع الترجمات وتخطّي المقدّمة والحلقة التالية.
- ملفات شخصية مع ملف أطفال وقفل PIN.
- ست سمات ألوان وحركة افتتاحية.
- العربية والإنجليزية مع دعم كامل للاتجاه من اليمين إلى اليسار.

</div>

- First release: home, search, My List, add-ons, title page, custom player, profiles, themes, launch animation, Arabic/English.
