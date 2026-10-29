#pragma once
// Driver logic is configurable; GPIO controls drivers, never motor/fan power directly.
constexpr uint8_t MOTOR_ON_LEVEL = HIGH;
constexpr uint8_t FAN_ON_LEVEL = HIGH;
// Initial test settings, not a certified supplement storage specification.
constexpr float FAN_TEMP_ON = 30.0f;
constexpr float FAN_TEMP_OFF = 28.0f;
constexpr float FAN_HUMIDITY_ON = 70.0f;
constexpr float FAN_HUMIDITY_OFF = 65.0f;
