# سجل التغييرات / Changelog

## 1.4.10 — 2026-11-12

<div dir="rtl">

- أدوات الترجمة في المشغّل: ضبط التوقيت يدويًا (يُحفظ لكل فيلم أو حلقة، ويعمل مع VLC عبر setSpuDelay)، وترتيب الترجمات وفق بصمة الملف واسم الإصدار، والضبط بضغطتين.
- ترجمة ملفات الترجمة إلى لغة التطبيق عبر Gemini (بمفتاح المستخدم) أو Google Translate، على دفعات تبدأ من موضع التشغيل، مع ذاكرة مؤقتة وعرض للتقدّم.
- تحديث سياسة الخصوصية.

</div>

## 1.4.9 — 2026-11-12

<div dir="rtl">

- مراجعة للثبات: العمل في الخلفية والعودة إلى التطبيق (VLC، والخادم المحلي، والإعلانات التشويقية)، وإلغاء التورنت، والحفظ الفوري، وتقليل إعادة الرسم.
- إصلاحات من المراجعة الثانية: زر إلغاء العدّ التنازلي، وتبادل المزامنة المتكرّر، وحدّ أقصى لسجلّ المشاهدة، وتشفير رمز PIN، وخيار ملء الشاشة في VLC على iPhone، والضغط على إشعار التحديث، وطلبات البحث، وصيغة base32، وقواعد Firestore، ونصوص الخصوصية.
- إصلاح خطأ في صفحة العمل (استدعاء Hooks خارج المكوّن)، وتحسين إخفاء واجهة YouTube في الإعلان التشويقي.

</div>

## 1.4.8 — 2026-11-12

<div dir="rtl">

- إصلاح إغلاق التطبيق على Android عند تشغيله (كانت أداة R8 تحذف الصنف WorkDatabase_Impl من مكتبة WorkManager).

</div>

## 1.4.7 — 2026-11-12

<div dir="rtl">

- تبويب Soon للأفلام والمسلسلات المرتقبة بعرض عمودي على غرار المقاطع القصيرة.
- العودة إلى عرض الإعلان التشويقي عبر إطار YouTube مع إخفاء واجهته، وإصلاح زر كتم الصوت.

</div>

## 1.4.6 — 2026-11-12

<div dir="rtl">

- إشعار بالتحديثات داخل التطبيق اعتمادًا على إصدارات GitHub.
- ينشر البناء إصدارًا يتضمّن ملفّي IPA وAPK.
- إشعار على الجهاز بالتحديثات في الخلفية دون خادم.
- عرض الإعلان التشويقي بالمشغّل الأصلي من رابط مباشر بدلًا من إطار YouTube.

</div>

## 1.4.5 — 2026-11-12

<div dir="rtl">

- يظهر مؤشّر السحب بمجرد البدء بسحب الصفحة إلى الأسفل.
- يظهر الإعلان التشويقي أسرع: أصبحت مدة الإخفاء ثانية واحدة، وتُجلب بيانات العمل فور الضغط عليه.

</div>

## 1.4.4 — 2026-11-12

<div dir="rtl">

- الإعلان التشويقي: لا يظهر أي جزء من واجهة YouTube؛ إذ لا يظهر إلا بعد بدء التشغيل فعليًا، ويختفي قبل النهاية وعند التوقّف.
- زر الصوت في الزاوية السفلية، ويُحفظ كتم الصوت لجميع الصفحات.
- يوقف زر التشغيل الإعلان ويعيد صورة الغلاف.
- صفحة العمل: أُزيل زر الإغلاق (X)، وأصبح الإغلاق بالسحب إلى الأسفل مع مؤشّر في الأعلى.
- متابعة المشاهدة: تعود إلى المصدر أو التورنت نفسه وتستأنف من الموضع ذاته.
- ترتيب التورنت من الأصغر حجمًا إلى الأكبر.
- أسماء الحلقات وأوصافها بلغة التطبيق (ترجمة آلية).
- زر AirPlay في المشغّل على iPhone.
- جلب المصادر: تظهر النتائج تباعًا، وتُعاد محاولة كل إضافة إذا تأخّرت أو أعادت نتيجة فارغة، ولم يعد الطلب القديم يمحو نتيجة أحدث.

</div>

## 1.4.3 — 2026-11-11

<div dir="rtl">

- صفحة الفيلم أو المسلسل: يعمل الإعلان التشويقي تلقائيًا مكان الصورة مع الصوت، مع زر صغير لكتمه، ويبقى الشعار فوقه.
- الاسم والوصف بلغة التطبيق (من ويكيبيديا وويكي بيانات).
- يعيد زر التشغيل المحاولة قبل الإفادة بعدم توفّر مصادر.
- يختفي مؤشّر التحميل فور بدء الفيديو.
- لم يعد زر تخطّي المقدّمة يغطّي الترجمة.

</div>

## 1.4.2 — 2026-11-11

<div dir="rtl">

- Android: إصلاح إغلاق التطبيق عند تشغيل مشغّل VLC (كانت بعض ملفاته تُحذف أثناء التحزيم).

</div>

- Android: fixed the app closing when the VLC player starts (release build shrinking removed classes libVLC needs).

## 1.4.1 — 2026-11-11

<div dir="rtl">

- تشغيل التورنت المباشر أسرع من أول مرة: المحرّك يبدأ مبكرًا عند فتح صفحة العنوان، ويحفظ عُقد DHT والمنفذ ومعرّف الجهاز بين الجلسات، ويضيف متتبّعات عامة معروفة لكل رابط.
- أثناء جلب بيانات الملف: عرض حيّ لعدد عُقد DHT والأقران والوقت، ومهلة أطول (75 ثانية)، وإمكانية الإلغاء بالضغط على المصدر. عند انتهاء المهلة يبقى التورنت محمّلًا فتكمل المحاولة التالية من حيث توقّفت.
- بعد إغلاق المشغّل يبقى التورنت جاهزًا دقيقتين، فإعادة الفتح فورية.
- Android: إصلاح منع الاتصال بخادم البث المحلي (http)، وإصلاح تحديد التبويب النشط في الشريط العائم وترتيبه مع العربية.
- تنبيه للإضافات التي تعمل عبر http غير المشفّر.
- الصفحة الرئيسية أخف مع كثرة الكتالوجات.

</div>

- Faster first torrent play: the engine warms up when a title page opens, keeps DHT nodes, port and peer ID between sessions, and appends well-known public trackers to every magnet.
- While fetching file info: live DHT/peer count and seconds, a longer 75 s timeout, tap the source to cancel. On timeout the torrent stays loaded so the next try continues where it left off.
- After closing the player the torrent stays ready for 2 minutes, so reopening is instant.
- Android: fixed blocked connection to the local stream server (cleartext http), fixed the active tab highlight and RTL order in the floating bar.
- Notice for add-ons that use unencrypted http.
- Lighter home screen with many catalogs (virtualized rows).

## 1.4.0 — 2026-11-11

<div dir="rtl">

- Android: شريط تبويب عائم بمظهر زجاجي (تمويه حقيقي على Android 12 فأحدث)، وأزرار وأشرطة علوية بلمسة زجاجية.
- Android: محرّك التورنت المباشر ومشغّل VLC واختيار المشغّل، كما في iPhone.
- أمان: خادم البث المحلي يتطلّب مفتاحًا سرّيًا عشوائيًا لكل جلسة، ولا يقبل إلا الاتصالات من الجهاز نفسه.
- شاشة التشخيص مخفية افتراضيًا، وتُفعَّل من الإعدادات ← عام ← أدوات التشخيص.
- مزامنة سحابية أخفّ: كتابة واحدة كل 30 ثانية على الأكثر أثناء المشاهدة، مع حفظ فوري عند الخروج من التطبيق.
- إصلاحات ثبات: تجاهل نتائج الترجمة المتأخرة، ومهلة لتحميل الترجمات، ومنع فتح المشغّل بعد مغادرة صفحة العنوان، وعدم تسجيل روابط البث في السجلات.

</div>

- Android: floating glass tab bar (real blur on Android 12+), glass-style top bars and buttons.
- Android: direct torrent engine, VLC player and player choice, same as iPhone.
- Security: the local stream server now requires a random per-session secret and only accepts connections from the device itself.
- Diagnostics screen hidden by default; enable it in Settings → General → Diagnostic tools.
- Lighter cloud sync: at most one write every 30 s while watching, flushed when the app goes to the background.
- Stability: late subtitle results ignored, subtitle download timeout and size limit, no player opening after leaving a title page, stream URLs no longer logged.

## 1.3.4 — 2026-11-11 (test build, iPhone)

<div dir="rtl">

- إصلاح إغلاق التطبيق عند التشغيل منذ 1.3.0 (خطأ برمجي عند تحميل مكوّن مشغّل VLC).
- عند حدوث خطأ فادح تظهر شاشة الخطأ بدل إغلاق التطبيق.

</div>

- Fixed the launch crash since 1.3.0 (a code error when loading the VLC player component).
- Fatal errors now show the error screen instead of closing the app.

## 1.3.2 — 2026-11-11 (test build, iPhone)

<div dir="rtl">

- عودة مشغّل VLC على iPhone بطريقة آمنة: لا يُحمَّل إلا عند تشغيل ملف يحتاجه، فلا يمكن أن يمنع التطبيق من الفتح. إن تعذّر تحميله تظهر رسالة توضّح السبب.

</div>

- VLC player back on iPhone, loaded safely: it only loads when a source needs it, so it can't stop the app from launching. If it can't load, the player shows why.

## 1.3.1 — 2026-11-11

<div dir="rtl">

- iPhone: إيقاف مشغّل VLC مؤقتًا لإصلاح إغلاق التطبيق عند التشغيل في الإصدار 1.3.0؛ تعود رسالة الصيغ غير المدعومة (MKV) مؤقتًا.
- Android: محرّك التورنت المباشر ومشغّل VLC (لملفات MKV وأصوات AC3 وE-AC3 وDTS وTrueHD والترجمات المدمجة)، مع الإعداد نفسه: تلقائي / الأصلي / VLC.

</div>

- iPhone: VLC player temporarily removed to fix the launch crash in 1.3.0; the unsupported-format (MKV) message is back for now.
- Android: direct torrent engine and the VLC player (MKV, AC3/E-AC3/DTS/TrueHD audio, embedded subtitles), with the same Auto / Native / VLC setting.

## 1.3.0 — 2026-11-11

<div dir="rtl">

- مشغّل VLC ثانٍ على iPhone يشغّل ملفات MKV وHEVC وDolby Vision وأصوات DDP.
- الإعدادات ← المشغّل: تلقائي / الأصلي / VLC. في الوضع التلقائي ينتقل التطبيق إلى VLC عند الحاجة أو عند تعذّر فتح المصدر.
- اختيار مسار الصوت والترجمات المدمجة في مشغّل VLC.
- قراءة مسبقة أكبر في الوضع المباشر لتشغيل أسلس للملفات عالية الدقة.
- قسم تراخيص البرمجيات مفتوحة المصدر في «حول» (libVLC بموجب LGPL-2.1).

</div>

- Second player based on VLC on iPhone: plays MKV, HEVC, Dolby Vision and DDP audio.
- Settings → Player: Auto / Native / VLC. Auto switches to VLC when needed or when the native player can't open a source.
- Audio track and embedded subtitle selection in the VLC player.
- Larger read-ahead in direct mode for smoother high-bitrate playback.
- Open-source licenses section in About (libVLC under LGPL-2.1).

## 1.2.1 — 2026-11-11

<div dir="rtl">

- الوضع المباشر: تحميل مسبق لبداية الملف ونهايته قبل فتح المشغّل، مع عرض عدد الأقران وحجم ما نُزّل.
- رسالة واضحة عند اختيار ملف بصيغة لا يدعمها مشغّل iOS (مثل MKV)، وتفضيل ملفات MP4 تلقائيًا.
- رابط البث يتضمّن اسم الملف وامتداده.

</div>

- Direct mode: pre-buffers the start and end of the file before opening the player, showing peers and downloaded size.
- Clear message when a file format isn't supported by the iOS player (e.g. MKV); MP4 files are preferred automatically.
- Stream URLs now include the file name and extension.

## 1.2.0 — 2026-11-11

<div dir="rtl">

- وضع تورنت «مباشر» اختياري (معطّل افتراضيًا): محرّك مدمج يشغّل مصادر التورنت داخل التطبيق دون خدمة وسيطة، مع دعم التقديم والتأخير.
- يتطلّب التفعيل تأكيدًا صريحًا؛ إذ يتصل الجهاز بأقران ويرفع أجزاءً من الملف أثناء التشغيل.
- حدّ رفع منخفض قابل للتعديل (100 KB/s افتراضيًا)، وتتوقّف المشاركة عند إغلاق المشغّل، وذاكرة مؤقتة بحدّ 2 غيغابايت مع زر لمسحها.
- على iOS يعمل البث والتطبيق مفتوح فقط.
- تحديث شروط الاستخدام وسياسة الخصوصية.

</div>

- Optional "Direct" torrent mode (off by default): a built-in engine plays torrent sources inside the app with no middleman service, with seeking.
- Turning it on requires explicit confirmation, since the device connects to peers and uploads pieces while playing.
- Low adjustable upload limit (100 KB/s default), sharing stops when the player closes, 2 GB cache cap with a clear button.
- On iOS, streaming works only while the app is open.
- Updated Terms of Use and Privacy Policy.

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
