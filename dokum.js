// Konuşmayı yazıya döker ve verilen aralıktaki gerçek kelimeleri döndürür.
const fs = require("fs");
const { execFileSync, execSync } = require("child_process");

// [Music], (laughs), ♪ gibi işaretler konuşma sayılmaz
const konusmaMi = (t) => !/[\[\]()♪*_]/.test(t) && /[\p{L}\p{N}]/u.test(t);

function dokumAl(video, dil, klasor = "is") {
  fs.mkdirSync(klasor, { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", `${klasor}/kaynak.wav`], { stdio: "inherit" });
  fs.rmSync(`${klasor}/transcript.json`, { force: true });
  execSync(`npx -y hyperframes@0.9.35 transcribe ${klasor}/kaynak.wav --engine whisper --model small --language ${dil} --dir ${klasor}`, { stdio: "inherit" });
  return JSON.parse(fs.readFileSync(`${klasor}/transcript.json`, "utf8")).filter((w) => konusmaMi(w.text));
}

module.exports = { dokumAl, konusmaMi };