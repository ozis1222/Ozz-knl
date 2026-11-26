// Klibin gerçek kare hızını ölçer: 0'a yakın = gerçek 60 fps, 0.5 ve üstü = 30 fps ve altı.
const fs = require("fs");
const { execFileSync } = require("child_process");

function tekrarOrani(dosya, kirp) {
  fs.mkdirSync("is", { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", dosya, "-an", "-vf",
    `${kirp ? `crop=${kirp},` : ""}scale=320:-2,signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=is/ydif.txt`, "-f", "null", "-"]);
  const d = [...fs.readFileSync("is/ydif.txt", "utf8").matchAll(/YDIF=([\d.]+)/g)].map((m) => Number(m[1]));
  let tekrar = 0, hareketli = 0;
  for (let i = 1; i < d.length - 1; i++) {
    const komsu = Math.max(d[i - 1], d[i + 1]);
    if (komsu < 0.5) continue;
    hareketli++;
    if (d[i] < komsu * 0.25) tekrar++;
  }
  // hiç hareket yoksa durağan klip: uygun sayma
  return hareketli < d.length * 0.4 ? 1 : tekrar / hareketli;
}

module.exports = { tekrarOrani };
if (require.main === module) console.log(tekrarOrani(process.argv[2], process.argv[3]).toFixed(2));
