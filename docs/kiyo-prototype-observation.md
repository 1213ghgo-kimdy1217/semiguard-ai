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

## Interior focus and live camera

The teaching-interior view rotates toward the observation window and zooms in on the chamber. Reduced-motion preferences use the final view without animated movement. In an explicitly selected model-free demonstration, four educational callouts explain chamber pressure (the gas-filled chamber volume), gas flow (the inlet path), RF power (energy supplied for plasma generation), and chamber ambient temperature (around the outside of the vessel, not the wafer temperature). Values come from the existing teaching simulation, not from the drawn locations or a camera measurement.

The Current state view is available only while valid USB model telemetry is fresh. Its camera panel uses a separate video-only browser media stream after an explicit Camera on action. Users can select the video device; leaving the camera tab, changing input mode, losing fresh USB telemetry, or closing the page stops the stream. Video is displayed locally without microphone capture, recording, image analysis, or server upload.

The supplied product link identifies an ABKO APC850 FHD USB webcam. Manufacturer information describes USB operation and fixed focus: https://www.abko.co.kr/bbs/board.php?bo_table=news&wr_id=181 . Recognition by the actual school PC, camera permission, focus distance and image quality remain to be verified with the physical camera. The product description does not establish browser compatibility or a guaranteed close-focus distance.

The model controller uses Web Serial; the webcam uses the browser MediaDevices API. They are separate USB devices connected to the PC, not a webcam connected to an Arduino serial port. Camera images do not measure pressure, flow, RF power or temperature. API references: https://w3c.github.io/mediacapture-main/ and https://developer.chrome.com/docs/capabilities/serial .

## Review access

`/model-preview.html` is a separate review entry generated only for a Vercel preview build, or a local `model-preview` mode when `VERCEL_ENV` is unset. A production build excludes this HTML entry, including when the local review mode is selected with `VERCEL_ENV=production`.

The review entry mounts only the model dashboard without account providers or account queries. The regular application `/live` route retains `PracticeAccess`. Preview deployment protection is kept; a time-limited Vercel share link lets the requester review this isolated screen without the Vercel or application sign-in flows. Access links and cookies are not stored in source files.

## Validation

- TypeScript checking and the Vite production build pass.
- Related protocol, routing, product-direction, practice-entry and camera tests: 80 pass. Protocol tests use mocked streams and timers; 24 camera lifecycle cases use mocked media devices and video events, including permission delays, cancellation before passive cleanup, device changes, late streams, ended tracks, metadata and playback state.
- Chromium browser checks: 15 pass with generated Canvas video and mocked serial telemetry, without opening a physical camera or microphone. Checks cover animated yaw/zoom, four demonstration callouts, reduced motion, 320/390 px demonstration layouts, explicit camera start, selected-device video-only constraints, actual generated-video playback and cleanup on tab exit, stop, stale input, disconnect, page hiding and permission denial. Real APC850 device recognition, browser permission UI and close-focus quality remain untested.
- Physical print fit, wiring and board operation remain to be checked with the actual school equipment.
