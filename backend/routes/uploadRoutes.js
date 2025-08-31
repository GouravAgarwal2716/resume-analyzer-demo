import express from "express";
import multer from "multer";
import path from "path";
import { uploadController } from "../controllers/resumeController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.post("/upload", upload.single("resume"), uploadController);

export default router;
