"""ローカル動作確認用の簡易HTTPサーバー。

実行:
    python3 serve.py
ブラウザで http://localhost:8010/ を開く。
キャッシュ問題を避けるため Cache-Control: no-store を付ける。
どこから実行してもこのファイルのあるフォルダを配信する。
"""
import functools
import http.server
import os
import socketserver

PORT = 8010
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


Handler = functools.partial(Handler, directory=ROOT)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"http://localhost:{PORT}/  (Ctrl+C で停止)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
