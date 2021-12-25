#include <Arduino.h>
#include <stdint.h>
#include <ArduinoJson.h>
#include <DHT.h>


/// Constants
#define JSON_BUFFER_SIZE 512
uint8_t const FAN_PIN = 10, LIGHT_PIN = 9, DHT_PIN = 11;
enum MSG_TYPES {
  get_value,
  set_value
};
bool PRINT_DEBUG = false;
const long INTERVAL = 1000;


/// Arduino State
float temprature_state = 0.0, humidity_state = 0.0;
bool fan_state = false, light_state = false;
DynamicJsonDocument outgoing_json(JSON_BUFFER_SIZE); // json in which the contents will be overwritten every time we send data (since the keys are same)

DHT dht(DHT_PIN, DHT11);

void setup() {
  Serial.begin(115200);
  
  pinMode(FAN_PIN, OUTPUT);
  pinMode(LIGHT_PIN, OUTPUT);

  // since the relay module input is active HIGH, setting the output pins to HIGH as default
  digitalWrite(FAN_PIN, HIGH);
  digitalWrite(LIGHT_PIN, HIGH);
  
  dht.begin();
}

void loop() {

  read_gpio(); // sync GPIO state

  if (Serial.available()) {

    String incoming_str = Serial.readString();

    DynamicJsonDocument json(JSON_BUFFER_SIZE);
    DeserializationError json_decoding_error = deserializeJson(json, incoming_str.c_str());

    if (json_decoding_error) {

      if (PRINT_DEBUG) {
        Serial.print(F("deserializeJson() failed: "));
        Serial.println(json_decoding_error.f_str());
      }

      //  return;

    } else { // if json read success

      if ((uint8_t) json["msg_type"] == MSG_TYPES::set_value) {

        light_state =  (bool) json["led"];
        fan_state =  (bool) json["fan"];

        sync_state_with_gpio();

      }

    }

  } /// read serial finished here





  //  sync_state_with_gpio(); // write the pin values
  //  read_dht(); // read the dht sensor
  send_state_data(); // contineusly send the state data at millis interval
}



void sync_state_with_gpio() {
  digitalWrite(FAN_PIN, !fan_state);
  digitalWrite(LIGHT_PIN, !light_state);
}

void read_gpio() {
  fan_state = digitalRead(FAN_PIN);
  light_state = digitalRead(LIGHT_PIN);
}

unsigned long previousMillis = 0;

void send_state_data() { // send the local state data to pc with some interval

  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= INTERVAL) {
    previousMillis = currentMillis;

    read_dht();

    outgoing_json["msg_type"] = MSG_TYPES::get_value;

    outgoing_json["temp"] = temprature_state;
    outgoing_json["hum"] = humidity_state;
    outgoing_json["led"] = light_state;
    outgoing_json["fan"] = fan_state;

    String output;
    serializeJson(outgoing_json, output);
    Serial.println(output);


  }


}



void read_dht() {

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println(F("Failed to read from DHT sensor!"));
    return;
  }

  temprature_state = t;
  humidity_state = h;

}
