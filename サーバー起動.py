# -*- coding: utf-8 -*-
"""Felice LP / シミュレーター プレビュー用 簡易サーバー
ダブルクリックで起動します。8080が使用中でも自動で空きポート(〜8090)を探します。
エラー時はウィンドウを開いたままにして原因を表示します。"""
import http.server
import socketserver
import webbrowser
import os
import traceback


def main():
    # このスクリプトがあるフォルダをサーバーのルートにする
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    host = "127.0.0.1"
    httpd = None
    chosen = None
    for port in range(8080, 8091):
        try:
            socketserver.TCPServer.allow_reuse_address = True
            httpd = socketserver.TCPServer((host, port), http.server.SimpleHTTPRequestHandler)
            chosen = port
            break
        except OSError:
            continue  # そのポートは使用中 → 次を試す

    if httpd is None:
        print("起動できませんでした：8080〜8090がすべて使用中です。")
        print("すでに起動しているサーバーのウィンドウを閉じてから、もう一度実行してください。")
        input("Enterキーで終了します...")
        return

    root = f"http://localhost:{chosen}/"
    sim = f"http://localhost:{chosen}/simulator.html"
    print("=" * 50)
    print(f"  サーバー起動中: {root}")
    print(f"  シミュレーター : {sim}")
    print("  停止: Ctrl+C か、このウィンドウを閉じる")
    print("=" * 50)

    try:
        webbrowser.open(sim)  # ブラウザでシミュレーターを自動で開く
    except Exception:
        print("（ブラウザの自動起動に失敗しました。上のURLを手動で開いてください）")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n停止しました。")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("予期しないエラーが発生しました：")
        traceback.print_exc()
        input("Enterキーで終了します...")
