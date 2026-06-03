from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from app.models import User, db


def _issue_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=current_app.config["JWT_EXP_SECONDS"]),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def auth_required(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing bearer token"}), 401
        token = auth.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid token"}), 401
        user = db.session.get(User, payload.get("sub"))
        if not user:
            return jsonify({"error": "User not found"}), 401
        request.current_user = user
        return handler(*args, **kwargs)

    return wrapper


def register_routes(app):
    @app.post("/api/v1/auth/register")
    def register():
        data = request.get_json(silent=True) or {}
        required = ["email", "phone", "password", "name"]
        missing = [k for k in required if not data.get(k)]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
        if User.query.filter((User.email == data["email"]) | (User.phone == data["phone"])).first():
            return jsonify({"error": "User already exists"}), 409

        user = User(
            email=data["email"].lower().strip(),
            phone=data["phone"].strip(),
            password_hash=generate_password_hash(data["password"]),
            name=data["name"].strip(),
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({"id": user.id, "token": _issue_token(user.id)}), 201

    @app.post("/api/v1/auth/login")
    def login():
        data = request.get_json(silent=True) or {}
        user = User.query.filter_by(email=(data.get("email") or "").lower().strip()).first()
        if not user or not check_password_hash(user.password_hash, data.get("password", "")):
            return jsonify({"error": "Invalid credentials"}), 401
        return jsonify({"token": _issue_token(user.id), "user": {"id": user.id, "name": user.name, "kyc_status": user.kyc_status}})

