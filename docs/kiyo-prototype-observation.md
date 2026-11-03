# Kiyo-inspired teaching model observation

The existing “실시간 자유 분석” entry still opens `/live`. The destination now observes a classroom model through optional USB serial input or an explicitly selected demonstration. Scenario-training routes and account storage remain separate.

## What is connected

- An Arduino Uno-compatible teaching model reports its fault-button input and LED command state.
- Pressure, gas flow, RF power and temperature are educational process illustrations calculated from that input. They are not measurements of either the model or a production Kiyo tool.
- The default state is disconnected. Selecting demonstration mode is explicit. Lost or late USB input never silently switches to a demonstration.
- Current values are hidden after two seconds without an accepted frame. Previously received chart points are labeled as historical input.
- Reset uses `RESET <request-id>` and waits for the matching `resetAck`, normal input, and completion of the write. Writing and acknowledgment share a three-second deadline.

## Hardware setup

See [firmware/README.md](../firmware/README.md) for the Uno sketch, wiring assumptions, serial speed and exact input protocol. The sketch is supplied as source; neither compilation for a physical board nor an actual USB board test has been performed in this environment.

## Appearance reference

- Manufacturer product information: https://www.lamresearch.com/product/kiyo-product-family/
- Exterior reference with a verified model name, LAM Research 2300v2 KIYO EX Poly: https://www.macquarie.com/au/en/about/company/commodities-and-global-markets/specialised-and-asset-finance/electronics/inventory/semiconductor-fabrication/polysilicon-etch/67445.html

The independently drawn diagram uses three front load ports, a left-side operator panel and a stack light as exterior cues. Rear module positions and the observation window are teaching-model design choices, not a reconstruction of the original internal layout. Reference photographs are not redistributed.

## Validation

- TypeScript checking and the Vite production build pass.
- Related protocol, routing, product-direction and practice-entry tests: 56 pass. Protocol tests use mocked streams and timers, including incomplete/invalid frames, stale input, reset acknowledgment correlation and a stalled write.
- A local browser could not start in the execution environment. A browser interaction test script was prepared, but it did not reach the application and must not be reported as passing.
- Physical print fit, wiring and board operation remain to be checked with the actual school equipment.
