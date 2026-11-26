// Akıcılık kontrolü: node akicilik.js cikti.mp4 temel.mp4
// Çıktıyı kare kare temel görüntüyle karşılaştırır (altyazısız bölgeler).
// Donan, atlayan ya da kayan kare varsa benzerlik düşer ve işlem hata verir.
const fs = require("fs");
const { execFileSync } = require("child_process");

const [cikti, temel] = process.argv.slice(2);
const sor = (d, alan) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-count_packets",
  "-show_entries", `stream=${alan}`, "-of", "csv=p=0", d]).toString().trim();

const hiz = sor(cikti, "r_frame_rate");
const n1 = Number(sor(cikti, "nb_read_packets"));
const n2 = Number(sor(temel, "nb_read_packets"));

const bolgeler = { yuz: "1080:600:0:230", oyun: "1080:800:0:1100" };
const sonuc = [];
let hata = hiz !== "60/1" || Math.abs(n1 - n2) > 1;
for (const [ad, k] of Object.entries(bolgeler)) {
  const kayit = `is/psnr-${ad}.txt`;
  execFileSync("ffmpeg", ["-v", "error", "-i", cikti, "-i", temel, "-filter_complex",
    `[0:v]crop=${k},format=gray[a];[1:v]crop=${k},format=gray[b];[a][b]psnr=stats_file=${kayit}`, "-an", "-f", "null", "-"]);
  const d = fs.readFileSync(kayit, "utf8").trim().split("\n").map((s) => {
    const v = s.match(/psnr_avg:(\S+)/)[1];
    return v === "inf" ? 99 : Number(v);
  });
  const sirali = [...d].sort((a, b) => a - b);
  const orta = sirali[Math.floor(d.length / 2)];
  const kotu = d.map((v, i) => [v, i]).filter(([v]) => v < 35); // sağlam render 45 dB civarı
  if (kotu.length) hata = true;
  sonuc.push(`${ad}: ortanca=${orta.toFixed(1)} en_dusuk=${sirali[0].toFixed(1)} bozuk_kare=${kotu.length}` +
    (kotu.length ? ` (ilk ${(kotu[0][1] / 60).toFixed(2)}. sn)` : ""));
}
const ozet = `fps=${hiz} kare=${n1}/${n2} | ${sonuc.join(" | ")}`;
console.log(process.env.GITHUB_ACTIONS ? `::notice title=akicilik::${ozet}` : ozet);
if (hata) { console.error("AKICILIK KONTROLU BASARISIZ"); process.exit(1); }
