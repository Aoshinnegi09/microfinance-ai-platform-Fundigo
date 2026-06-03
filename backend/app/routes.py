from datetime import datetime
from pathlib import Path
import json
import traceback

import requests
from flask import current_app, jsonify, request
from werkzeug.utils import secure_filename

from app.auth import auth_required
from app.models import Application, Document, KYCRecord, Loan, User, db

VOICE_SYSTEM_PROMPT = """You are a microfinance loan assistant for NovaPay in India. CRITICAL: Detect the language of the user input and respond ONLY in that same language. If user writes in English, respond in English. If Hindi, respond in Hindi. If Telugu, respond in Telugu. If Tamil, respond in Tamil. Respond ONLY with a JSON object (no markdown, no extra text): {\"understood_need\":\"brief summary\",\"business_type\":\"type\",\"suggested_loan_amount\":15000,\"estimated_monthly_income\":25000,\"risk_level\":\"low\",\"risk_reason\":\"brief reason\",\"tenure_months\":12,\"monthly_emi\":1349,\"total_payable\":16188,\"response_message\":\"warm message in SAME language as user input\",\"language_detected\":\"English\"}"""

def _json_required(fields, payload):
    missing = [f for f in fields if payload.get(f) in (None, "")]
    return missing

def register_routes(app):
    @app.post("/api/v1/voice/analyze")
    @auth_required
    def voice_analyze():
        data = request.get_json(silent=True) or {}
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"error": "text is required"}), 400
        api_key = current_app.config.get("GROQ_API_KEY", "")
        print(f"[VOICE] Groq API key present: {bool(api_key)}, length: {len(api_key)}", flush=True)
        if not api_key:
            return jsonify({"error": "Groq API key not configured"}), 500
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + api_key,
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "max_tokens": 1000,
                    "messages": [
                        {"role": "system", "content": VOICE_SYSTEM_PROMPT},
                        {"role": "user", "content": text}
                    ],
                },
                timeout=30,
            )
            print(f"[VOICE] Groq status: {resp.status_code}", flush=True)
            print(f"[VOICE] Groq response: {resp.text[:500]}", flush=True)
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(raw.replace("`json", "").replace("`", "").strip())
            return jsonify(parsed)
        except requests.RequestException as e:
            traceback.print_exc()
            return jsonify({"error": "Groq API error: " + str(e)}), 502
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": "Parse error: " + str(e)}), 500

    @app.post("/api/v1/loans/apply")
    @auth_required
    def apply_loan():
        data = request.get_json(silent=True) or {}
        missing = _json_required(["loan_amount", "purpose", "features"], data)
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
        score_payload = {"user_id": request.current_user.id, "features": data["features"]}
        try:
            score_resp = requests.post(f"{current_app.config['AI_ENGINE_URL']}/api/v1/score", json=score_payload, timeout=5)
            score_resp.raise_for_status()
            score_data = score_resp.json()
        except requests.RequestException:
            return jsonify({"error": "AI engine unavailable"}), 502
        app_record = Application(
            user_id=request.current_user.id,
            loan_amount=float(data["loan_amount"]),
            purpose=data["purpose"],
            status="scored",
            credit_score=float(score_data["credit_score"]),
        )
        db.session.add(app_record)
        interest_resp = requests.post(
            f"{current_app.config['AI_ENGINE_URL']}/api/v1/calculate-interest-rate",
            json={"credit_score": score_data["credit_score"], "loan_amount": data["loan_amount"]},
            timeout=5,
        )
        interest_data = interest_resp.json() if interest_resp.ok else {"interest_rate": 18.0}
        loan = Loan(
            user_id=request.current_user.id,
            amount=float(data["loan_amount"]),
            status="under_review",
            interest_rate=float(interest_data["interest_rate"]),
        )
        db.session.add(loan)
        db.session.commit()
        return jsonify({"application_id": app_record.id, "loan_id": loan.id, "credit_score": app_record.credit_score, "interest_rate": loan.interest_rate}), 201

    @app.get("/api/v1/loans/<int:loan_id>")
    @auth_required
    def get_loan(loan_id: int):
        loan = Loan.query.filter_by(id=loan_id, user_id=request.current_user.id).first()
        if not loan:
            return jsonify({"error": "Loan not found"}), 404
        return jsonify({"id": loan.id, "amount": loan.amount, "status": loan.status, "interest_rate": loan.interest_rate, "approval_date": loan.approval_date.isoformat() if loan.approval_date else None, "disbursement_date": loan.disbursement_date.isoformat() if loan.disbursement_date else None})

    @app.post("/api/v1/kyc/submit")
    @auth_required
    def submit_kyc():
        data = request.get_json(silent=True) or {}
        missing = _json_required(["gov_id", "address"], data)
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
        record = KYCRecord(user_id=request.current_user.id, gov_id=data["gov_id"], address=data["address"], status="approved" if len(data["gov_id"]) >= 8 else "pending")
        request.current_user.kyc_status = record.status
        db.session.add(record)
        db.session.commit()
        return jsonify({"kyc_id": record.id, "status": record.status})

    @app.post("/api/v1/documents/upload")
    @auth_required
    def upload_document():
        if "file" not in request.files:
            return jsonify({"error": "file is required"}), 400
        doc_type = request.form.get("doc_type", "general")
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "filename is required"}), 400
        filename = secure_filename(file.filename)
        upload_dir = Path(current_app.config["UPLOAD_DIR"])
        upload_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{request.current_user.id}_{int(datetime.utcnow().timestamp())}_{filename}"
        storage_path = upload_dir / stored_name
        file.save(storage_path)
        document = Document(user_id=request.current_user.id, doc_type=doc_type, filename=filename, storage_path=str(storage_path))
        db.session.add(document)
        db.session.commit()
        return jsonify({"document_id": document.id, "doc_type": doc_type, "filename": filename}), 201



