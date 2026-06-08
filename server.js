const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const archiver = require("archiver");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const uploadDir = path.join(__dirname, "uploads");
const compressedDir = path.join(__dirname, "compressed");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(compressedDir)) fs.mkdirSync(compressedDir, { recursive: true });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function getOriginalName(file) {
  let name = file.originalname;

  // إصلاح مشكلة ظهور العربي كرموز غريبة
  if (/[ÃÂØÙ]/.test(name)) {
    name = Buffer.from(name, "latin1").toString("utf8");
  }

  return path.basename(name).replace(/[\\/:*?"<>|]/g, "_");
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    // اسم مؤقت فقط على السيرفر عشان ميتكررش
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ".pdf");
  },
});

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      path.extname(file.originalname).toLowerCase() === ".pdf";

    if (isPdf) cb(null, true);
    else cb(new Error("ارفع ملفات PDF فقط"));
  },
});

function compressPdf(inputPath, outputPath, quality) {
  return new Promise((resolve, reject) => {
    const gsCommand = process.platform === "win32" ? "gswin64c" : "gs";

    const settingsMap = {
      strong: "/screen",
      medium: "/ebook",
      light: "/printer",
    };

    const pdfSetting = settingsMap[quality] || "/ebook";

    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${pdfSetting}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    execFile(gsCommand, args, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function cleanup(files) {
  for (const file of files) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (err) {}
  }
}

app.post("/compress", upload.array("pdfs", 10), async (req, res) => {
  const files = req.files || [];
  const quality = req.body.quality || "medium";
  const toDelete = [];

  if (!files.length) {
    return res.status(400).json({ error: "اختار ملفات PDF الأول" });
  }

  try {
    const compressedFiles = [];

    for (const file of files) {
      const inputPath = file.path;
      toDelete.push(inputPath);

      // ده الاسم الأصلي اللي هينزل للمستخدم بدون تغيير
      const originalName = getOriginalName(file);

      const outputPath = path.join(
        compressedDir,
        Date.now() + "-" + Math.round(Math.random() * 1e9) + ".pdf"
      );

      toDelete.push(outputPath);

      await compressPdf(inputPath, outputPath, quality);

      compressedFiles.push({
        path: outputPath,
        name: originalName,
      });
    }

    // لو ملف واحد، نزله PDF بنفس الاسم الأصلي
    if (compressedFiles.length === 1) {
      const oneFile = compressedFiles[0];

      return res.download(oneFile.path, oneFile.name, () => {
        cleanup(toDelete);
      });
    }

    // لو أكتر من ملف، نزّل ZIP وجواه الملفات بنفس أسمائها الأصلية
    const zipPath = path.join(compressedDir, "compressed-pdfs.zip");
    toDelete.push(zipPath);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    for (const file of compressedFiles) {
      archive.file(file.path, { name: file.name });
    }

    await archive.finalize();

    output.on("close", () => {
      res.download(zipPath, "compressed-pdfs.zip", () => {
        cleanup(toDelete);
      });
    });

    archive.on("error", (err) => {
      throw err;
    });
  } catch (error) {
    console.error(error);
    cleanup(toDelete);

    res.status(500).json({
      error: "حصل خطأ أثناء ضغط الملفات",
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "مسموح برفع 10 ملفات فقط",
      });
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "حجم الملف كبير جدًا",
      });
    }
  }

  res.status(400).json({
    error: error.message || "حدث خطأ",
  });
});

app.listen(PORT, () => {
  console.log(`PDF compressor running on port ${PORT}`);
});
