"""Synchronize only the managed community block in Docker Hub's long description."""
import argparse
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

START = "<!-- community-support:start -->"
END = "<!-- community-support:end -->"
HEADING = "## Community & Support"
API = "https://hub.docker.com"

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def merge_description(old, section):
    section = section.strip()
    if not section.startswith(HEADING + "\n") or START in section or END in section:
        raise ValueError("Invalid community section")
    block = START + "\n" + section + "\n" + END
    starts, ends = old.count(START), old.count(END)
    if starts == ends == 0:
        if HEADING in old:
            raise ValueError("Existing unmanaged community heading; review manually")
        return old + ("\n\n" if old else "") + block
    if starts != 1 or ends != 1 or old.index(START) > old.index(END):
        raise ValueError("Invalid or duplicate markers; refusing to overwrite description")
    a = old.index(START)
    b = old.index(END) + len(END)
    return old[:a] + block + old[b:]

def request(path, method="GET", payload=None, token=None):
    headers = {"Accept": "application/json", "User-Agent": "community-description-sync/1"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(API + path, data=data, headers=headers, method=method)
    try:
        with build_opener(NoRedirect()).open(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        raise RuntimeError(f"Docker Hub {method} returned HTTP {exc.code}") from None
    except URLError:
        raise RuntimeError("Docker Hub connection failed") from None

def self_test():
    section = HEADING + "\n\nTest"
    original = "# Existing instructions\n\nKeep this.\n"
    added = merge_description(original, section)
    assert added.startswith(original)
    assert merge_description(added, section) == added
    changed = merge_description(added + "\n\nFooter", section + " updated")
    assert changed.startswith(original) and changed.endswith("\n\nFooter")
    assert changed.count(START) == changed.count(END) == 1
    for bad in (START, END, END + START, START + END + START, HEADING + "\n"):
        try:
            merge_description(bad, section)
        except ValueError:
            pass
        else:
            raise AssertionError("Unsafe description accepted")
    print("Community description self-test passed.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    image = os.environ["DOCKERHUB_IMAGE"]
    username = os.environ["DOCKERHUB_USERNAME"]
    if username != "skoun181" or image not in (
        "skoun181/petdiary", "skoun181/smart-shopping-assistant", "skoun181/hammond-modern"
    ):
        raise ValueError("Unexpected Docker Hub destination")
    secret = os.environ.get("DOCKERHUB_TOKEN")
    if not secret:
        raise RuntimeError("Missing DOCKERHUB_TOKEN GitHub secret")
    section = Path("docs/dockerhub-community.md").read_text(encoding="utf-8")
    # Public metadata read; legacy repository PATCH updates only full_description.
    path = "/v2/repositories/" + image + "/"
    old = request(path)["full_description"]
    if not isinstance(old, str):
        raise ValueError("Unexpected Docker Hub description; no changes made")
    new = merge_description(old, section)
    if new == old:
        print("Docker Hub community description is already up to date.")
        return
    token = request("/v2/auth/token", "POST", {"identifier": username, "secret": secret})["access_token"]
    # Re-read before writing to avoid overwriting a concurrent manual edit.
    if request(path, token=token)["full_description"] != old:
        raise RuntimeError("Docker Hub description changed concurrently; rerun")
    request(path, "PATCH", {"full_description": new}, token)
    if request(path, token=token)["full_description"] != new:
        raise RuntimeError("Docker Hub description verification failed; inspect overview")
    print("Docker Hub community description updated and verified.")

if __name__ == "__main__":
    main()
