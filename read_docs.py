import sys
import subprocess

def install_deps():
    try:
        import PyPDF2
        import docx
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2", "python-docx"])

install_deps()

import PyPDF2
import docx

pdf_path = r"c:\Users\AH\Downloads\SecureXpro\FYP scope document (3).pdf"
docx_path = r"c:\Users\AH\Downloads\SecureXpro\Module Document--A Modular Cybersecurity Assessment Framework - Copy.docx"

print("--- PDF Content ---")
try:
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for i, page in enumerate(reader.pages):
            print(f"Page {i+1}:")
            print(page.extract_text())
except Exception as e:
    print(f"Error reading PDF: {e}")

print("\n--- DOCX Content ---")
try:
    doc = docx.Document(docx_path)
    for para in doc.paragraphs:
        print(para.text)
except Exception as e:
    print(f"Error reading DOCX: {e}")
