from flask import Flask

def create_app():
    app = Flask(__name__,  static_folder='static', template_folder='templates')
    app.config["ASSETS_ROOT"] = "/static"
    app.config.from_object('config.Config')

    from app.routes.gps_routes import bp as gps_bp
    app.register_blueprint(gps_bp)

    return app
