import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

/**
 * uploadController - receives uploaded file (multer saved in uploads/)
 * forwards file to AI parser (python service) at AI_API_URL and returns parsed result.
 */
export const uploadController = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Prepare multipart/form-data to send to ai_api
    const form = new FormData();
    const stream = fs.createReadStream(req.file.path);
    form.append("file", stream, { filename: req.file.filename });

    const response = await axios.post(process.env.AI_API_URL, form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    // response.data should be { text: "...", skills: [...] }
    // Clean uploaded file after parsing
    try { fs.unlinkSync(req.file.path); } catch(e){}

    return res.json(response.data);
  } catch (err) {
    console.error("resumeController error:", err?.response?.data || err.message || err);
    return res.status(500).json({ error: "Parsing failed", details: err?.message || err });
  }
};
