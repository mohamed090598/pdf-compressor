const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const archiver = require("archiver");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
const uploadDir = path.join(__dirname, "uploads");
const compressedDir = path.join(__dirname, "compressed");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(compressedDir)) fs.mkdirSync(compressedDir, { recursive: true });

function safeName(name) {
  return path.basename(name).replace(/[^\u0600-\u06FFa-zA-Z0-9._-]/g, "_");
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, safeName(file.originalname));
});

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 80 * 1024 * 1024 // 80MB per file
  },
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";
    if (isPdfMime || isPdfExt) cb(null, true);
    else cb(new Error("ارفع ملفات PDF فقط"));
  },
});

function compressPdf(inputPath, outputPath, quality) {
  return new Promise((resolve, reject) => {
    const gsCommand = process.platform === "win32" ? "gswin64c" : "gs";

    const settingsMap = {
      strong: "/screen",
      medium: "/ebook",
      light: "/printer"
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
      inputPath
    ];

    execFile(gsCommand, args, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function cleanup(paths) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {}
  }
}

app.post("/compress", upload.array("pdfs", 10), async (req, res) => {
  const inputFiles = req.files || [];
  const quality = req.body.quality || "medium";
  const toDelete = [];

  if (!inputFiles.length) {
    return res.status(400).json({ error: "اختار ملف PDF واحد على الأقل" });
  }

  try {
    const compressedFiles = [];

    for (const file of inputFiles) {
      const inputPath = file.path;
      toDelete.push(inputPath);

const outputName = safeName(file.originalname);
      const outputPath = path.join(compressedDir, `${Date.now()}-${outputName}`);
      toDelete.push(outputPath);

      await compressPdf(inputPath, outputPath, quality);
      compressedFiles.push({ path: outputPath, name: outputName });
    }
if (compressedFiles.length === 1) {
  const oneFile = compressedFiles[0];

  return res.download(oneFile.path, oneFile.name, () => {
    cleanup(toDelete);
  });
}
    const zipName = `compressed-pdfs-${Date.now()}.zip`;
    const zipPath = path.join(compressedDir, zipName);
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
    cleanup(toDelete);
    res.status(500).json({
      error: "حصل خطأ أثناء ضغط الملفات. تأكد أن Ghostscript مثبت على السيرفر."
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "مسموح برفع 10 ملفات فقط في المرة الواحدة" });
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "حجم الملف كبير. الحد الأقصى 80MB لكل ملف" });
    }
  }
  res.status(400).json({ error: error.message || "حدث خطأ" });
});

app.listen(PORT, () => {
  console.log(`PDF compressor running on port ${PORT}`);
});
