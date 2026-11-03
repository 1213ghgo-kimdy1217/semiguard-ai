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

The independently drawn exterior model uses three front load ports, a left-side operator panel and a stack light as exterior cues. The three front doors are wafer-carrier interfaces, not three etch-chamber doors. Its side/rear proportions are simplified and do not establish the layout of actual Kiyo process modules.

A transparent teaching chamber is placed inside the model cabinet, visible through a right-side observation window. This is one integrated tabletop model. The window and internal placement are educational design choices, not verified features or positions of the production Kiyo tool. The removable rear panel provides access to the classroom model.

The teaching chamber illustrates public dry-etch concepts. Its dimensions, material and layout do not reproduce Kiyo internals or operating specifications. The physical model uses a transparent shell/removable lid for observation. The website's interior drawing makes the educational concepts easier to understand.

General dry-etch concepts: https://newsroom.lamresearch.com/etch-essentials-semiconductor-manufacturing

Exterior and educational-interior tabs show the same integrated model with different visibility and descriptions. Exterior decorations are static; the teaching chamber's LED command is labeled separately from simulated process values. Reference photographs are linked for attribution, not redistributed.

## Review access

`/model-preview.html` is a separate review entry generated only for a Vercel preview build, or a local `model-preview` mode when `VERCEL_ENV` is unset. A production build excludes this HTML entry, including when the local review mode is selected with `VERCEL_ENV=production`.

The review entry mounts only the model dashboard without account providers or account queries. The regular application `/live` route retains `PracticeAccess`. Preview deployment protection is kept; a time-limited Vercel share link lets the requester review this isolated screen without the Vercel or application sign-in flows. Access links and cookies are not stored in source files.

## Validation

- TypeScript checking and the Vite production build pass.
- Related protocol, routing, product-direction and practice-entry tests: 56 pass. Protocol tests use mocked streams and timers, including incomplete/invalid frames, stale input, reset acknowledgment correlation and a stalled write.
- A local browser could not start in the execution environment. A browser interaction test script was prepared, but it did not reach the application and must not be reported as passing.
- Physical print fit, wiring and board operation remain to be checked with the actual school equipment.
