#pragma once
#include <stdint.h>

// Arduino Mega 2560: agreed wiring layout, 2026-10-29.
// D0/D1 remain available for the USB serial connection to the Pi.
namespace VendingPins {
constexpr uint8_t DHT = 2;
constexpr uint8_t FAN = 23;
constexpr uint8_t MOTOR_COUNT = 20;
// Array index = slot - 1. These are driver control pins, not motor power.
constexpr uint8_t MOTORS[MOTOR_COUNT] = {
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    24, 14, 15, 16, 17, 18, 19, 20, 21, 22
};
// D13 is reserved: Mega bootloader blinks its LED before setup() can stop motors.
}  // namespace VendingPins
