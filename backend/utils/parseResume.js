import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import path from "path";

/**
 * parseResumeFile(filePath)
 * returns { text: "...", skills: [...] }
 * - supports .pdf, .docx, .txt
 * - performs a simple skill regex extraction (expandable)
 */
export async function parseResumeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = "";

  if (ext === ".pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    text = pdfData.text || "";
  } else if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    text = result.value || "";
  } else if (ext === ".txt" || ext === ".md" || ext === ".rtf") {
    text = fs.readFileSync(filePath, "utf-8");
  } else {
    // fallback: try reading as text
    try { text = fs.readFileSync(filePath, "utf-8"); }
    catch(e) { throw new Error("Unsupported file format: " + ext); }
  }

  // Basic skill extraction (case-insensitive)
  const skillCandidates = [
    "JavaScript","TypeScript","React","Node.js","Express","Python","Django","Flask",
    "Java","Spring","C++","C#","SQL","PostgreSQL","MongoDB","AWS","Azure","GCP",
    "Docker","Kubernetes","Terraform","Machine Learning","TensorFlow","PyTorch",
    "Pandas","NumPy","Power BI","Tableau","Git","CI/CD","Agile","Scrum"
  ];

  const found = [];
  const lower = text.toLowerCase();
  for (const s of skillCandidates) {
    if (lower.includes(s.toLowerCase())) found.push(s);
  }

  return {
    text: text,                 // full extracted text (can be large)
    preview: text.substring(0, 2000), // optional truncated preview
    skills: found
  };
}
