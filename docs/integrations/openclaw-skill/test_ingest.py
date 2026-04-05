import json
import sys
from urllib import parse, request
from typing import List, Optional


DEFAULT_URL = "http://yingjiapp.com/api/v1/integrations/openclaw/ingest"


def usage():
    print(
        "Usage:\n"
        "  python test_ingest.py <token> <content>\n"
        "  python test_ingest.py <token> <content> --mode=create --format=json --title=测试标题 --date=2026-04-05\n"
        "  python test_ingest.py <token> <content> --mode=append_today --format=text --url=http://yingjiapp.com/api/v1/integrations/openclaw/ingest"
    )


def parse_args(argv: list[str]):
    if len(argv) < 3:
        usage()
        sys.exit(1)

    token = argv[1]
    content = argv[2]
    mode = "append_today"
    body_format = "json"
    url = DEFAULT_URL
    title = None
    diary_date = None
    importance = None
    emotion_tags = None

    for arg in argv[3:]:
        if arg.startswith("--mode="):
            mode = arg.split("=", 1)[1].strip() or mode
        elif arg.startswith("--format="):
            body_format = arg.split("=", 1)[1].strip() or body_format
        elif arg.startswith("--url="):
            url = arg.split("=", 1)[1].strip() or url
        elif arg.startswith("--title="):
            title = arg.split("=", 1)[1].strip() or None
        elif arg.startswith("--date="):
            diary_date = arg.split("=", 1)[1].strip() or None
        elif arg.startswith("--importance="):
            raw = arg.split("=", 1)[1].strip()
            importance = int(raw) if raw else None
        elif arg.startswith("--tags="):
            raw = arg.split("=", 1)[1].strip()
            emotion_tags = [t.strip() for t in raw.split(",") if t.strip()] if raw else None

    if body_format not in {"json", "text", "form"}:
        raise SystemExit("format must be one of: json, text, form")

    return token, content, mode, body_format, url, title, diary_date, importance, emotion_tags


def build_payload(
    content: str,
    mode: str,
    title: Optional[str],
    diary_date: Optional[str],
    importance: Optional[int],
    emotion_tags: Optional[List[str]],
) -> dict:
    data = {"content": content, "mode": mode}
    if title:
        data["title"] = title
    if diary_date:
        data["diary_date"] = diary_date
    if importance is not None:
        data["importance_score"] = importance
    if emotion_tags:
        data["emotion_tags"] = emotion_tags
    return data


def build_request(
    token: str,
    content: str,
    mode: str,
    body_format: str,
    url: str,
    title: Optional[str],
    diary_date: Optional[str],
    importance: Optional[int],
    emotion_tags: Optional[List[str]],
) -> request.Request:
    payload_obj = build_payload(content, mode, title, diary_date, importance, emotion_tags)
    if body_format == "json":
        payload = json.dumps(payload_obj, ensure_ascii=False).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        target_url = url
    elif body_format == "form":
        form_data = {
            "content": payload_obj["content"],
            "mode": payload_obj["mode"],
        }
        if title:
            form_data["title"] = title
        if diary_date:
            form_data["diary_date"] = diary_date
        if importance is not None:
            form_data["importance_score"] = str(importance)
        if emotion_tags:
            form_data["emotion_tags"] = ",".join(emotion_tags)
        payload = parse.urlencode(form_data).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        target_url = url
    else:
        payload = content.encode("utf-8")
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "text/plain; charset=utf-8",
        }
        sep = "&" if "?" in url else "?"
        target_url = f"{url}{sep}mode={parse.quote(mode)}"

    return request.Request(target_url, data=payload, headers=headers, method="POST")


def main():
    token, content, mode, body_format, url, title, diary_date, importance, emotion_tags = parse_args(sys.argv)
    req = build_request(token, content, mode, body_format, url, title, diary_date, importance, emotion_tags)
    print(f"[request] {req.method} {req.full_url}")
    print(f"[format] {body_format}")
    if title:
        print(f"[title] {title}")
    if diary_date:
        print(f"[date] {diary_date}")
    if importance is not None:
        print(f"[importance] {importance}")
    if emotion_tags:
        print(f"[tags] {','.join(emotion_tags)}")
    try:
        with request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            print(resp.status)
            print(body)
    except Exception as exc:
        print(f"[error] {exc}")
        raise


if __name__ == "__main__":
    main()
