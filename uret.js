// Cliporaa dikey klip üretici: node uret.js ayar.json
// Çıktı: <ayar.proje>/index.html + assets/base.mp4 (sonra hyperframes render)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { konusmaMi } = require("./dokum");

const a = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const proje = a.proje;
fs.mkdirSync(path.join(proje, "assets"), { recursive: true });
const sure = a.bitis - a.baslangic;

// 1) Temel görüntü: üstte yüz (1080x700), altta oyun (1080x1000), en üstte başlık şeridi
const [fx, fy, fw, fh] = a.yuz || [0, 0, 0, 0];  // kaynak (1920x1080) üzerinde kamera kutusu
const [gx, gy, gw, gh] = a.oyun;  // kaynak üzerinde oyun kadrajı
const yakin = a.yakinlas.map(([s, e]) => `between(t,${s},${e})`).join("+") || "0";
const bolunmus = () => [
  `[0:v]split=3[v1][v2][v3]`,
  `[v1]crop=${fw}:${fh}:${fx}:${fy},scale=1080:700:flags=lanczos[yuz]`,
  `[v2]crop=${Math.round(fw * 0.78)}:${Math.round(fh * 0.78)}:${fx + Math.round(fw * 0.11)}:${fy + Math.round(fh * 0.08)},scale=1080:700:flags=lanczos[yakin]`,
  `[v3]crop=${gw}:${gh}:${gx}:${gy},scale=1080:1000[oyun]`,
  `color=c=0x0d0d12:s=1080x1920:r=60[bg]`,
  `[bg][yuz]overlay=0:220:shortest=1[a]`,
  `[a][yakin]overlay=0:220:enable='${yakin}'[b]`,
  `[b][oyun]overlay=0:920,format=yuv420p[v]`,
];
// yüz kamerası yoksa: tek görüntü, aksiyon ortada
const tekli = () => {
  const gen = Math.round(gh * 1080 / 1700);
  const x = Math.round(Math.min(1920 - gen, Math.max(0, gx + gw / 2 - gen / 2)));
  return [`color=c=0x0d0d12:s=1080x1920:r=60[bg]`, `[0:v]crop=${gen}:${gh}:${x}:0,scale=1080:1700:flags=lanczos[tam]`,
    `[bg][tam]overlay=0:220:shortest=1,format=yuv420p[v]`];
};
const filtre = (a.yuz ? bolunmus() : tekli()).join(";");
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(a.baslangic), "-t", String(sure), "-i", a.kaynak,
  "-filter_complex", filtre, "-map", "[v]", "-map", "0:a", "-r", "60", "-g", "60", "-c:v", "libx264", "-crf", "19",
  "-preset", "veryfast", "-af", "loudnorm=I=-14:TP=-1.5", "-ar", "48000", "-c:a", "aac", "-t", String(sure),
  path.join(proje, "assets", "base.mp4")], { stdio: "inherit" });

// 2) Altyazı grupları (en fazla 3 kelime, cümle sonunda böl)
const duzelt = a.duzelt || {};
const kelimeler = JSON.parse(fs.readFileSync(a.dokum, "utf8"))
  .filter((w) => konusmaMi(w.text) && w.start >= a.baslangic && w.start < a.bitis)
  .map((w) => ({ t: duzelt[w.id] ?? w.text, s: w.start - a.baslangic, e: Math.min(w.end, a.bitis) - a.baslangic }));
const gruplar = [];
let g = [];
for (const k of kelimeler) {
  g.push(k);
  if (g.length === 3 || /[.?!]$/.test(k.t)) { gruplar.push(g); g = []; }
}
if (g.length) gruplar.push(g);
if (!gruplar.length) { console.error("ALTYAZI YOK: video üretilmedi"); process.exit(1); }

const kacis = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const f = (n) => Number(n.toFixed(3));
let html = "", anim = "";
gruplar.forEach((gr, i) => {
  const bas = f(gr[0].s);
  const son = f(i + 1 < gruplar.length ? Math.min(gruplar[i + 1][0].s, gr.at(-1).e + 0.3) : Math.min(sure, gr.at(-1).e + 0.3));
  html += `      <div id="c${i}" class="clip cap" data-start="${bas}" data-duration="${f(son - bas)}" data-track-index="2"><div class="row" id="r${i}">` +
    gr.map((k, j) => `<span id="c${i}w${j}">${kacis(k.t)}</span>`).join(" ") + `</div></div>\n`;
  anim += `      tl.fromTo("#r${i}", { scale: 0.82 }, { scale: 1, duration: 0.12, ease: "back.out(2)" }, ${bas});\n`;
  gr.forEach((k, j) => {
    anim += `      tl.set("#c${i}w${j}", { color: "#ffe14d" }, ${f(k.s)});\n`;
    if (j + 1 < gr.length) anim += `      tl.set("#c${i}w${j}", { color: "#ffffff" }, ${f(gr[j + 1].s)});\n`;
  });
});

fs.writeFileSync(path.join(proje, "index.html"), `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #0d0d12; }
      #root { position: relative; width: 100%; height: 100%; font-family: "Montserrat", sans-serif; font-weight: 900; color: #fff; }
      video { position: absolute; inset: 0; width: 1080px; height: 1920px; }
      #title { position: absolute; left: 0; top: 0; width: 1080px; height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
      #title .who { font-size: 30px; letter-spacing: 4px; color: #b18cff; }
      #title .big { font-size: 56px; line-height: 1.1; }
      .cap { position: absolute; left: 0; top: 850px; width: 1080px; height: 160px; display: flex; align-items: center; justify-content: center; }
      .row { font-size: 68px; text-transform: uppercase; white-space: nowrap; -webkit-text-stroke: 14px #000; paint-order: stroke fill; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${f(sure)}" data-width="1080" data-height="1920">
      <video id="base" class="clip" src="assets/base.mp4" data-start="0" data-duration="${f(sure)}" data-track-index="0" data-has-audio="true" playsinline></video>
      <div id="title" class="clip" data-start="0" data-duration="${f(sure)}" data-track-index="1">
        <div class="who">${kacis(a.etiket)}</div>
        <div class="big">${kacis(a.baslik)}</div>
      </div>
${html}    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${anim}      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`);
console.log(`${gruplar.length} altyazı grubu, ${f(sure)} sn`);
