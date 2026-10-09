"""
ChatBrief - WhatsApp Chat Summarizer Flask Web Application
"""

import os
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file
from dotenv import load_dotenv

from parser import WhatsAppParser
from summarizer import ChatSummarizer

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB max file upload size
SAMPLE_DIR = Path(__file__).parent / "sample_chats"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/samples", methods=["GET"])
def get_samples():
    """List available sample chats."""
    samples = [
        {
            "id": "startup_product_launch",
            "title": "Startup Sprint Sync",
            "category": "Work & Product",
            "description": "Cross-functional team synchronizing on a beta release, AWS migration, icons, and legal approval.",
            "filename": "startup_product_launch.txt"
        },
        {
            "id": "weekend_roadtrip_planning",
            "title": "Lake Tahoe Road Trip",
            "category": "Vacation & Social",
            "description": "Friends organizing an Airbnb cabin, Costco groceries, departure timings, and games.",
            "filename": "weekend_roadtrip_planning.txt"
        }
    ]
    return jsonify({"samples": samples})


@app.route("/api/sample/<sample_id>", methods=["GET"])
def get_sample_content(sample_id):
    """Retrieve raw text of a specific sample chat."""
    filename = f"{sample_id}.txt"
    file_path = SAMPLE_DIR / filename
    if not file_path.exists():
        return jsonify({"error": "Sample chat not found"}), 404

    try:
        content = file_path.read_text(encoding="utf-8")
        return jsonify({
            "id": sample_id,
            "filename": filename,
            "content": content
        })
    except Exception as e:
        return jsonify({"error": f"Failed to read sample: {str(e)}"}), 500


@app.route("/api/analyze", methods=["POST"])
def analyze_chat():
    """
    Main analysis endpoint. Accepts either:
    - multipart/form-data with file upload ('file')
    - application/json with raw text ('raw_text')
    """
    try:
        raw_text = ""
        filename = "chat_export.txt"
        length = "medium"
        api_key = None
        model = None

        if request.is_json:
            data = request.get_json() or {}
            raw_text = data.get("raw_text", "")
            length = data.get("length", "medium")
            api_key = data.get("apiKey")
            model = data.get("model")
            filename = data.get("filename", "chat_export.txt")
        else:
            length = request.form.get("length", "medium")
            api_key = request.form.get("apiKey")
            model = request.form.get("model")

            if "file" in request.files:
                uploaded_file = request.files["file"]
                if uploaded_file.filename == "":
                    return jsonify({"error": "No file selected."}), 400
                filename = uploaded_file.filename
                # Read content safely with UTF-8 fallback
                file_bytes = uploaded_file.read()
                try:
                    raw_text = file_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    raw_text = file_bytes.decode("latin-1", errors="replace")
            else:
                raw_text = request.form.get("raw_text", "")

        if not raw_text or not raw_text.strip():
            return jsonify({"error": "Chat file or text is empty."}), 400

        # Step 1: Parse chat
        messages, stats = WhatsAppParser.parse_raw_text(raw_text)

        if not messages:
            return jsonify({
                "error": "Could not identify any WhatsApp messages in this file. Please verify it is a valid WhatsApp chat export (.txt)."
            }), 400

        # Step 2: Summarize
        summary_result = ChatSummarizer.summarize(
            messages=messages,
            stats=stats,
            summary_length=length,
            api_key=api_key,
            model_name=model
        )

        return jsonify({
            "status": "success",
            "filename": filename,
            "stats": stats,
            "messages": messages,
            "summary": summary_result
        })

    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.route("/api/resummarize", methods=["POST"])
def resummarize():
    """
    Re-generates summary for already parsed messages with a new length or model
    without re-uploading the file.
    """
    try:
        data = request.get_json() or {}
        messages = data.get("messages", [])
        stats = data.get("stats", {})
        length = data.get("length", "medium")
        api_key = data.get("apiKey")
        model = data.get("model")

        if not messages:
            return jsonify({"error": "Messages data required for resummarization."}), 400

        summary_result = ChatSummarizer.summarize(
            messages=messages,
            stats=stats,
            summary_length=length,
            api_key=api_key,
            model_name=model
        )

        return jsonify({
            "status": "success",
            "summary": summary_result
        })

    except Exception as e:
        return jsonify({"error": f"Resummarization error: {str(e)}"}), 500


@app.route("/api/verify-key", methods=["POST"])
def verify_api_key():
    """Validates if the provided Google Gemini API key works."""
    data = request.get_json() or {}
    key = data.get("apiKey", "").strip()
    if not key:
        return jsonify({"valid": False, "error": "API key cannot be empty."}), 400

    try:
        from google import genai
        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Say 'OK'",
        )
        return jsonify({"valid": True, "message": "API key is valid and connected to Gemini 2.5 Flash!"})
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"ChatBrief starting on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
