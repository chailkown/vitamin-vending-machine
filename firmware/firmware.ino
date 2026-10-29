#include <DHT.h>
#include "mega_pin_map.h"
#include "settings.h"

DHT sensor(VendingPins::DHT, DHT22);
char input[48];
uint8_t used = 0, running = 0;
bool overflow = false, fanOn = true, sensorValid = false;
unsigned long motorStarted = 0, motorDuration = 0, sampled = 0;
float temperature = 0, humidity = 0;

void fan(bool enabled) {
  fanOn = enabled;
  digitalWrite(VendingPins::FAN, enabled ? FAN_ON_LEVEL : !FAN_ON_LEVEL);
}
void stopMotor() {
  for (uint8_t i = 0; i < VendingPins::MOTOR_COUNT; ++i)
    digitalWrite(VendingPins::MOTORS[i], !MOTOR_ON_LEVEL);
  running = 0;
}
bool number(const char *&p, unsigned long &value, unsigned long limit) {
  if (*p < '0' || *p > '9') return false;
  value = 0;
  while (*p >= '0' && *p <= '9') {
    value = value * 10 + (*p++ - '0');
    if (value > limit) return false;
  }
  return true;
}
void command() {
  if (!strcmp(input, "PING")) Serial.println(F("PONG MOTOR20_V1"));
  else if (!strcmp(input, "STOP")) { stopMotor(); Serial.println(F("STOPPED")); }
  else if (!strcmp(input, "STATUS")) Serial.println(running ? F("STATUS BUSY") : F("STATUS IDLE"));
  else if (!strcmp(input, "ENV")) {
    Serial.print(F("ENV ")); Serial.print(sensorValid ? F("OK ") : F("ERROR "));
    Serial.print(temperature); Serial.print(' '); Serial.print(humidity);
    Serial.print(F(" FAN ")); Serial.println(fanOn ? 1 : 0);
  } else {
    unsigned long slot = 0, duration = 0; const char *p = input + 4;
    if (strncmp(input, "RUN ", 4) || !number(p, slot, 20) || *p++ != ' ' ||
        !number(p, duration, 5000) || *p || slot < 1 || duration < 100) {
      Serial.println(F("ERR COMMAND")); return;
    }
    if (running) { Serial.println(F("ERR BUSY")); return; }
    running = slot; motorDuration = duration; motorStarted = millis();
    digitalWrite(VendingPins::MOTORS[slot - 1], MOTOR_ON_LEVEL);
    Serial.print(F("STARTED ")); Serial.println(slot);
  }
}
void setup() {
  // Set output latches before changing direction to avoid active-low startup pulses.
  for (uint8_t i = 0; i < VendingPins::MOTOR_COUNT; ++i) {
    digitalWrite(VendingPins::MOTORS[i], !MOTOR_ON_LEVEL);
    pinMode(VendingPins::MOTORS[i], OUTPUT);
  }
  digitalWrite(VendingPins::FAN, FAN_ON_LEVEL); pinMode(VendingPins::FAN, OUTPUT);
  sensor.begin(); Serial.begin(115200);
  sampled = millis() - 2500UL;
}
void loop() {
  if (running && (unsigned long)(millis() - motorStarted) >= motorDuration) {
    uint8_t finished = running; stopMotor();
    Serial.print(F("DONE ")); Serial.println(finished);
  }
  // Bound serial work so a noisy scanner/host cannot postpone the motor deadline.
  for (uint8_t count = 0; count < 16 && Serial.available(); ++count) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      input[used] = 0;
      if (overflow) Serial.println(F("ERR LENGTH")); else command();
      used = 0; overflow = false;
    } else if (used < sizeof(input) - 1) input[used++] = c;
    else overflow = true;
  }
  // DHT reads briefly block; never sample during a timed motor run.
  if (!running && (unsigned long)(millis() - sampled) >= 2500UL) {
    sampled = millis(); temperature = sensor.readTemperature(); humidity = sensor.readHumidity();
    sensorValid = !isnan(temperature) && !isnan(humidity);
    if (!sensorValid) fan(true);
    else if (temperature >= FAN_TEMP_ON || humidity >= FAN_HUMIDITY_ON) fan(true);
    else if (temperature <= FAN_TEMP_OFF && humidity <= FAN_HUMIDITY_OFF) fan(false);
  }
}
