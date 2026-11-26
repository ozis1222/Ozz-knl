"""is/plan.json -> cikti/video.mp4 (1080x1920): hizlandirilmis adimlar, altyazi, Ingilizce seslendirme, doga sesi."""
import asyncio, json, os, subprocess
import edge_tts
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FPS, RATE = 30, "+6%"
# her tekrar kullanimda sirayla degisen kurgu: ses, altyazi rengi, altyazi yuksekligi, renk ayari
STILLER = [("en-US-AndrewNeural", "white", 1300, "contrast=1.05:saturation=1.12"),
           ("en-US-BrianNeural", "#ffe14d", 1200, "contrast=1.08:saturation=1.22:gamma_r=1.04"),
           ("en-US-GuyNeural", "#9ff0ff", 1380, "contrast=1.10:saturation=1.0:gamma_b=1.05")]
FONT, HANDLE = "is/Montserrat.ttf", "@BushcraftHakankarahan"


def calistir(*a):
    subprocess.run(a, check=True)


def sure(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]))


def font(size, var="ExtraBold"):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(var)
    return f


def altyazi(txt, path, renk, y):
    im = Image.new("RGBA", (1080, 1920))
    d, size = ImageDraw.Draw(im), 60
    while d.textlength(txt, font=font(size)) > 960:
        size -= 2
    f = font(size)
    x = (1080 - d.textlength(txt, font=f)) / 2
    golge = Image.new("RGBA", im.size)
    ImageDraw.Draw(golge).text((x + 3, y + 5), txt, font=f, fill=(0, 0, 0, 230), stroke_width=5, stroke_fill=(0, 0, 0, 230))
    im.alpha_composite(golge.filter(ImageFilter.GaussianBlur(6)))
    ImageDraw.Draw(im).text((x, y), txt, font=f, fill=renk, stroke_width=2, stroke_fill=(30, 30, 30))
    im.save(path)


def hap(path):
    """Ustteki sabit YouTube etiketi."""
    S = 3
    im = Image.new("RGBA", (1080 * S, 1920 * S))
    d, f = ImageDraw.Draw(im), font(50 * S, "Bold")
    lw, lh, gap, pad, ph, y0 = 84 * S, 60 * S, 22 * S, 26 * S, 92 * S, 205 * S
    pw = pad * 2 + lw + gap + d.textlength(HANDLE, font=f)
    x0 = (1080 * S - pw) / 2
    d.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), radius=ph / 2, fill=(40, 40, 40, 175))
    lx, ly = x0 + pad, y0 + (ph - lh) / 2
    d.rounded_rectangle((lx, ly, lx + lw, ly + lh), radius=16 * S, fill=(255, 0, 0))
    cx, cy = lx + lw / 2 + 3 * S, ly + lh / 2
    d.polygon([(cx - 12 * S, cy - 16 * S), (cx - 12 * S, cy + 16 * S), (cx + 16 * S, cy)], fill="white")
    bb = d.textbbox((0, 0), HANDLE, font=f)
    d.text((lx + lw + gap, y0 + ph / 2 - (bb[1] + bb[3]) / 2), HANDLE, font=f, fill="white")
    im.resize((1080, 1920), Image.LANCZOS).save(path)


async def seslendir(text, path, ses):
    for deneme in range(6):
        try:
            await edge_tts.Communicate(text, ses, rate=RATE).save(path)
            return
        except Exception as e:
            print(f"tts tekrar {deneme + 1}: {type(e).__name__}")
            await asyncio.sleep(3 + deneme * 3)
    raise RuntimeError("seslendirme basarisiz")


def indir(url, a, b, path):
    calistir("yt-dlp", "-q", "--no-warnings", "--force-overwrites", "-f", "bv*[height<=1080]+ba/b",
             "--download-sections", f"*{a}-{b}", "--force-keyframes-at-cuts", "--merge-output-format", "mp4", "-o", path, url)


def main():
    P = json.load(open("is/plan.json"))
    kid = next(k["id"] for k in json.loads(os.environ["KAYNAKLAR"]) if k["ad"] == P["ad"])
    url = f"https://drive.google.com/file/d/{kid}/view"
    os.makedirs("cikti", exist_ok=True)
    hap("is/hap.png")
    ses, renk, yazi_y, renk_ayari = STILLER[P.get("stil", 0)]
    parcalar, yazilar, sesler, t = [], [], [], 0.0
    for i, s in enumerate(P["steps"]):
        mp3 = f"is/vo_{i}.mp3"
        asyncio.run(seslendir(s["vo"], mp3, ses))
        vd = sure(mp3)
        # adim suresi seslendirmeye gore; fazla kaynak 1-4 kat hizlandirilir, kalani kirpilir
        hedef = vd + 0.45
        kaynak = sum(x["end"] - x["start"] for x in s["pieces"])
        hiz = min(4.0, max(1.0, kaynak / hedef))
        kalan, t0 = hedef, t
        for j, x in enumerate(s["pieces"]):
            if kalan < 0.3:
                break
            uzun = min(x["end"] - x["start"], kalan * hiz)
            ham, seg = f"is/ham_{i}_{j}.mp4", f"is/seg_{i}_{j}.mp4"
            indir(url, x["start"], x["start"] + uzun, ham)
            cx = min(1.0, max(0.0, float(x.get("cx", 0.5))))
            calistir("ffmpeg", "-v", "error", "-y", "-i", ham, "-an", "-vf",
                     f"crop=ih*9/16:ih:(iw-ih*9/16)*{cx}:0,scale=1080:1920:flags=lanczos,setpts=(PTS-STARTPTS)/{hiz},"
                     f"fps={FPS},eq={renk_ayari},unsharp=5:5:0.6",
                     "-t", f"{uzun / hiz:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", seg)
            d = sure(seg)
            parcalar.append(seg)
            t += d
            kalan -= d
        if t - t0 < vd:
            print(f"UYARI: adim {i} seslendirmeden kisa")
        st = max(t0 + 0.12, sesler[-1][1] + sesler[-1][2] + 0.1 if sesler else 0)
        sesler.append((mp3, st, vd))
        altyazi(s["caption"], f"is/yazi_{i}.png", renk, yazi_y)
        yazilar.append((f"is/yazi_{i}.png", t0, t))
    toplam = max(t, sesler[-1][1] + sesler[-1][2] + 0.3)
    open("is/liste.txt", "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in parcalar))
    calistir("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "is/liste.txt", "-c", "copy", "is/base.mp4")
    a0, a1 = P["ambient"]
    indir(url, a0, a1, "is/ortam.mp4")
    calistir("ffmpeg", "-v", "error", "-y", "-i", "is/ortam.mp4", "-vn", "-ac", "2", "-ar", "48000", "is/ortam.wav")

    girdi = ["-i", "is/base.mp4", "-loop", "1", "-i", "is/hap.png"]
    for png, *_ in yazilar:
        girdi += ["-loop", "1", "-i", png]
    for mp3, *_ in sesler:
        girdi += ["-i", mp3]
    girdi += ["-stream_loop", "-1", "-i", "is/ortam.wav"]
    fc = "[0:v]tpad=stop_mode=clone:stop_duration=3[b];[b][1:v]overlay=0:0[v0];"
    for k, (_, a, b) in enumerate(yazilar):
        son = toplam if k == len(yazilar) - 1 else b - 0.001
        fc += f"[v{k}][{k + 2}:v]overlay=0:0:enable='between(t,{a:.3f},{son:.3f})'[v{k + 1}];"
    n = 2 + len(yazilar)
    for k, (_, st, _) in enumerate(sesler):
        fc += f"[{n + k}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.55,adelay={int(st * 1000)}|{int(st * 1000)}[s{k}];"
    fc += "".join(f"[s{k}]" for k in range(len(sesler)))
    fc += f"amix=inputs={len(sesler)}:normalize=0:duration=longest,apad=whole_dur={toplam + 0.5:.3f},asplit=2[vok][vsc];"
    fc += (f"[{n + len(sesler)}:a]highpass=f=60,dynaudnorm=f=500:g=15:m=6,volume=0.45,afade=t=in:d=0.3[doga];"
           "[doga][vsc]sidechaincompress=threshold=0.06:ratio=2.5:attack=30:release=400[kis];"
           f"[kis][vok]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.2,afade=t=out:st={toplam - 0.25:.3f}:d=0.25[a]")
    calistir("ffmpeg", "-v", "error", "-y", *girdi, "-filter_complex", fc, "-map", f"[v{len(yazilar)}]", "-map", "[a]",
             "-t", f"{toplam:.3f}", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "cikti/video.mp4")
    json.dump(P, open("cikti/plan.json", "w"), indent=1)
    print(f"::notice title=bushcraft video::{sure('cikti/video.mp4'):.1f} sn")


main()
