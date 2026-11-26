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
  const govde = {
    snippet: {
      title: `${bilgi.baslik.replace(/[<>]/g, "")} #shorts`.slice(0, 100),
      description: `Clip from twitch.tv/${yayinci}\n${bilgi.klipUrl}\n\n#shorts #${yayinci.replace(/_/g, "")} #twitch`,
      categoryId: "20",
    },
    status: { privacyStatus: process.env.YT_GIZLILIK || "private", selfDeclaredMadeForKids: false },
  };
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
  console.log(`::notice title=youtube::yüklendi (${s.status.privacyStatus}) https://youtu.be/${s.id}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
