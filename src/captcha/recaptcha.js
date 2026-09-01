"use strict";

const { sleep, jitter }     = require("../utils");
const { solveAudioCaptcha } = require("./stt");

const solveRecaptchaV2Audio = async (page) => {
  console.log("[rcv2] Attempting audio solve...");
  try {
    const frames = page.frames();
    let anchorFrame    = null;
    let challengeFrame = null;

    for (const f of frames) {
      const u = f.url();
      if (u.includes("recaptcha") && u.includes("anchor"))  anchorFrame    = f;
      if (u.includes("recaptcha") && u.includes("bframe"))  challengeFrame = f;
    }

    if (anchorFrame) {
      await anchorFrame
        .waitForSelector("#recaptcha-anchor", { timeout: 8000 })
        .catch(() => {});
      await anchorFrame.click("#recaptcha-anchor").catch(() => {});
      await sleep(jitter(2000, 0.4));

      const frames2 = page.frames();
      for (const f of frames2) {
        if (f.url().includes("recaptcha") && f.url().includes("bframe"))
          challengeFrame = f;
      }
    }

    if (!challengeFrame) {
      console.log("[rcv2] No challenge frame");
      return null;
    }

    await sleep(jitter(1500, 0.3));
    await challengeFrame
      .waitForSelector("#recaptcha-audio-button", { timeout: 8000 })
      .catch(() => {});
    await challengeFrame
      .click("#recaptcha-audio-button")
      .catch(async () => {
        await challengeFrame.evaluate(() =>
          document.querySelector("#recaptcha-audio-button")?.click()
        );
      });

    await sleep(jitter(2200, 0.4));

    const blocked = await challengeFrame
      .evaluate(
        () =>
          document.querySelector(
            ".rc-doscaptcha-header-text, .rc-doscaptcha-body-text"
          )?.innerText ?? null
      )
      .catch(() => null);

    if (blocked?.toLowerCase().includes("try again")) {
      console.log("[rcv2] IP rate-limited");
      return null;
    }

    await challengeFrame
      .waitForSelector("#audio-source", { timeout: 10000 })
      .catch(() => {});

    const audioSrc = await challengeFrame
      .evaluate(
        () =>
          document.querySelector("#audio-source")?.src ||
          document.querySelector(".rc-audiochallenge-tdownload-link")?.href ||
          null
      )
      .catch(() => null);

    if (!audioSrc) {
      console.log("[rcv2] No audio URL");
      return null;
    }

    const answer = await solveAudioCaptcha(audioSrc);
    if (!answer) return null;

    console.log(`[rcv2] Typing: "${answer}"`);
    await challengeFrame
      .waitForSelector("#audio-response", { timeout: 5000 })
      .catch(() => {});
    await challengeFrame.click("#audio-response").catch(() => {});
    await sleep(400);

    for (const ch of answer) {
      await challengeFrame.type("#audio-response", ch, {
        delay: jitter(85, 0.5),
      });
    }

    await sleep(jitter(700, 0.4));
    await challengeFrame
      .click("#recaptcha-verify-button")
      .catch(() => {});
    await sleep(jitter(3500, 0.4));

    const token = await page
      .evaluate(() => {
        const ta = document.getElementById("g-recaptcha-response");
        return ta?.value?.length > 20 ? ta.value : null;
      })
      .catch(() => null);

    if (token) {
      console.log("[rcv2] Audio SUCCESS");
      return token;
    }
    return null;
  } catch (e) {
    console.error("[rcv2]", e.message);
    return null;
  }
};

module.exports = { solveRecaptchaV2Audio };
