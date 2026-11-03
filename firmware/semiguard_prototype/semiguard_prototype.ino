/*
 * SemiGuard teaching prototype, protocol v1. Arduino UNO wiring reference.
 * Button D2 -> GND (INPUT_PULLUP); external LED D9 -> resistor -> LED -> GND.
 * LED_BUILTIN mirrors the command, so the USB link can be checked without a model.
 * This reports button state and an LED command. It measures no process pressure.
 */

#include <string.h>

const uint8_t BUTTON_PIN = 2;
const uint8_t STATUS_LED_PIN = 9;
const unsigned long DEBOUNCE_MS = 40;
const unsigned long TELEMETRY_INTERVAL_MS = 200;
const uint8_t COMMAND_LIMIT = 16;

bool faultActive = false;
int previousRawButton = HIGH;
int stableButton = HIGH;
unsigned long rawChangedAt = 0;
unsigned long lastTelemetryAt = 0;
uint32_t sequence = 0;
uint32_t lastResetId = 0;
char commandBuffer[COMMAND_LIMIT + 1];
uint8_t commandLength = 0;
bool commandOverflow = false;

void updateLeds() {
  const uint8_t ledLevel = faultActive ? LOW : HIGH;
  digitalWrite(STATUS_LED_PIN, ledLevel);
  digitalWrite(LED_BUILTIN, ledLevel);
}

void sendTelemetry() {
  lastTelemetryAt = millis();
  Serial.print(F("{\"kind\":\"semiguard-prototype\",\"version\":1,\"seq\":"));
  Serial.print((unsigned long)sequence++);
  Serial.print(F(",\"uptimeMs\":"));
  Serial.print(lastTelemetryAt);
  Serial.print(F(",\"faultActive\":"));
  Serial.print(faultActive ? F("true") : F("false"));
  Serial.print(F(",\"ledCommand\":\""));
  Serial.print(faultActive ? F("off") : F("on"));
  Serial.print(F("\",\"resetAck\":"));
  Serial.print((unsigned long)lastResetId);
  Serial.println(F("}"));
}

bool parseResetId(const char *command, uint32_t &requestId) {
  if (strncmp(command, "RESET ", 6) != 0 || command[6] == '\0') return false;
  uint32_t value = 0;
  for (const char *digit = command + 6; *digit != '\0'; ++digit) {
    if (*digit < '0' || *digit > '9') return false;
    const uint8_t number = (uint8_t)(*digit - '0');
    if (value > (0xFFFFFFFFUL - number) / 10UL) return false;
    value = value * 10UL + number;
  }
  if (value == 0) return false;
  requestId = value;
  return true;
}

void readCommands() {
  // Limit work per loop so malformed/flooded input cannot starve the button.
  for (uint8_t processed = 0; processed < 64 && Serial.available() > 0; ++processed) {
    const char incoming = (char)Serial.read();
    if (incoming == '\n') {
      commandBuffer[commandLength] = '\0';
      uint32_t resetId = 0;
      if (!commandOverflow && parseResetId(commandBuffer, resetId)) {
        faultActive = false;
        updateLeds();
        lastResetId = resetId;
        sendTelemetry(); // The browser confirms this response, not the write alone.
      }
      commandLength = 0;
      commandOverflow = false;
    } else if (incoming != '\r' && !commandOverflow) {
      if (incoming < 32 || incoming > 126) { commandLength = 0; commandOverflow = true; }
      else if (commandLength < COMMAND_LIMIT) commandBuffer[commandLength++] = incoming;
      else { commandLength = 0; commandOverflow = true; }
    }
  }
}

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  previousRawButton = digitalRead(BUTTON_PIN);
  stableButton = previousRawButton;
  rawChangedAt = millis();
  updateLeds();
  Serial.begin(115200);
  sendTelemetry();
}

void loop() {
  readCommands();
  const unsigned long now = millis();
  const int rawButton = digitalRead(BUTTON_PIN);
  if (rawButton != previousRawButton) {
    previousRawButton = rawButton;
    rawChangedAt = now;
  }
  if ((unsigned long)(now - rawChangedAt) >= DEBOUNCE_MS && rawButton != stableButton) {
    stableButton = rawButton;
    if (stableButton == LOW) {
      faultActive = !faultActive;
      updateLeds();
      sendTelemetry();
    }
  }
  if ((unsigned long)(millis() - lastTelemetryAt) >= TELEMETRY_INTERVAL_MS) sendTelemetry();
}
