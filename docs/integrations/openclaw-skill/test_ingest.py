import json
import sys
from urllib import parse, request


DEFAULT_URL = "http://yingjiapp.com/api/v1/integrations/openclaw/ingest"


def usage():
    print(
        "Usage:\n"
        "  python test_ingest.py <token> <content>\n"
        "  python test_ingest.py <token> <content> --mode=create --format=json\n"
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

    for arg in argv[3:]:
        if arg.startswith("--mode="):
            mode = arg.split("=", 1)[1].strip() or mode
        elif arg.startswith("--format="):
            body_format = arg.split("=", 1)[1].strip() or body_format
        elif arg.startswith("--url="):
            url = arg.split("=", 1)[1].strip() or url

    if body_format not in {"json", "text", "form"}:
        raise SystemExit("format must be one of: json, text, form")

    return token, content, mode, body_format, url


def build_request(token: str, content: str, mode: str, body_format: str, url: str) -> request.Request:
    if body_format == "json":
        payload = json.dumps({"content": content, "mode": mode}).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        target_url = url
    elif body_format == "form":
        payload = parse.urlencode({"content": content, "mode": mode}).encode("utf-8")
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
    token, content, mode, body_format, url = parse_args(sys.argv)
    req = build_request(token, content, mode, body_format, url)
    print(f"[request] {req.method} {req.full_url}")
    print(f"[format] {body_format}")
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
