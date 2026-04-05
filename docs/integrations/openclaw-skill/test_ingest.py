import json
import sys
from urllib import request


def main():
    if len(sys.argv) < 3:
        print("Usage: python test_ingest.py <token> <content>")
        sys.exit(1)

    token = sys.argv[1]
    content = sys.argv[2]

    payload = json.dumps({
        "content": content,
        "mode": "append_today",
    }).encode("utf-8")

    req = request.Request(
        "http://yingjiapp.com/api/v1/integrations/openclaw/ingest",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=15) as resp:
        print(resp.status)
        print(resp.read().decode("utf-8"))


if __name__ == "__main__":
    main()
