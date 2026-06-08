# موقع ضغط 10 ملفات PDF مرة واحدة

الموقع يسمح برفع من 1 إلى 10 ملفات PDF، يضغطهم، ويرجعهم في ملف ZIP.

## التشغيل على جهازك

1. ثبّت Node.js.
2. ثبّت Ghostscript:
   - Windows: ثبّت Ghostscript وتأكد أن الأمر `gswin64c` يعمل.
   - Linux/Ubuntu:
     ```bash
     sudo apt update
     sudo apt install ghostscript
     ```
3. افتح Terminal داخل مجلد المشروع:
   ```bash
   npm install
   npm start
   ```
4. افتح:
   ```txt
   http://localhost:3000
   ```

## رفعه أونلاين

ارفع المشروع على Render أو Railway أو VPS يدعم تثبيت Ghostscript.

ملحوظة مهمة:
Replit قد لا يشغّل Ghostscript تلقائيًا إلا لو أضفته في إعدادات البيئة.
Render أسهل لو استخدمت Docker أو VPS.