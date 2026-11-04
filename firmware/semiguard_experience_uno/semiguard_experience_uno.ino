/*
 * SemiGuard experience protocol v2 - UNO/Nano-class PWM EXAMPLE ONLY.
 * No board, lamp or driver model has been selected or hardware verified.
 * Pin 9 is a CONTROL signal for a compatible external LED driver, not a lamp
 * power supply. Verify voltage/current, dimming input, isolation and polarity.
 * Only the CENTRAL PURPLE lamp is controlled. The two WHITE fill lights use
 * their own rated steady supply/dimmer and are NOT connected to this channel.
 * No RF power or actual optical brightness is measured by this sketch.
 */
#include <Arduino.h>

const uint8_t PURPLE_PWM_PIN = 9; // Example for classic UNO/Nano, verify board.
const bool PWM_ACTIVE_LOW = false; // Change only after checking the DRIVER input.
const uint32_t FRAME_INTERVAL_MS = 250;
const uint32_t COMMAND_TIMEOUT_MS = 2000;
const uint8_t MAX_COMMAND_LENGTH = 96;

char commandLine[MAX_COMMAND_LENGTH + 1];
uint8_t commandLength = 0;
bool discardLine = false;
uint32_t frameSequence = 0;
uint32_t commandAck = 0;
uint32_t lastCommandAt = 0;
uint32_t lastFrameAt = 0;
uint8_t ledBrightness = 0;
bool faultActive = false;
bool watchdogOff = true;

void applyPurpleOutput(uint8_t logicalBrightness) {
  analogWrite(PURPLE_PWM_PIN, PWM_ACTIVE_LOW ? 255 - logicalBrightness : logicalBrightness);
}

void emitFrame(uint32_t now) {
  // commandAck confirms accepted output settings, not optical feedback.
  Serial.print(F("{\"kind\":\"semiguard-experience\",\"version\":2,\"seq\":"));
  Serial.print(frameSequence++);
  Serial.print(F(",\"uptimeMs\":")); Serial.print(now);
  Serial.print(F(",\"ledBrightness\":")); Serial.print(ledBrightness);
  Serial.print(F(",\"commandAck\":")); Serial.print(commandAck);
  Serial.print(F(",\"faultActive\":")); Serial.print(faultActive ? F("true") : F("false"));
  Serial.print(F(",\"watchdogOff\":")); Serial.print(watchdogOff ? F("true") : F("false"));
  Serial.println(F("}"));
  lastFrameAt = now;
}

bool parseUnsigned(const char *&cursor, uint32_t &value) {
  if (*cursor < '0' || *cursor > '9') return false;
  value = 0;
  do {
    const uint8_t digit = *cursor - '0';
    if (value > (0xFFFFFFFFUL - digit) / 10UL) return false;
    value = value * 10UL + digit;
    ++cursor;
  } while (*cursor >= '0' && *cursor <= '9');
  return true;
}

void acceptCommand(const char *line, uint32_t now) {
  const char prefix[] = "EXPERIENCE ";
  const char *cursor = line;
  for (uint8_t i = 0; prefix[i] != '\0'; ++i) {
    if (*cursor++ != prefix[i]) return;
  }
  uint32_t id, brightness, fault;
  if (!parseUnsigned(cursor, id) || *cursor++ != ' ' ||
      !parseUnsigned(cursor, brightness) || *cursor++ != ' ' ||
      !parseUnsigned(cursor, fault)) return;
  // Permit one CR before LF, but no extra tokens, signs or whitespace.
  if (*cursor == '\r') ++cursor;
  if (*cursor != '\0' || brightness > 255 || fault > 1) return;
  commandAck = id;
  ledBrightness = static_cast<uint8_t>(brightness);
  faultActive = fault == 1;
  lastCommandAt = now;
  watchdogOff = false;
  applyPurpleOutput(ledBrightness);
  emitFrame(now); // Immediate ACK allows <=10 Hz without a command backlog.
}

void setup() {
  // Initialize the inactive level before making the example pin an output.
  digitalWrite(PURPLE_PWM_PIN, PWM_ACTIVE_LOW ? HIGH : LOW);
  pinMode(PURPLE_PWM_PIN, OUTPUT);
  applyPurpleOutput(0);
  Serial.begin(115200);
  emitFrame(millis()); // Passive HELLO; the browser must verify this before writing.
}

void loop() {
  // Bound work each pass so continuous incoming data cannot starve the watchdog.
  uint8_t consumed = 0;
  while (Serial.available() > 0 && consumed++ < 64) {
    const char incoming = static_cast<char>(Serial.read());
    if (incoming == '\n') {
      if (!discardLine) {
        commandLine[commandLength] = '\0';
        acceptCommand(commandLine, millis());
      }
      commandLength = 0;
      discardLine = false;
    } else if (!discardLine) {
      if (commandLength >= MAX_COMMAND_LENGTH || incoming == '\0') {
        commandLength = 0;
        discardLine = true; // Never execute a suffix of an overlong command.
      } else {
        commandLine[commandLength++] = incoming;
      }
    }
  }
  const uint32_t now = millis();
  if (!watchdogOff && static_cast<uint32_t>(now - lastCommandAt) >= COMMAND_TIMEOUT_MS) {
    ledBrightness = 0;
    faultActive = false;
    watchdogOff = true;
    applyPurpleOutput(0);
    emitFrame(now);
  }
  if (static_cast<uint32_t>(now - lastFrameAt) >= FRAME_INTERVAL_MS) emitFrame(now);
}
