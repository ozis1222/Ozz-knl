// Bir YouTube kanalı için kalıcı yükleme izni alır (yalnız kendi bilgisayarında çalıştır).
// Kullanım: node yetki.js <google-istemci.json> <kanal-adi>
// Sonuç depo DIŞINA yazılır: ../gizli/<kanal-adi>.json (GitHub Secrets'a sen eklersin)
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { execFile } = require("child_process");

const [istemciDosyasi, kanal] = process.argv.slice(2);
if (!istemciDosyasi || !/^[a-z0-9-]+$/.test(kanal || "")) {
  console.error("Kullanım: node yetki.js <google-istemci.json> <kanal-adi>");
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(istemciDosyasi, "utf8"));
const { client_id, client_secret } = j.installed || j.web;
const durum = crypto.randomBytes(16).toString("hex");
const dogrulayici = crypto.randomBytes(48).toString("base64url");
let donus;

const sunucu = http.createServer(async (istek, cevap) => {
  const u = new URL(istek.url, donus);
  if (u.searchParams.get("state") !== durum) { cevap.writeHead(404); return cevap.end(); }
  const bitir = (mesaj, kod) => {
    cevap.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    cevap.end(mesaj);
    console.log(mesaj);
    sunucu.close();
    process.exitCode = kod;
  };
  try {
    if (u.searchParams.get("error")) return bitir("İzin verilmedi.", 1);
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ code: u.searchParams.get("code"), client_id, client_secret,
        redirect_uri: donus, grant_type: "authorization_code", code_verifier: dogrulayici }),
    });
    const t = await r.json();
    if (!t.refresh_token) return bitir(`Alınamadı: ${t.error || r.status}`, 1);
    const klasor = path.join(__dirname, "..", "gizli");
    fs.mkdirSync(klasor, { recursive: true });
    fs.writeFileSync(path.join(klasor, `${kanal}.json`),
      JSON.stringify({ client_id, client_secret, refresh_token: t.refresh_token }));
    bitir(`Tamam. Kaydedildi: gizli/${kanal}.json — bu sekmeyi kapatabilirsin.`, 0);
  } catch (e) {
    bitir(`Hata: ${e.message}`, 1);
  }
});

sunucu.listen(0, "127.0.0.1", () => {
  donus = `http://127.0.0.1:${sunucu.address().port}`;
  const adres = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id, redirect_uri: donus, response_type: "code", state: durum,
    scope: "https://www.googleapis.com/auth/youtube.upload",
    access_type: "offline", prompt: "consent select_account",
    code_challenge: crypto.createHash("sha256").update(dogrulayici).digest("base64url"),
    code_challenge_method: "S256",
  });
  console.log("Tarayıcıda açılmazsa bu adresi kendin aç:\n" + adres);
  execFile("rundll32", ["url.dll,FileProtocolHandler", adres]);
});
