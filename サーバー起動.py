import http.server
import socketserver
import webbrowser
import os

# このスクリプトがあるフォルダをサーバーのルートにする
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8080

# サーバーを起動
Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(("", PORT), Handler)

# ブラウザを自動で開く
webbrowser.open(f"http://localhost:{PORT}")

print("=" * 40)
print(f"  サーバー起動中: http://localhost:{PORT}")
print("  終了するには このウィンドウを閉じてください")
print("=" * 40)

# サーバーを動かし続ける
httpd.serve_forever()
