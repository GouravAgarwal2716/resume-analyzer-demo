from flask import Flask, request, jsonify
import os, tempfile
import pdfplumber
import docx
import re
import spacy

app = Flask(__name__)

# load spaCy model for light NER if available
try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

# simple skill list (expand as needed)
SKILLS = ["Python","JavaScript","TypeScript","React","Node.js","Django","Flask","SQL","PostgreSQL","MongoDB",
          "AWS","Azure","GCP","Docker","Kubernetes","TensorFlow","PyTorch","Pandas","NumPy","Tableau","Power BI","Git","CI/CD","Terraform"]

def extract_text_from_pdf(path):
    out = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            txt = page.extract_text()
            if txt:
                out.append(txt)
    return "\n".join(out)

def extract_text_from_docx(path):
    doc = docx.Document(path)
    return "\n".join([p.text for p in doc.paragraphs])

def extract_text(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    elif ext == ".docx":
        return extract_text_from_docx(path)
    else:
        # fallback to plain text
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

def extract_skills(text):
    found = []
    lower = text.lower()
    for s in SKILLS:
        if s.lower() in lower:
            found.append(s)
    return list(sorted(set(found)))

def extract_name_email(text):
    name = None
    email = None
    # email
    m = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    if m:
        email = m.group(0)

    # try NER for PERSON if available
    if nlp:
        doc = nlp(text[:5000])
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                name = ent.text
                break
    return name, email

@app.route("/parse-file", methods=["POST"])
def parse_file():
    if 'file' not in request.files:
        return jsonify({"error":"no file sent"}), 400
    f = request.files['file']
    fd, tmpname = tempfile.mkstemp(suffix=os.path.splitext(f.filename)[1])
    os.close(fd)
    f.save(tmpname)
    try:
        text = extract_text(tmpname)
        skills = extract_skills(text)
        name, email = extract_name_email(text)
        # return preview to reduce payload
        preview = text[:5000]
        return jsonify({"text": text, "preview": preview, "skills": skills, "name": name, "email": email})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try: os.remove(tmpname)
        except: pass

if __name__ == "__main__":
    app.run(port=5001, debug=True)
