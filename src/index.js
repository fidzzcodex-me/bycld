"use strict";

const { connect }                          = require("puppeteer-real-browser");
const { sleep }                            = require("./utils");
const { interceptNetworkTokens, injectDOMHarvester } = require("./harvester");
const { deepDetect, collectTokens }        = require("./detector");
const { solveRecaptchaV2Audio }            = require("./captcha/recaptcha");

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-blink-features=AutomationControlled",
  "--window-size=1280,800",
  "--start-maximized",
  "--disable-infobars",
  "--disable-notifications",
  "--no-first-run",
  "--lang=en-US",
];

const BLOCKING_TITLES = [
  "Just a moment",
  "Attention Required",
  "Security Check",
  "Checking your browser",
];

const bypass = async (targetUrl, opts = {}) => {
  const { headless = false, timeout = 60000 } = opts;
  const networkStore = {};

  const { page, browser } = await connect({
    headless,
    turnstile: true,
    tf:        true,
    fingerprint: true,
    connectOption: { defaultViewport: null },
    args: BROWSER_ARGS,
  });

  try {
    interceptNetworkTokens(page, networkStore);
    await injectDOMHarvester(page);

    await page
      .goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35000 })
      .catch(() => {});

    await page
      .waitForFunction(
        (blockingTitles) => {
          const tok  = window.__tokens__ || {};
          const titl = document.title;
          const gRes  = document.querySelector('[name="g-recaptcha-response"]');
          const hRes  = document.querySelector('[name="h-captcha-response"]');
          const cfRes = document.querySelector('[name="cf-turnstile-response"]');
          return (
            (gRes?.value?.length > 0) ||
            (hRes?.value?.length > 0) ||
            (cfRes?.value?.length > 0) ||
            tok.recaptchaV2 || tok.recaptchaV3 ||
            tok.hcaptcha    || tok.turnstile    ||
            !blockingTitles.some((t) => titl.includes(t))
          );
        },
        { timeout },
        BLOCKING_TITLES
      )
      .catch(() => console.log("[!] Timeout — continuing"));

    await sleep(3000);

    const detection = await deepDetect(page);
    console.log("[*] Detection:", JSON.stringify(detection, null, 2));

    if (detection?.recaptcha?.sitekey && !detection.recaptcha.v3) {
      const hasToken = await page
        .evaluate(
          () =>
            (document.getElementById("g-recaptcha-response")?.value?.length ?? 0) > 20
        )
        .catch(() => false);

      if (!hasToken) {
        console.log("[*] reCAPTCHA v2 — attempting audio solve...");
        await solveRecaptchaV2Audio(page);
      }
    }

    await sleep(2000);

    const tokens      = await collectTokens(page, networkStore);
    const title       = await page.title();
    const cookies     = await page.cookies().catch(() => []);
    const cfClearance = cookies.find((c) => c.name === "cf_clearance");

    const bypassed =
      Boolean(cfClearance) ||
      Object.values(tokens).some((v) => v?.length > 20) ||
      !BLOCKING_TITLES.some((t) => title.includes(t));

    return {
      bypassed,
      title,
      cfClearance: cfClearance?.value ?? null,
      tokens,
      cookies,
      detection,
      page,
      browser,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
};

module.exports = { bypass };
