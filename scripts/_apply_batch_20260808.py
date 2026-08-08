from pathlib import Path
import base64
import json
import textwrap
import zlib
import yaml

SONGS = json.loads(zlib.decompress(base64.b64decode("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")).decode("utf-8"))
SCOREBOOK_TEST_BLOCK = zlib.decompress(base64.b64decode("eNqlV21v2zYQ/t5fQQQDLAORRFHvKbKg3Ya+oG9oCgxDUagUScVMZEkjqThGkf++EyU7i+0kxQYktkTekcfnee54NkIbZ1bJa4Gwl3gkR02vtFBrpNvmQiNxQ5mp12jZclEjsxBSIS1qwYzgqJI38KkNNZIhzVol9OwYUb1uGHLm6PRX9OMZQqxttEE/UNm2V+gWnSK6otKguqX8k2ovYSln/nxrpzvBNBgNnggdKSob135ctC44ro9OpimEjDS1OEFHn2H6GI2fr1r0YrA6nmyWwggFNsSPtmOdZFd9d4LwnRHVPQR/grLNUNOa4Z1Em4F6rSS7N8JlVUnW12Z9goLjbUyD23blXtWw+cKYTp/4/mq18pa9lmzd9ow2SlDusXbpyyW9ENo///jh1blPIuxj7H5+8ebDZ/fTB++yuzi62xLsDKzIQ0ZpQirKwhBnuBR5XFJKsygOKS45ozGhohJVJETJoyogWZamPI1YnMZpGAfTirfj19ElZVcubbh7Kev6AMJvYR7BPHo7zO9iG/4ctkGyC262B252CFzy0+DqhRDGItzVvbbYto3PxRJiX1ElvFGrvuufSwjB1cvOXYJuwKSisJnPV3mSJCwL+IaUhASBTwiMwkPB2muh3JqqC1FUshZe1xxgJ6ZRFpMgTLCgScqDNA0ZYzEjWRqzMmdJSqs04jjAGYvCqmRRLghOShHGKRUk32EHss4tBVXuSjTGtREMQ8u2bwwEf4CvLwuBXoIH+hM80EfwGFIXvd947DKY+Nkeg8E+g/kOgSHZJTDEhwgM7xMYPEKgbC7gD45b15a+VedCXTBwDL/vhpKhfYKDxMeh/+VxWIrfivNptZfDagfzKBNpVgHkacBLHMVZnuYiwGkZZUGOSVbSKsRJlkISUcbCJM+CNMAszGkWZ3EcJTtMyaVL3VoaYME1gnatOUDOm9kSUfTOWqEvo9UuIdF/K1dhvEdI/P8yitNrybXkYswmxhtfL9rOH8SvIUcKWoznLcbzFgnGN/BfMNV2BQNmhBqS5Oz6dIAujiKgb5+HJOSCxyXkDKniuExJkoUVjlMGJJA4j5M8EknOqiTOq4zhiIWwWILzLOV5XmZ0hwfeulBilQvq0O6CggTqdnWAit9b9BfYoT/ADr0GO/SuXZ0duDzIHhvk6fSI0l027kYeSY8H2FDgoQFhy8MIv610m0JVCtB6I5R/8PDuZvpwxQqisgSwE0wzjEnAU0zCPIcKlQRxyRMigjzhZcxFjHmY5SEJ4oqGSZQSgiNSsX/jf/v8GXxWrULOeKV/lfzY3uvfUFuhj+Vw5XugDAXHdex9P59P1Ew9ALQe0AIMDYNXy1JRtfZsO+JVsuGOA3cnl5waYXuM7ZsnOTo9PUWS234CQScCnYzx2itn8D5G33/5IfktAtgMNDZSm+/3DcXfPa2trWcVMkY9Pj9oOVwpvT5GMyhAspKCzx40vSN9Wvlu4EEfq8HJ3D4/aDkqsxDyYmEWRd9Ioye/ceaRLUYFe7VoLsxiu9k4+vDBQWRMTF+FWXeA18x2gYWV5Owpz061UFwEL0rAYwZmwAhtTLESZQEbg37Z4slFIEmmgOFpbqW3kZG4BpENvWRVUwNXyB/23XofWnU0B4nVgLIzvlqB2SfvCqRn5TUb0ns2v4+WTflH1LSL7jAymY/BGjX0WKdW+56tF4UdekrzU+eyp3jrfCggO+HVLaODwGeimT1spVpr0yoJxYPWj1jqdV3Tst495lj47tMC9auDHxXvJ31tzrxV4ZJ2jjO9DYe9X2e9iSZrdcfR15GkThq2QGdn8CumBl2Mg7xX0PW1zbf5PcTH4gfbM2jEjXhN9cKZ6QUlcQLs9t0Ar/MWmnJIcTV0EtXa2Yl9PvfGVZzZQtwchGec3+b7+DIVIhveJo6l1EsK0X/fo3KqmNe07sUoX2+sNcweaz5AotaOYw0sGvbJitUoGLIr3j67nT//B7o1QFw=")).decode("utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one occurrence, found {count}")
    return text.replace(old, new, 1)

songs_yaml = textwrap.indent(
    yaml.safe_dump(SONGS, sort_keys=False, allow_unicode=True, width=120).rstrip() + "\n",
    "  ",
)

score_path = Path("scorebook.yaml")
score = score_path.read_text(encoding="utf-8")
for song in SONGS:
    if f"  - id: {song['id']}\n" in score:
        raise RuntimeError(f"scorebook already contains {song['id']}")
score = replace_once(score, "  version: 0.6.28\n", "  version: 0.6.29\n", "scorebook version")
score = replace_once(score, "  quarantine: []\n", songs_yaml + "  quarantine: []\n", "scorebook quarantine anchor")
score_path.write_text(score, encoding="utf-8")

package_path = Path("package.json")
package = package_path.read_text(encoding="utf-8")
package = replace_once(package, '"version": "0.6.28"', '"version": "0.6.29"', "package version")
package_path.write_text(package, encoding="utf-8")

score_test_path = Path("tests/scorebook.test.mjs")
score_test = score_test_path.read_text(encoding="utf-8")
score_test = replace_once(
    score_test,
    "test('0.6.28 has forty-five verified songs, no quarantine, and passes structural gates'",
    "test('0.6.29 has fifty verified songs, no quarantine, and passes structural gates'",
    "scorebook test title",
)
score_test = replace_once(
    score_test,
    "assert.equal(book.project.version, '0.6.28');",
    "assert.equal(book.project.version, '0.6.29');",
    "scorebook test version",
)
score_test = replace_once(score_test, "    verifiedSongs: 45,\n", "    verifiedSongs: 50,\n", "scorebook verified count")
score_test = replace_once(
    score_test,
    "    'the-mulberry-bush',\n",
    """    'the-mulberry-bush',
    'rain-rain-go-away',
    'jack-and-jill',
    'the-bear-went-over-the-mountain',
    'im-a-little-teapot',
    'do-your-ears-hang-low',
""",
    "scorebook song id list",
)
if "five 0.6.29 nursery songs exactly model their selected fixed static scores" in score_test:
    raise RuntimeError("0.6.29 exact-source test already exists")
score_test = score_test.rstrip() + "\n\n" + SCOREBOOK_TEST_BLOCK + "\n"
score_test_path.write_text(score_test, encoding="utf-8")

difficulty_path = Path("tests/difficulty.test.mjs")
difficulty = difficulty_path.read_text(encoding="utf-8")
difficulty = replace_once(
    difficulty,
    "// Includes the verified 0.6.28 four-song static-source batch.",
    "// Includes the verified 0.6.29 five-song static-source batch.",
    "difficulty version comment",
)
difficulty = replace_once(
    difficulty,
    "assert.equal(book.library.songs.length, 45);",
    "assert.equal(book.library.songs.length, 50);",
    "difficulty song count",
)
difficulty_path.write_text(difficulty, encoding="utf-8")

visual_path = Path("tests/library-visual.spec.mjs")
visual = visual_path.read_text(encoding="utf-8")
visual = replace_once(
    visual,
    "  { id: 'the-mulberry-bush', title: 'The Mulberry Bush', notes: 36, lyrics: 35 },\n];",
    """  { id: 'the-mulberry-bush', title: 'The Mulberry Bush', notes: 36, lyrics: 35 },
  { id: 'rain-rain-go-away', title: 'Rain, Rain, Go Away', notes: 24, lyrics: 24 },
  { id: 'jack-and-jill', title: 'Jack and Jill', notes: 28, lyrics: 28 },
  { id: 'the-bear-went-over-the-mountain', title: 'The Bear Went Over the Mountain', notes: 32, lyrics: 30 },
  { id: 'im-a-little-teapot', title: "I'm a Little Teapot", notes: 35, lyrics: 35 },
  { id: 'do-your-ears-hang-low', title: 'Do Your Ears Hang Low?', notes: 47, lyrics: 47 },
];""",
    "visual song list",
)
if visual.count("0.6.28") != 3:
    raise RuntimeError(f"visual version: expected 3 occurrences, found {visual.count('0.6.28')}")
visual = visual.replace("0.6.28", "0.6.29")
if visual.count("toHaveCount(45)") != 2:
    raise RuntimeError(f"visual count: expected 2 occurrences, found {visual.count('toHaveCount(45)')}")
visual = visual.replace("toHaveCount(45)", "toHaveCount(50)")
visual_path.write_text(visual, encoding="utf-8")

print("Applied Kawai Score Studio 0.6.29 five-song batch.")
