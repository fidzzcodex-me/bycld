# bycld

Captcha bypass and token harvester. Detects and solves reCAPTCHA v2 (audio), hCaptcha, and Cloudflare Turnstile. Harvests tokens from network traffic, DOM mutations, and XHR/fetch intercepts.

## Install

```bash
npm install bycld
```

Chromium is bundled in the Docker image. No separate install needed when running via Docker.

## Module usage

```js
const { bypass } = require("bycld");

const result = await bypass("https://example.com/login");

console.log(result.bypassed);    // true | false
console.log(result.tokens);      // { recaptchaV2, recaptchaV3, hcaptcha, turnstile }
console.log(result.cfClearance); // cf_clearance cookie value or null
console.log(result.cookies);     // full cookie array

await result.browser.close();
```

## CLI

```bash
npx bycld https://example.com/login
```

## Docker

```bash
docker pull ghcr.io/fidzzcodex-me/bycld:latest
docker run --rm ghcr.io/fidzzcodex-me/bycld:latest https://example.com/login
```

## Structure

```
bycld/
├── src/
│   ├── index.js          # bypass() — main exported API
│   ├── cli.js            # CLI entry point
│   ├── harvester.js      # network interceptor + DOM harvester injection
│   ├── detector.js       # deepDetect + collectTokens
│   ├── utils.js          # sleep / jitter / downloadFile
│   └── captcha/
│       ├── recaptcha.js  # reCAPTCHA v2 audio solver
│       └── stt.js        # Google free STT transcription
├── Dockerfile
└── .github/
    └── workflows/
        └── docker.yml
```
