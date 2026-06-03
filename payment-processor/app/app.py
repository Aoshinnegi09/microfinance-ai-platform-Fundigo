import os
import uuid
from datetime import datetime, timedelta

from flask import Flask, jsonify, request
from flask_cors import CORS

from models import Disbursement, Payment, db


def _payment_db_uri() -> str:
    direct = os.getenv("PAYMENT_DATABASE_URL")
    if direct:
        return direct
    host = os.getenv("POSTGRES_HOST")
    if host:
        user = os.getenv("POSTGRES_USER", "microfinance")
        password = os.getenv("POSTGRES_PASSWORD", "microfinance")
        database = os.getenv("POSTGRES_DB", "microfinance")
        port = os.getenv("POSTGRES_PORT", "5432")
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    return "sqlite:///payments.db"


def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config["SQLALCHEMY_DATABASE_URI"] = _payment_db_uri()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/v1/payments/initiate")
    def initiate_payment():
        data = request.get_json(silent=True) or {}
        missing = [k for k in ["loan_id", "amount"] if data.get(k) in (None, "")]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        payment = Payment(
            loan_id=int(data["loan_id"]),
            amount=float(data["amount"]),
            status="initiated",
            transaction_id=f"txn_{uuid.uuid4().hex[:16]}",
            provider=data.get("provider", "mock_upi"),
        )
        db.session.add(payment)
        db.session.commit()
        return jsonify({"payment_id": payment.id, "transaction_id": payment.transaction_id, "status": payment.status}), 201

    @app.post("/api/v1/disbursement/initiate")
    def initiate_disbursement():
        data = request.get_json(silent=True) or {}
        missing = [k for k in ["loan_id", "amount"] if data.get(k) in (None, "")]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        disbursement = Disbursement(loan_id=int(data["loan_id"]), amount=float(data["amount"]), status="processing")
        db.session.add(disbursement)
        db.session.commit()
        return jsonify({"disbursement_id": disbursement.id, "status": disbursement.status}), 201

    @app.get("/api/v1/payments/<int:payment_id>")
    def get_payment(payment_id: int):
        payment = db.session.get(Payment, payment_id)
        if not payment:
            return jsonify({"error": "Payment not found"}), 404
        return jsonify(
            {
                "id": payment.id,
                "loan_id": payment.loan_id,
                "amount": payment.amount,
                "status": payment.status,
                "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
                "transaction_id": payment.transaction_id,
            }
        )

    @app.post("/api/v1/emi/schedule")
    def emi_schedule():
        data = request.get_json(silent=True) or {}
        principal = float(data.get("principal", 0))
        annual_rate = float(data.get("annual_interest_rate", 0))
        tenure_months = int(data.get("tenure_months", 0))
        if principal <= 0 or annual_rate <= 0 or tenure_months <= 0:
            return jsonify({"error": "principal, annual_interest_rate, tenure_months must be > 0"}), 400

        monthly_rate = annual_rate / 12 / 100
        emi = principal * monthly_rate * ((1 + monthly_rate) ** tenure_months) / (((1 + monthly_rate) ** tenure_months) - 1)
        today = datetime.utcnow().date()
        schedule = []
        balance = principal
        for i in range(1, tenure_months + 1):
            interest = balance * monthly_rate
            principal_component = emi - interest
            balance = max(0.0, balance - principal_component)
            schedule.append(
                {
                    "installment": i,
                    "due_date": (today + timedelta(days=30 * i)).isoformat(),
                    "emi": round(emi, 2),
                    "principal_component": round(principal_component, 2),
                    "interest_component": round(interest, 2),
                    "remaining_balance": round(balance, 2),
                }
            )
        return jsonify({"emi": round(emi, 2), "schedule": schedule})

    @app.post("/api/v1/payments/webhook")
    def webhook():
        data = request.get_json(silent=True) or {}
        txn_id = data.get("transaction_id")
        status = data.get("status")
        if not txn_id or not status:
            return jsonify({"error": "transaction_id and status are required"}), 400
        payment = Payment.query.filter_by(transaction_id=txn_id).first()
        if not payment:
            return jsonify({"error": "Payment not found"}), 404
        payment.status = status
        if status == "completed":
            payment.payment_date = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Webhook processed", "payment_id": payment.id, "status": payment.status})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002)

