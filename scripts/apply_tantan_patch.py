from pathlib import Path
import base64, gzip

def rep(text, old, new, label):
    n=text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 match, got {n}")
    return text.replace(old,new,1)

song=gzip.decompress(base64.b64decode("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")).decode()
js_test=gzip.decompress(base64.b64decode("H4sIACXsdWoC/6VWzW7jNhC+71MQ6EEy6igS9WOpi3QP3W2LYtEU2OMiEChqZHNNiy5JpXGDAL30QfoMPfSBCuxzdEQpthyvNy0KCA7JfPNxODP8hi8sGOt7H//64+/ffv/4Z/9L4I5xK3dko2qQhtgVkM6AvthqdStqqMl3nbBMk5+0IhuQqt4RDXXHrVCtNyfM7FpO/Bm5+prcvyCEq9ZYck8qpdbkgVwR9gsTlkjFamT4ANz6s5d7nFHtEjE9OJCi0kzvgn7NBI1oa9/nrK1FzSw4/v0sEDW5uroinmUtfhcr1eHnOWJm0HsbqLXfE02X4OeOSbcaWGElzMlRJLwz2DXsEPkN2bAPSp8DbcCCRlhymZyDbAVfd9sSxHJlV2XXCmvmJDzLx0ynwQQS2qVdzQmNELmPG9xCaw1GrpHMWmjfuPmZEw/gPVOUZGcxjZB4Dn+Yupi7UbDGbAwRb5UFb3Ygo8n/IMMD2gkZpZ/I4CEUaK13PgII8cdFxzqOg3FbV53g+6bbzMlhb5ySL0cP6k6zvn77+DtP8jnSziaFWYsl+oYB5hqw4L5nZuV7ZsVomqHD3bavQv+Hd9c/BsZq0S5FM3o2OrFh2+nB3x9OPvqE5WD5irx6RdpOyvkTx25mg0PB4IfvreDuE3U1/BfLji3CDL+MpwnNiySMoyymPE6Ax0XCq5zlMWN1k4dNljLKo0VE64ZXcY8Koxy8obhG8hpg+2Z6WQAr9b073j0R9Vd478II736j1QYnbZj1M6uGMfXIw/wYTI/A2QS8OAXHU/BicQAv8lNwMgXn9ADO41NwOgFHUbEHRzQ8BWdTMI0n4GQE30zqxWrG11guLmBypwUv3dJzQlZDwzppT1PrrFHnMLkCN9DdBuuDSe8cUirOnKT9end3FqSVgygtlqJ9QnZI+oA1OylZJV3qb47KYyJTRnWaw/intLuto8ceoktjsZJ5abjSUKIUwDldHDke+01Z9XLbt6BnDHrOUkMDGlre7/sajNBAXmtxC+RtL7Pk3fXb62C5fYYJU4gaasvhfiNTkzZFnKQhozlrII3TKktilsVhnkRZAbSKaMGKMCnCIqJ5uEhYE6KsVlAUCVoUz+z3GP9yaC3ffvH53vLU6l/0mse8gMSGizEdE/QopWhMLyh9xhrroDVbZUSvSKWBjbCq7Y0vsmc85ZbdYtKVrFEa8RoxaWBqsmGofUcmw8ui3L8s5uRyEFZDEoK3haSXnyfYH/WWaYGvAiRQm/7hAax3gjApL/p2Qwb8Y9Mg0X/nbRUZTkjGE16ehsNpyRFPt90qbRE9JsO8D2+eVp6z8uokoQ3qNaRVXPEmpXXMw4wXSbUIE2A8rqKM5osaqnQR1TxJijqJM8qatKqyinHP9Y7jTnpd9U+v4JbJDoZ3QoDdVDSCu34zG5ur7wBOo9zINUcUH+h748Ps5T+Cd+O1QQoAAA==")).decode()

p=Path("scorebook.yaml"); s=p.read_text(encoding="utf-8")
s=rep(s,"  version: 0.6.20\n","  version: 0.6.21\n","scorebook version")
s=rep(s,"  quarantine: []\n",song+"  quarantine: []\n","scorebook insertion")
p.write_text(s,encoding="utf-8")

p=Path("package.json"); s=p.read_text(encoding="utf-8")
s=rep(s,'"version": "0.6.20"','"version": "0.6.21"',"package version")
p.write_text(s,encoding="utf-8")

p=Path("README.md"); s=p.read_text(encoding="utf-8")
s=rep(s,"目前版本包含 15 首已驗證曲目：","目前版本包含 16 首已驗證曲目：","README count")
s=rep(s,"15. 造飛機\n","15. 造飛機\n16. 淡々泡々\n","README song")
p.write_text(s,encoding="utf-8")

p=Path("tests/scorebook.test.mjs"); s=p.read_text(encoding="utf-8")
s=rep(s,"test('0.6.20 has fifteen verified songs, no quarantine, and passes structural gates'",
      "test('0.6.21 has sixteen verified songs, no quarantine, and passes structural gates'","test title")
s=rep(s,"assert.equal(book.project.version, '0.6.20');","assert.equal(book.project.version, '0.6.21');","test version")
s=rep(s,"verifiedSongs: 15,","verifiedSongs: 16,","verified count")
s=rep(s,"    'build-an-airplane-zh',\n  ]);","    'build-an-airplane-zh',\n    'tantan-houhou',\n  ]);","song ids")
s=rep(s,"test('A4 print contract selects one verified song and permits page breaks only between systems'",
      js_test+"\n\ntest('A4 print contract selects one verified song and permits page breaks only between systems'","dedicated test")
p.write_text(s,encoding="utf-8")

p=Path("tests/library-visual.spec.mjs"); s=p.read_text(encoding="utf-8")
s=rep(s,"  { id: 'build-an-airplane-zh', title: '造飛機', notes: 55, lyrics: 55 },\n];",
      "  { id: 'build-an-airplane-zh', title: '造飛機', notes: 55, lyrics: 55 },\n  { id: 'tantan-houhou', title: '淡々泡々', notes: 124, lyrics: 0 },\n];","visual song")
s=rep(s,"規格 0.6.20","規格 0.6.21","visual version")
s=rep(s,"toHaveCount(15);","toHaveCount(16);","library count")
s=rep(s,"toHaveCount(15);","toHaveCount(16);","directory count")
s=s.replace("?v=0.6.20-","?v=0.6.21-")
if "?v=0.6.20-" in s: raise SystemExit("stale visual version")
p.write_text(s,encoding="utf-8")
print("patched")
