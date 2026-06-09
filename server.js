const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// مجلدات التحميل والملفات المضغوطة
const uploadDir = path.join(__dirname, "uploads");
const compressedDir = path.join(__dirname, "compressed");

// التأكد من وجود المجلدات
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(compressedDir)) fs.mkdirSync(compressedDir, { recursive: true });

// دالة لحفظ الاسم الأصلي بدون تغييره
function safeName(name) {
  return path.basename(name);
}

// إعداد التخزين باستخدام multer
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + safeName(file.originalname));
  }
});

// رفع حتى 20 ملف PDF
const upload = multer({
  storage: storage,
  limits: { files: 20 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("مسموح فقط بملفات PDF"));
    }
    cb(null, true);
  }
});

// إعداد Express
app.use(express.static("public"));

// رفع الملفات
app.post("/upload", upload.array("pdfs", 20), (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "مفيش ملفات تم رفعها" });
  }
  if (files.length > 20) {
    return res.status(400).json({ error: "مسموح برفع 20 ملف فقط" });
  }

  // هنا ممكن تضيف ضغط PDF لو عايز
  res.json({ message: "تم رفع الملفات بنجاح", files: files.map(f => f.filename) });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
