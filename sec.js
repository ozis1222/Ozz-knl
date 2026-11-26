// Günün klibini seçer: node sec.js kanallar/cliporaa
// Eleme: kullanılmış, yasak kelime, süre, gerçek 60 fps. Sonuç: is/secilen.json + is/kaynak.mp4
// NOT: görüntüdeki uygunsuz içeriği bu eleme göremez.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { tekrarOrani } = require("./olc");
const { analizEt, kadraj } = require("./analiz");
const { dokumAl } = require("./dokum");
const not = (m) => console.log(process.env.GITHUB_ACTIONS ? `::notice title=secim::${m}` : m);

const klasor = process.argv[2];
const oku = (ad) => JSON.parse(fs.readFileSync(path.join(klasor, ad), "utf8"));
const k = oku("kanal.json");
const kullanilan = new Set(oku("kullanilan.json"));
const sade = (u) => u.split("?")[0];
const yasak = new RegExp(`\\b(${k.yasakKelimeler.join("|")})`, "i");

let adaylar = [];
for (const y of k.yayincilar) {
  try {
    const cikti = execFileSync("yt-dlp", ["--flat-playlist", "--playlist-end", "60", "--dump-json",
      `https://www.twitch.tv/${y}/clips?filter=clips&range=${k.gunAraligi}`], { maxBuffer: 1 << 26 }).toString();
    for (const satir of cikti.split("\n").filter(Boolean)) {
      const c = JSON.parse(satir);
      adaylar.push({ yayinci: y, url: sade(c.url || c.webpage_url), baslik: c.title || "", izlenme: c.view_count || 0, sure: c.duration || 0 });
    }
  } catch { console.log(`${y}: liste alınamadı`); }
}
const toplam = adaylar.length;
adaylar = adaylar
  .filter((c) => !kullanilan.has(c.url) && c.sure >= k.sureEnAz && c.sure <= k.sureEnCok && !yasak.test(c.baslik))
  .sort((a, b) => b.izlenme - a.izlenme);
console.log(`${toplam} klip, ${adaylar.length} aday`);

fs.mkdirSync("is", { recursive: true });
(async () => {
for (const c of adaylar.slice(0, k.denenecekAdaySayisi)) {
  try {
    execFileSync("yt-dlp", ["-q", "--no-progress", "--no-playlist", "--force-overwrites", "--retries", "3",
      "--extractor-retries", "3", "-f", "best[format_id!*=portrait]/best", "-o", "is/kaynak.mp4", c.url], { stdio: "inherit" });
  } catch { console.log(`atlandı  ${c.yayinci} "${c.baslik}" (indirilemedi)`); continue; }
  const oran = tekrarOrani("is/kaynak.mp4");
  if (oran > k.tekrarOraniEnCok) { console.log(`elendi  ${c.yayinci} "${c.baslik}" tekrar=${oran.toFixed(2)} (60 fps değil)`); continue; }
  const s = await analizEt("is/kaynak.mp4", c.yayinci, c.baslik);
  if (!s.safe || s.interesting < k.ilgiEnAz) { not(`elendi ${c.yayinci} "${c.baslik}": ${s.safe ? `ilgi ${s.interesting}/10` : s.reason}`); continue; }
  const bas = Math.max(0, Number(s.start) || 0);
  let bit = Math.min(c.sure, Number(s.end) || c.sure);
  if (bit - bas < 8) bit = c.sure;
  // Altyazı şart: seçilen bölümde yeterince konuşma yoksa sıradaki klibe geç
  const kelime = dokumAl("is/kaynak.mp4", "en").filter((w) => w.start >= bas && w.start < bit).length;
  const gereken = Math.max(k.kelimeEnAz, Math.round((bit - bas) * k.saniyedeKelimeEnAz));
  if (kelime < gereken) { not(`elendi ${c.yayinci} "${c.baslik}": konuşma az (${kelime}/${gereken} kelime)`); continue; }
  const tepki = Array.isArray(s.reaction) ? s.reaction.map((t) => t - bas) : null;
  const ayar = {
    klipUrl: c.url, dil: "en", baslangic: bas, bitis: bit, ...kadraj(s, s.has_captions),
    yakinlas: tepki && tepki[1] > tepki[0] ? [tepki] : [],
    etiket: `TWITCH.TV/${c.yayinci.toUpperCase()}`, baslik: String(s.title).slice(0, 60),
    youtube: { baslik: String(s.yt_title || s.title), aciklama: String(s.description || ""), etiketler: Array.isArray(s.hashtags) ? s.hashtags.map(String) : [] },
  };
  fs.writeFileSync("is/gunluk.json", JSON.stringify(ayar, null, 2));
  not(`secildi ${c.yayinci} "${c.baslik}" -> ${ayar.youtube.baslik} | yuz kamerasi: ${ayar.yuz ? "var" : "yok"}`);
  return;
}
console.log(`::error title=secim::Uygun klip bulunamadı (${Math.min(adaylar.length, k.denenecekAdaySayisi)} aday denendi)`);
process.exit(1);
})().catch((e) => { console.log(`::error title=secim::${e.message.replace(/\n/g, " ")}`); process.exit(1); });
