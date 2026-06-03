from flask import Flask, jsonify, request

from engine import engineer_features, fair_lending_check, train_model


def create_app():
    app = Flask(__name__)
    artifacts = train_model()

    @app.get("/health")
    def health():
        return {"status": "ok", "metrics": artifacts.metrics}

    @app.post("/api/v1/score")
    def score():
        data = request.get_json(silent=True) or {}
        feats = data.get("features")
        if not isinstance(feats, dict):
            return jsonify({"error": "features object is required"}), 400
        vector = engineer_features(feats).reshape(1, -1)
        prob = float(artifacts.model.predict_proba(vector)[0][1])
        score = int(300 + prob * 550)
        return jsonify({"credit_score": score, "approval_probability": round(prob, 4), "model_metrics": artifacts.metrics})

    @app.post("/api/v1/predict-approval")
    def predict_approval():
        data = request.get_json(silent=True) or {}
        feats = data.get("features")
        if not isinstance(feats, dict):
            return jsonify({"error": "features object is required"}), 400
        vector = engineer_features(feats).reshape(1, -1)
        prob = float(artifacts.model.predict_proba(vector)[0][1])
        fair = fair_lending_check(feats, prob)
        return jsonify({"approved": prob >= 0.55, "approval_probability": round(prob, 4), "fair_lending": fair})

    @app.post("/api/v1/calculate-interest-rate")
    def calculate_interest():
        data = request.get_json(silent=True) or {}
        credit_score = float(data.get("credit_score", 300))
        loan_amount = float(data.get("loan_amount", 0))
        base_rate = 12.0
        score_discount = max(0, (credit_score - 650) / 100)
        amount_risk = min(4.0, loan_amount / 100000)
        rate = max(8.5, base_rate + amount_risk - score_discount)
        return jsonify({"interest_rate": round(rate, 2)})

    @app.post("/api/v1/calculate-loan-amount")
    def calculate_loan_amount():
        data = request.get_json(silent=True) or {}
        monthly_income = float(data.get("monthly_income", 0))
        obligations = float(data.get("monthly_expense", 0)) + float(data.get("existing_emi", 0))
        disposable = max(0.0, monthly_income - obligations)
        eligible = disposable * 18
        return jsonify({"recommended_loan_amount": round(eligible, 2), "max_emi": round(disposable * 0.45, 2)})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)

