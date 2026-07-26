"""把批量生成的课程/词典 JSON 导出为前端数据文件。

输入：data/builtin_vocabs/out/{id}_course.json（generate_builtin_course.py 产出）
     data/builtin_vocabs/out/dict_all.json（--dict-only 产出的并集词典）
输出：frontend/data/courses/{id}.json（课程内容，服务端加载）
     frontend/public/dict/builtin.json（合并词典，浏览器懒加载）

用法：python scripts/export_frontend_data.py
"""

from __future__ import annotations

import json
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
OUT_DIR = BACKEND / "data" / "builtin_vocabs" / "out"
FRONTEND = BACKEND.parent / "frontend"

COURSE_IDS = ["primary", "junior", "senior", "cet4", "cet6", "daily", "business"]


def main() -> None:
    courses_dir = FRONTEND / "data" / "courses"
    courses_dir.mkdir(parents=True, exist_ok=True)

    exported = 0
    for course_id in COURSE_IDS:
        source = OUT_DIR / f"{course_id}_course.json"
        target = courses_dir / f"{course_id}.json"

        if not source.exists():
            if not target.exists():
                target.write_text("{}")
            print(f"[course] {course_id}: 源文件不存在，保留占位")
            continue

        data = json.loads(source.read_text(encoding="utf-8"))
        course = data.get("course")
        if not course or not course.get("articles"):
            print(f"[course] {course_id}: 无文章数据，跳过")
            continue

        target.write_text(json.dumps(course, ensure_ascii=False), encoding="utf-8")
        print(f"[course] {course_id}: {course['total_articles']} 篇 → {target.relative_to(FRONTEND.parent)}")
        exported += 1

    # 合并词典：并集词典优先，其余 dict_* 分片与各课程自带词典兜底
    merged: dict[str, dict] = {}
    dict_sources = (
        [OUT_DIR / "dict_all.json"]
        + sorted(OUT_DIR.glob("dict_*.json"))
        + [OUT_DIR / f"{cid}_course.json" for cid in COURSE_IDS]
    )
    for source in dict_sources:
        if not source.exists():
            continue
        data = json.loads(source.read_text(encoding="utf-8"))
        for entry in data.get("dict_entries", []):
            word = str(entry.get("word", "")).lower()
            if word and word not in merged:
                merged[word] = entry

    dict_target = FRONTEND / "public" / "dict" / "builtin.json"
    dict_target.parent.mkdir(parents=True, exist_ok=True)
    dict_target.write_text(json.dumps(merged, ensure_ascii=False), encoding="utf-8")
    print(f"[dict] 合并 {len(merged)} 条 → {dict_target.relative_to(FRONTEND.parent)}")
    print(f"完成：导出 {exported} 套课程。")


if __name__ == "__main__":
    main()
