"use strict";

const https = require("https");
const fs    = require("fs");
const os    = require("os");
const path  = require("path");

const { downloadFile } = require("../utils");

const transcribeGoogleFreeSTT = (wavPath) =>
  new Promise((resolve) => {
    try {
      const wavData = fs.readFileSync(wavPath);
      const req = https.request(
        {
          hostname: "www.google.com",
          path: "/speech-api/v2/recognize?output=json&lang=en-US&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw",
          method: "POST",
          headers: {
            "Content-Type": "audio/l16; rate=16000",
            "Content-Length": wavData.length,
            "User-Agent": "Mozilla/5.0",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (d) => (data += d));
          res.on("end", () => {
            try {
              for (const line of data
                .trim()
                .split("\n")
                .filter(Boolean)) {
                const parsed = JSON.parse(line);
                const transcript =
                  parsed?.result?.[0]?.alternative?.[0]?.transcript;
                if (transcript) {
                  const digits = transcript.replace(/[^0-9]/g, "");
                  if (digits) return resolve(digits);
                }
              }
              resolve(null);
            } catch {
              resolve(null);
            }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.write(wavData);
      req.end();
    } catch {
      resolve(null);
    }
  });

const solveAudioCaptcha = async (audioUrl) => {
  const tmp  = os.tmpdir();
  const dest = path.join(tmp, `rc_${Date.now()}.wav`);
  try {
    await downloadFile(audioUrl, dest);
    const result = await transcribeGoogleFreeSTT(dest);
    if (result) console.log(`[audio] STT: "${result}"`);
    return result;
  } catch (e) {
    console.error("[audio]", e.message);
    return null;
  } finally {
    try {
      fs.unlinkSync(dest);
    } catch {}
  }
};

module.exports = { solveAudioCaptcha };
