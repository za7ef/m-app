import { APP_NAME, DEVELOPER, DEVELOPER_URL } from './config';
export const EFFECTIVE = '2026-11-11';

export const LEGAL = {
  terms: {
    ar: [
      ['', `تاريخ السريان: ${EFFECTIVE}. المطوّر: ${DEVELOPER}.`],
      ['1. طبيعة التطبيق', `${APP_NAME} مركز وسائط يعرض كتالوجات ومعلومات تأتي من إضافات خارجية تعمل ببروتوكول مفتوح. لا يستضيف التطبيق أي فيلم أو مسلسل أو ملف، ولا يرفع أي محتوى.`],
      ['2. الإضافات', 'الإضافات خدمات يديرها أطراف ثالثة، وأنت وحدك المسؤول عن الإضافات التي تثبّتها وعن المحتوى الذي تصل إليه عبرها، وعن التأكّد من امتلاكك حق مشاهدته. لا يدعم التطبيق مصادر التورنت ولا يرشّح إضافات قرصنة.'],
      ['الحساب', 'الحساب اختياري، وأنت مسؤول عن سرية كلمة المرور وعن النشاط الذي يتم عبر حسابك. قد تتوقّف خدمة المزامنة أو تتغيّر دون إشعار.'],
      ['3. الاستخدام المقبول', 'تتعهّد باستخدام التطبيق وفق الأنظمة المعمول بها، وعدم استخدامه لانتهاك حقوق الملكية الفكرية أو لأي غرض غير مشروع.'],
      ['4. الخدمات الخارجية', 'روابط «أين تشاهده» تفتح خدمات رسمية خارجية، والترجمات والبيانات الوصفية تأتي من خدمات مثل Cinemeta وOpenSubtitles. هذه الخدمات خارج سيطرة المطوّر، وقد تتوقّف أو تتغيّر دون إشعار.'],
      ['5. إخلاء الضمان', 'يُقدَّم التطبيق «كما هو» و«حسب توفّره» دون أي ضمان صريح أو ضمني، بما في ذلك ضمان الملاءمة لغرض معيّن أو خلوّه من الأخطاء.'],
      ['6. حدود المسؤولية', 'إلى أقصى حد يسمح به النظام، لا يتحمّل المطوّر أي مسؤولية عن أي ضرر مباشر أو غير مباشر ينتج عن استخدام التطبيق أو الإضافات أو المحتوى الذي تصل إليه عبرها.'],
      ['7. التعديلات', 'قد تُعدَّل هذه الشروط في الإصدارات القادمة، ويُعدّ استمرارك في استخدام التطبيق قبولًا للشروط المعدّلة.'],
      ['8. النظام الحاكم', 'تخضع هذه الشروط لأنظمة المملكة العربية السعودية.'],
      ['9. التواصل', DEVELOPER_URL],
    ],
    en: [
      ['', `Effective: ${EFFECTIVE}. Developer: ${DEVELOPER}.`],
      ['1. What the app is', `${APP_NAME} is a media center that shows catalogs and metadata from third-party add-ons using an open protocol. It hosts no movies, series or files and uploads no content.`],
      ['2. Add-ons', 'Add-ons are run by third parties. You alone are responsible for the add-ons you install, the content you access through them, and making sure you have the right to watch it. Torrent sources are not supported and no piracy add-ons are suggested.'],
      ['Account', 'An account is optional. You are responsible for keeping your password safe and for activity under your account. The sync service may change or stop without notice.'],
      ['3. Acceptable use', 'You agree to use the app lawfully and not to infringe intellectual-property rights or use it for any unlawful purpose.'],
      ['4. Third-party services', '"Where to watch" links open official external services; subtitles and metadata come from services such as Cinemeta and OpenSubtitles. These are outside the developer\'s control and may change or stop without notice.'],
      ['5. No warranty', 'The app is provided "as is" and "as available", without warranties of any kind, express or implied.'],
      ['6. Limitation of liability', 'To the maximum extent permitted by law, the developer is not liable for any direct or indirect damages arising from use of the app, add-ons, or content accessed through them.'],
      ['7. Changes', 'These terms may change in future versions. Continued use means you accept the updated terms.'],
      ['8. Governing law', 'These terms are governed by the laws of the Kingdom of Saudi Arabia.'],
      ['9. Contact', DEVELOPER_URL],
    ],
  },
  privacy: {
    ar: [
      ['', `تاريخ السريان: ${EFFECTIVE}. المطوّر: ${DEVELOPER}.`],
      ['ما لا نجمعه', 'الحساب اختياري. لا يحتوي التطبيق على تحليلات أو إعلانات أو أدوات تتبّع.'],
      ['الحساب والمزامنة (اختياري)', 'إذا أنشأت حسابًا، تُخزَّن بيانات حسابك عبر Firebase من Google: البريد الإلكتروني ومعرّف المستخدم (أو بيانات حساب Google عند استخدامه). وتُخزَّن نسخة من ملفاتك الشخصية (الاسم والصورة الرمزية وإعدادات الرقابة ورمز PIN) وقائمتي ومواضع المشاهدة لكل حلقة والإعدادات وروابط الإضافات التي ثبّتّها في قاعدة بيانات Firestore، ولا يصل إليها إلا حسابك. يمكن للمطوّر بصفته مالك المشروع الوصول التقني إلى هذه البيانات، ولا يستخدمها لأي غرض آخر.'],
      ['حذف البيانات', 'يمكنك حذف حسابك وجميع بياناته السحابية في أي وقت من الإعدادات ← الحساب ← حذف الحساب. يؤدي تسجيل الخروج إلى إيقاف المزامنة مع بقاء النسخة المحلية.'],
      ['ما يُحفظ على جهازك', 'تُحفظ الملفات الشخصية وقائمتي ومواضع التوقّف والإعدادات والإضافات المثبّتة محليًا على جهازك، وتُحذف بحذف التطبيق. وعند تسجيل الدخول تُزامَن نسخة منها كما هو موضّح أعلاه.'],
      ['ما يُرسل إلى الإضافات', 'عند التصفّح أو البحث أو فتح عمل، يُرسل التطبيق إلى الإضافات المثبّتة نوع العمل ومعرّفه (مثل معرّف IMDb) ونص البحث فقط. لكل إضافة سياسة خصوصية خاصة بها.'],
      ['الترجمات', 'تُطلب الترجمات من OpenSubtitles عبر إضافتها بمعرّف العمل فقط.'],
      ['التشغيل', 'عند تشغيل مصدر، يتصل جهازك مباشرة بالخادم الذي يستضيفه. وروابط «أين تشاهده» تفتح الخدمة الرسمية في متصفّحك أو تطبيقها.'],
      ['التواصل', DEVELOPER_URL],
    ],
    en: [
      ['', `Effective: ${EFFECTIVE}. Developer: ${DEVELOPER}.`],
      ['What we don\'t collect', 'An account is optional. There are no analytics, ads or trackers.'],
      ['Account & sync (optional)', 'If you create an account, your account data is stored with Google Firebase: your email and user ID (or your Google account info if you use Google sign-in). A copy of your profiles (name, avatar, parental settings, PIN), My List, per-episode watch progress, settings and the URLs of add-ons you installed is stored in Firestore, accessible only to your account. As project owner the developer has technical access to this data and does not use it for anything else.'],
      ['Deleting your data', 'You can delete your account and all its cloud data at any time in Settings → Account → Delete account. Signing out stops syncing and keeps the local copy.'],
      ['Stored on your device', 'Profiles, My List, resume points, settings and installed add-ons are stored locally and removed when you delete the app. When signed in, a copy is synced as described above.'],
      ['Sent to add-ons', 'When you browse, search or open a title, the app sends installed add-ons only the content type, its ID (e.g. an IMDb ID) and your search text. Each add-on has its own privacy policy.'],
      ['Subtitles', 'Subtitles are requested from OpenSubtitles through its add-on using the title ID only.'],
      ['Playback', 'When you play a source, your device connects directly to the server hosting it. "Where to watch" links open the official service in your browser or its app.'],
      ['Contact', DEVELOPER_URL],
    ],
  },
};
