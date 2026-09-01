"use strict";

const https = require("https");
const http  = require("http");
const fs    = require("fs");

const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base, spread = 0.35) =>
  Math.floor(base + (Math.random() - 0.5) * 2 * base * spread);

const downloadFile = (url, dest) =>
  new Promise((resolve, reject) => {
    const mod  = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    mod
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return downloadFile(res.headers.location, dest)
            .then(resolve)
            .catch(reject);
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve(dest);
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });

module.exports = { sleep, jitter, downloadFile };
