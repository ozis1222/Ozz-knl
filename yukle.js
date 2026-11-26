// Videoyu YouTube'a yükler ve klibi "kullanıldı" listesine ekler.
// Kullanım: node yukle.js kanallar/cliporaa   (YT_YETKI ortam değişkeni: yetki.js'in kaydettiği JSON)
// Gizlilik: YT_GIZLILIK = private (varsayılan) | unlisted | public
const fs = require("fs");
const path = require("path");

(async () => {
  const klasor = process.argv[2];
  if (!process.env.YT_YETKI) throw new Error("YT_YETKI tanımlı değil");
  const y = JSON.parse(process.env.YT_YETKI);
  const bilgi = JSON.parse(fs.readFileSync("is/gunluk.json", "utf8"));
  const video = fs.readFileSync("cikti/video.mp4");

  const t = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: y.client_id, client_secret: y.client_secret,
      refresh_token: y.refresh_token, grant_type: "refresh_token" }),
  })).json();
  if (!t.access_token) throw new Error(`Yetki yenilenemedi: ${t.error}`);

  const yayinci = bilgi.etiket.split("/")[1].toLowerCase();
  // Gemini'nin yazdığı metinler: bağlantı ve < > temizlenir
  const m = bilgi.youtube || {};
  const temiz = (s) => String(s || "").replace(/https?:\/\/\S+|[<>]/g, "").trim();
  const etiketler = [...new Set(["shorts", yayinci.replace(/_/g, ""), ...(m.etiketler || [])]
    .map((e) => e.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean))].slice(0, 6);
  const ana = temiz(m.baslik || bilgi.baslik).replace(/#\S+/g, "").trim();
  const govde = {
    snippet: {
      title: `${Array.from(ana).slice(0, 80).join("")} #shorts`,
      description: `${temiz(m.aciklama)}\n\nClip from twitch.tv/${yayinci}\n${bilgi.klipUrl}\n\n${etiketler.map((e) => `#${e}`).join(" ")}`.trim(),
      tags: etiketler,
      categoryId: "20",
    },
    status: { privacyStatus: process.env.YT_GIZLILIK || "private", selfDeclaredMadeForKids: false },
  };
  // Belirlenen saat henüz gelmediyse YouTube o saatte kendisi yayınlar
  if (process.env.YT_YAYIN_UTC) {
    const an = new Date(`${new Date().toISOString().slice(0, 10)}T${process.env.YT_YAYIN_UTC}:00Z`);
    if (an - Date.now() > 5 * 60000) {
      govde.status.privacyStatus = "private";
      govde.status.publishAt = an.toISOString();
    }
  }
  const bas = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { authorization: `Bearer ${t.access_token}`, "content-type": "application/json",
      "x-upload-content-type": "video/mp4", "x-upload-content-length": String(video.length) },
    body: JSON.stringify(govde),
  });
  if (!bas.ok) throw new Error(`Yükleme başlatılamadı: ${bas.status} ${await bas.text()}`);
  const son = await fetch(bas.headers.get("location"), { method: "PUT", headers: { "content-type": "video/mp4" }, body: video });
  const s = await son.json();
  if (!son.ok) throw new Error(`Yükleme hatası: ${son.status} ${s.error?.message}`);

  const liste = path.join(klasor, "kullanilan.json");
  const kullanilan = JSON.parse(fs.readFileSync(liste, "utf8"));
  fs.writeFileSync(liste, JSON.stringify([...kullanilan, bilgi.klipUrl], null, 2) + "\n");
  console.log(`::notice title=youtube::yüklendi (${s.status.privacyStatus}${s.status.publishAt ? `, yayın ${s.status.publishAt}` : ""}) https://youtu.be/${s.id}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
