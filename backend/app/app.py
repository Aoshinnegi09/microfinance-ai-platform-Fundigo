import logging
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

from app import auth, routes
from app.config import Config
from app.models import db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app)

    logging.basicConfig(level=logging.INFO)
    Path(app.config["UPLOAD_DIR"]).mkdir(parents=True, exist_ok=True)

    db.init_app(app)

    with app.app_context():
        db.create_all()

    auth.register_routes(app)
    routes.register_routes(app)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.errorhandler(Exception)
    def handle_exception(error):
        app.logger.exception("Unhandled error: %s", error)
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

