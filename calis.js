// Uçtan uca: klibi indir, yazıya dök, dikey videoyu üret.
// Kullanım: node calis.js kanallar/cliporaa/deneme.json
const fs = require("fs");
const { execFileSync, execSync } = require("child_process");

const ayar = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const HF = "npx -y hyperframes@0.9.35";
const sureler = [];
function adim(ad, fn) {
  const t = Date.now();
  console.log(`\n=== ${ad}`);
  fn();
  sureler.push(`${ad}: ${Math.round((Date.now() - t) / 1000)} sn`);
}
const kabuk = (k) => execSync(k, { stdio: "inherit" });

fs.mkdirSync("is", { recursive: true });
fs.mkdirSync("cikti", { recursive: true });

adim("indirme", () => execFileSync("yt-dlp",
  ["--no-playlist", "--force-overwrites", "-f", "best[format_id!*=portrait]/best", "-o", "is/kaynak.mp4", ayar.klipUrl],
  { stdio: "inherit" }));

adim("yaziya dokme", () => {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", "is/kaynak.mp4", "-vn", "-ac", "1", "-ar", "16000", "is/kaynak.wav"], { stdio: "inherit" });
  kabuk(`${HF} transcribe is/kaynak.wav --engine whisper --model small --language ${ayar.dil} --dir is`);
});

adim("kurgu", () => {
  fs.writeFileSync("is/ayar.json", JSON.stringify({ ...ayar, kaynak: "is/kaynak.mp4", dokum: "is/transcript.json", proje: "is/klip" }));
  execFileSync("node", ["uret.js", "is/ayar.json"], { stdio: "inherit" });
});

adim("render", () => kabuk(`${HF} render is/klip --fps 60 --output cikti/video.mp4 --quiet`));

adim("akicilik kontrolu", () => execFileSync("node", ["akicilik.js", "cikti/video.mp4", "is/klip/assets/base.mp4"], { stdio: "inherit" }));

console.log("\n" + sureler.join("\n"));
