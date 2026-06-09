const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const app = express();
const port = process.env.PORT || 3000;

// إعداد التخزين باستخدام multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 ميجا لكل ملف
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("الملف يجب أن يكون PDF"));
    } else {
      cb(null, true);
    }
  },
}).array("pdfs", 20); // الحد الأقصى 20 ملف PDF

app.use(express.static("public"));

// صفحة رفع الملفات
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// مسار ضغط الملفات
app.post("/compress", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).send(err.message);
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).send("لم يتم رفع أي ملف");
    }

    try {
      // ضغط كل ملف PDF
      const compressedFiles = await Promise.all(
        req.files.map(async (file) => {
          const pdfDoc = await PDFDocument.load(file.buffer);
          const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
          return {
            filename: file.originalname,
            buffer: pdfBytes,
          };
        })
      );

      // إنشاء مجلد مؤقت للملفات المضغوطة
      const tempDir = path.join(__dirname, "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const zipFilePath = path.join(tempDir, "compressed_files.zip");
      const archiver = require("archiver");
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        res.download(zipFilePath, "compressed_files.zip", (err) => {
          if (err) console.error(err);
          fs.rmSync(tempDir, { recursive: true, force: true });
        });
      });

      archive.on("error", (err) => {
        throw err;
      });

      archive.pipe(output);

      compressedFiles.forEach((file) => {
        archive.append(file.buffer, { name: file.filename });
      });

      await archive.finalize();
    } catch (e) {
      console.error(e);
      res.status(500).send("حدث خطأ أثناء ضغط الملفات");
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
