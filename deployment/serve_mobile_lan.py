"""Serve the mobile build and relay its environment requests to one Pi."""
import argparse
import http.client
import ipaddress
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def mobile_handler(pi_address, web_root):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(web_root), **kwargs)

        def valid_host(self):
            address, port = self.connection.getsockname()[:2]
            return self.headers.get('Host') in {f'{address}:{port}', f'localhost:{port}'}

        def reply(self, status, body):
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def relay(self, body=None):
            headers = {}
            if body is not None:
                headers = {
                    'Origin': f'http://{pi_address}:3001',
                    'Content-Type': 'application/json',
                    'Authorization': self.headers.get('Authorization', ''),
                }
            connection = http.client.HTTPConnection(str(pi_address), 3000, timeout=11)
            try:
                connection.request(self.command, '/api/environment', body=body, headers=headers)
                response = connection.getresponse()
                payload = response.read(8193)
                if len(payload) > 8192:
                    raise ValueError('Response too large')
                status = response.status
            except (OSError, http.client.HTTPException, ValueError):
                status = 502
                payload = json.dumps({'message': 'Pi 온습도 서버에 연결하지 못했습니다.'}).encode()
            finally:
                connection.close()
            self.reply(status, payload)

        def do_GET(self):
            if not self.valid_host():
                return self.send_error(403)
            if self.path == '/api/environment':
                return self.relay()
            if self.path == '/':
                # Signal that this server can relay environment requests on the same origin.
                html = (web_root / 'index.html').read_bytes().replace(
                    b'<head>', b'<head><meta name="vitamin-env-proxy" content="enabled">', 1
                )
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(html)))
                self.end_headers()
                self.wfile.write(html)
                return
            return super().do_GET()

        def do_POST(self):
            if self.path != '/api/environment':
                return self.send_error(404)
            if not self.valid_host() or self.headers.get('Origin') != 'http://' + self.headers['Host']:
                return self.send_error(403)
            if self.headers.get_content_type() != 'application/json':
                return self.send_error(415)
            try:
                size = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                return self.send_error(400)
            if not 0 < size <= 512:
                return self.send_error(400)
            return self.relay(self.rfile.read(size))

        def list_directory(self, path):
            self.send_error(404)

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pi', required=True, type=ipaddress.IPv4Address)
    parser.add_argument('--directory', type=Path, default=Path(__file__).with_name('mobile'))
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=3001)
    args = parser.parse_args()
    web_root = args.directory.resolve()
    if not (web_root / 'index.html').is_file():
        parser.error('mobile build not found')
    handler = mobile_handler(args.pi, web_root)
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f'Mobile web port {args.port}, Pi environment {args.pi}:3000', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
