"""cikti/video.mp4'u YouTube'a GIZLI yukler ve bolumu kullanildi diye isaretler. YT_YETKI: yetki.js ciktisi."""
import json, os, re, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HANDLE = "@BushcraftHakankarahan"


def main():
    y = json.loads(os.environ["YT_YETKI"])
    P = json.load(open("cikti/plan.json"))
    video = open("cikti/video.mp4", "rb").read()
    t = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", urllib.parse.urlencode(
        {"client_id": y["client_id"], "client_secret": y["client_secret"], "refresh_token": y["refresh_token"],
         "grant_type": "refresh_token"}).encode()))

    def temiz(s):
        return re.sub(r"https?://\S+|[<>#]", "", str(s or "")).strip()

    govde = {"snippet": {"title": f"{temiz(P['title'])[:60]} {HANDLE}",
                         "description": f"{temiz(P['description'])}\n\n{HANDLE}\n#ad #shorts #bushcraft #survival",
                         "tags": ["bushcraft", "survival", "camping", "shorts"], "categoryId": "19"},
             "status": {"privacyStatus": "private", "selfDeclaredMadeForKids": False}}
    bas = urllib.request.urlopen(urllib.request.Request(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        json.dumps(govde).encode(), {"authorization": f"Bearer {t['access_token']}", "content-type": "application/json",
                                     "x-upload-content-type": "video/mp4", "x-upload-content-length": str(len(video))}))
    s = json.load(urllib.request.urlopen(urllib.request.Request(
        bas.headers["location"], video, {"content-type": "video/mp4"}, method="PUT"), timeout=600))
    yol = os.path.join(HERE, "kullanilan.json")
    k = json.load(open(yol)) + [{"ad": P["ad"], "bas": P["bas"], "baslik": P["title"], "acilis": P["steps"][0]["pieces"][0]["start"]}]
    json.dump(k, open(yol, "w"), indent=1)
    print(f"::notice title=youtube::gizli yuklendi https://youtu.be/{s['id']}")


main()
