import os
from serial import Serial
from flask import Flask, jsonify, request, render_template, send_from_directory
from werkzeug.security import safe_join
from flask_cors import CORS
import mysql.connector
import logging
from threading import Thread, Lock
import bcrypt
import jwt
from datetime import datetime
import json
import time

logging.basicConfig(format='%(asctime)s [%(levelname)s] %(filename)s:%(lineno)d | %(message)s',
                    datefmt='%d-%m-%Y %H:%M:%S', level=logging.DEBUG)

config = {
    "SERIAL": {
        "enabled": True,
        "port": "/dev/ttyACM0",
        "baudRate": 115200
    },
    "WEB_SERVER": {
        "host": "127.0.0.1",
        "port": 5050
    },
    "DATABASE": {
        "host": "localhost",
        "user": "root",
        "password": "",
        "database_name": "dbms_project"
    },
    "JWT": {
        "secret": "ENTER_YOUR_SECRET_HERE",
    },
    "APP": {
        "DB_STORE_INTERVAL": 5,
        "SIGNUP_ENABLED": True
    }
}

logging.info('Program Started!')

db = mysql.connector.connect(
    host=config["DATABASE"]["host"],
    user=config["DATABASE"]["user"],
    password=config["DATABASE"]["password"],
    database=config["DATABASE"]["database_name"],
    raise_on_warnings=True
)

logging.info(f'Connected to DB! Connection ID: {db.connection_id}')

# Globals
static_path = safe_join(os.path.dirname(__file__), 'static')
app = Flask(__name__, static_url_path="/static", template_folder=static_path)
CORS(app)

# App State
app_state = {
    "led": False,
    "fan": False,
    "temp": 0.0,
    "hum": 0.0
}

serial = None
lock = Lock()

if config["SERIAL"]["enabled"]:
    logging.info(
        f'Serial is enabled! Connecting to Port: {config["SERIAL"]["port"]} at {config["SERIAL"]["baudRate"]} baud rate')
    serial = Serial(
        port=config["SERIAL"]["port"],
        baudrate=config["SERIAL"]["baudRate"],
    )
    time.sleep(1)
else:
    logging.info("Serial NOT enabled!")

MSG_TYPES = {
    "get_value": 0,
    "set_value": 1
}


def syncStateWithArduino():
    global serial, app_state
    lock.acquire()
    output_dict = {
        "msg_type": MSG_TYPES["set_value"],
        "led": app_state["led"],
        "fan": app_state["fan"]
    }
    out_json = json.dumps(output_dict)
    logging.debug(f"serial_out: {out_json}")
    serial.write(out_json.encode())
    lock.release()


def encodeJWT(payload):
    return jwt.encode(payload, config["JWT"]["secret"], algorithm="HS256")


def decodeJWT(payload):
    try:
        jwt_data = jwt.decode(payload, config["JWT"]["secret"], algorithms=["HS256"])
        return True, jwt_data
    except Exception as e:
        return False, str(e)


def readFromSerial():
    global serial, app_state
    logging.info("Spawning new thread for reading serial data")
    serial_status = serial.isOpen()
    logging.debug(f"Serial is: {'Opened' if serial_status else 'NOT Opened'}")
    while True:
        incoming_data = str(serial.readline().decode("utf-8"))
        logging.debug(f"serial_in: {incoming_data.strip()}")
        try:
            json_data = json.loads(incoming_data)
            if json_data["msg_type"] is MSG_TYPES["get_value"]:
                lock.acquire()
                app_state["led"] = json_data["led"]
                app_state["fan"] = json_data["fan"]
                app_state["temp"] = json_data["temp"]
                app_state["hum"] = json_data["hum"]
                lock.release()
        except Exception as e:
            pass


def saveStateIntoDB():
    logging.info("Spawning new thread for saving state into DB")
    while True:
        time.sleep(config["APP"]["DB_STORE_INTERVAL"])
        logging.debug(f"Saving data into DB")
        db_input = {
            "temp": app_state["temp"],
            "hum": app_state["hum"]
        }
        sql = "INSERT INTO `resource_values` (`id`, `value`, `timestamp`) VALUES (NULL, %s, current_timestamp());"
        val = (json.dumps(db_input).strip(),)
        cursor = db.cursor()
        logging.debug(f"Executing query: {sql % val}")
        cursor.execute(sql, val)
        db.commit()


def checkIsAuthenticated():
    jwt_token = request.args.get('authorization')
    if not jwt_token:
        return False, "No authorization token was found"
    token_decode_status, jwt_payload_data = decodeJWT(jwt_token)
    if not token_decode_status:
        return False, jwt_payload_data
    else:
        return True, jwt_payload_data


#######################
#     HTTP ROUTES     #
#######################

@app.route("/")
def index():
    return render_template('index.html')


@app.route("/api/signup", methods=["POST"])
def signup():
    try:
        if not config["APP"]["SIGNUP_ENABLED"]:
            return jsonify({"error": "Signup is closed!"}), 403
        req_body = request.get_json()
        username = req_body["username"]
        password = req_body["password"]
        hashed_pw = bcrypt.hashpw(str.encode(password), bcrypt.gensalt())

        sql = "INSERT INTO `users` (`id`, `username`, `password`, `last_login`) VALUES (NULL, %s, %s, 'N/A');"
        val = (username, hashed_pw)
        cursor = db.cursor()
        logging.debug(f"Executing query: {sql % val}")
        cursor.execute(sql, val)
        db.commit()

        logging.debug(f"{cursor.rowcount} record(s) inserted into db, id: {cursor.lastrowid}")
        return jsonify({"message": "ok"}), 201
    except Exception as e:
        error_msg = str(e)
        logging.error(error_msg)
        return jsonify({"error": error_msg}), 500


@app.route("/api/login", methods=["POST"])
def login():
    try:
        req_body = request.get_json()
        in_username = req_body["username"]
        in_password = req_body["password"]

        sql = f"SELECT id, username, password FROM `users` WHERE `username` = %s;"
        val = (in_username,)
        cursor = db.cursor()
        logging.debug(f"Executing query: {sql % val}")
        cursor.execute(sql, val)
        result = cursor.fetchone()

        if not result:
            return jsonify({"error": "User account not found!\nPlease check the username."}), 404
        if not bcrypt.checkpw(str.encode(in_password), str.encode(result[2])):
            return jsonify({"error": "The entered password does not match!\nPlease enter correct password."}), 401

        # updating last_login for user
        current_time = str(datetime.now().strftime("%d-%m-%Y %I:%M:%S %p"))
        sql = f"UPDATE `users` SET `last_login` = '{current_time}' WHERE `users`.`id` = {result[0]};"
        cursor = db.cursor()
        logging.debug(f"Executing query: {sql}")
        cursor.execute(sql)
        db.commit()

        jwt_token = encodeJWT({
            'id': result[0],
            'username:': result[1]
        })
        logging.debug(f"{result[1]} logging in")
        return jsonify({"message": "ok", "token": jwt_token}), 201
    except Exception as e:
        error_msg = str(e)
        logging.error(error_msg)
        return jsonify({"error": error_msg}), 500


@app.route("/api/state", methods=["GET"])
def state():
    authorized, auth_data = checkIsAuthenticated()
    if not authorized:
        return jsonify({'error': auth_data}), 401
    if not config["SERIAL"]["enabled"]:
        return jsonify({"error": "Arduino Serial Not Connected!"}), 500
    return jsonify(app_state)


@app.route("/api/state", methods=["POST"])
def save_state():
    authorized, auth_data = checkIsAuthenticated()
    if not authorized:
        return jsonify({'error': auth_data}), 401
    try:
        if not config["SERIAL"]["enabled"]:
            raise Exception("Arduino Serial Not Connected!")
        req_body = request.get_json()
        lock.acquire()
        app_state["led"] = req_body["led"]
        app_state["fan"] = req_body["fan"]
        lock.release()
        Thread(target=syncStateWithArduino, daemon=True).start()
        return jsonify(app_state)

    except Exception as e:
        error_msg = str(e)
        logging.error(error_msg)
        return jsonify({"error": error_msg}), 500


# realtime values
@app.route("/api/graph/realtime", methods=["GET"])
def graph_realtime_values():
    authorized, auth_data = checkIsAuthenticated()
    if not authorized:
        return jsonify({'error': auth_data}), 401
    try:
        items_limit = int(request.args.get('items_limit'))
        sql = "SELECT * FROM `resource_values` ORDER BY timestamp DESC LIMIT %s;"
        val = (items_limit,)
        cursor = db.cursor()
        logging.debug(f"Executing query: {sql % val}")
        cursor.execute(sql, val)
        result = cursor.fetchall()
        json_output = list(map(lambda item: {'data': json.loads(item[1]), 'time': str(item[2])}, result))
        return jsonify({'items_limit': items_limit, 'output': json_output})
    except Exception as e:
        error_msg = str(e)
        logging.error(error_msg)
        return jsonify({"error": error_msg}), 500


# aggregated values
@app.route("/api/graph/group_by_min", methods=["GET"])
def graph_group_values():
    authorized, auth_data = checkIsAuthenticated()
    if not authorized:
        return jsonify({'error': auth_data}), 401
    try:
        time_interval = int(request.args.get('time_interval'))
        limit = int(request.args.get('limit'))
        sql = "SELECT * FROM `resource_values` GROUP BY UNIX_TIMESTAMP(timestamp) DIV %s LIMIT %s;"
        val = (time_interval, limit,)
        cursor = db.cursor()
        logging.debug(f"Executing query: {sql % val}")
        cursor.execute(sql, val)
        result = cursor.fetchall()
        json_output = list(map(lambda item: {'data': json.loads(item[1]), 'time': str(item[2])}, result))
        return jsonify({'time_interval': time_interval / 60, 'output': json_output})
    except Exception as e:
        error_msg = str(e)
        logging.error(error_msg)
        return jsonify({"error": error_msg}), 500


# static file handler
@app.route('/<path:path>')
def _static(path):
    if os.path.isdir(safe_join(static_path, path)):
        path = os.path.join(path, 'index.html')
    return send_from_directory(static_path, path)


if __name__ == '__main__':
    if config["SERIAL"]["enabled"]:
        Thread(target=readFromSerial, daemon=True).start()
        Thread(target=saveStateIntoDB, daemon=True).start()
    logging.info(f'Starting Flask Web Server on {config["WEB_SERVER"]["host"]}:{config["WEB_SERVER"]["port"]}')
    app.run(host=config["WEB_SERVER"]["host"], port=config["WEB_SERVER"]["port"])
