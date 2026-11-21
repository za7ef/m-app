#!/usr/bin/env python3
"""
يحدد رقم الإصدار التسويقي للبناء القادم، بحيث لا يتكرر رقم إصدار في أكثر من بناء.

القاعدة: إذا كان الرقم المكتوب في الملف أكبر من آخر إصدار منشور يُستخدم كما هو،
وإلا يُرفع الجزء الأخير من آخر إصدار منشور بمقدار واحد (مثل 1.4.11 ← 1.4.12)،
ويُكتب الرقم الجديد في الملف، ويُحفظ في الفرع الرئيسي عند تمرير ‎--commit.

الاستخدام:
  python3 scripts/next_version.py project.yml [--commit]
  python3 scripts/next_version.py app.json [--commit]

المتغيرات المطلوبة: GH_TOKEN و GITHUB_REPOSITORY (متوفرة تلقائيًا في GitHub Actions).
المخرجات: version و bumped في GITHUB_OUTPUT.
"""
import base64
import json
import os
import re
import sys
import urllib.request

VERSION_RE = re.compile(r"(?<![\d.])(\d+(?:\.\d+){1,3})(?![\d.])")


def api(method, path, body=None):
    url = "https://api.github.com/" + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def key(v):
    return tuple(int(x) for x in v.split("."))


def released_versions(repo):
    out = set()
    page = 1
    while True:
        rels = api("GET", f"repos/{repo}/releases?per_page=100&page={page}")
        if not rels:
            break
        for r in rels:
            if r.get("draft"):
                continue
            for text in (r.get("tag_name") or "", r.get("name") or ""):
                m = VERSION_RE.search(text)
                if m:
                    out.add(m.group(1))
                    break
        if len(rels) < 100:
            break
        page += 1
    return out


def bump(v):
    parts = v.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)


# ---- قراءة الرقم وكتابته حسب نوع الملف ----

def read_version(path, text):
    if path.endswith(".json"):
        return json.loads(text)["expo"]["version"]
    m = re.search(r'MARKETING_VERSION:\s*"?([0-9.]+)"?', text)
    if not m:
        sys.exit("لم يُعثر على MARKETING_VERSION في " + path)
    return m.group(1)


def write_version(path, text, new):
    if path.endswith(".json"):
        d = json.loads(text)
        expo = d["expo"]
        expo["version"] = new
        # رقم البناء المشتق من رقم الإصدار (1.4.12 ← 1412) إن كان المشروع يستخدمه
        build = "".join(new.split("."))
        if "buildNumber" in expo.get("ios", {}):
            expo["ios"]["buildNumber"] = build
        if "versionCode" in expo.get("android", {}):
            expo["android"]["versionCode"] = int(build)
        return json.dumps(d, ensure_ascii=False, indent=2) + "\n"
    return re.sub(r'(MARKETING_VERSION:\s*)"?[0-9.]+"?', lambda m: f'{m.group(1)}"{new}"', text)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    commit = "--commit" in sys.argv[2:]
    repo = os.environ["GITHUB_REPOSITORY"]

    text = open(path, encoding="utf-8").read()
    current = read_version(path, text)
    released = released_versions(repo)
    latest = max(released, key=key) if released else None

    if latest is None or key(current) > key(latest):
        new, bumped = current, False
    else:
        new, bumped = bump(latest), True

    print(f"الإصدار في الملف: {current}، آخر إصدار منشور: {latest}، إصدار هذا البناء: {new}")

    if bumped:
        open(path, "w", encoding="utf-8").write(write_version(path, text, new))
        if commit:
            # الحفظ في الفرع الرئيسي انطلاقًا من نسخته الحالية، وتغيير رقم الإصدار فقط
            branch = api("GET", f"repos/{repo}")["default_branch"]
            cur = api("GET", f"repos/{repo}/contents/{path}?ref={branch}")
            main_text = base64.b64decode(cur["content"]).decode("utf-8")
            updated = write_version(path, main_text, new)
            if updated != main_text:
                api("PUT", f"repos/{repo}/contents/{path}", {
                    "message": f"رفع رقم الإصدار إلى {new} [skip ci]",
                    "content": base64.b64encode(updated.encode("utf-8")).decode(),
                    "sha": cur["sha"],
                    "branch": branch,
                })
                print(f"حُفظ الرقم {new} في الفرع {branch}")

    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a") as f:
            f.write(f"version={new}\nbumped={'true' if bumped else 'false'}\n")


if __name__ == "__main__":
    main()
