"""Serve mobile web on the LAN; fan settings use Supabase directly."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pi', help='Deprecated; no longer required')
    parser.add_argument('--directory', type=Path, default=Path(__file__).with_name('mobile'))
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=3001)
    args = parser.parse_args()
    root = args.directory.resolve()
    if not (root / 'index.html').is_file():
        parser.error('mobile build not found')
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)
        def list_directory(self, path):
            self.send_error(404)
    with ThreadingHTTPServer((args.bind, args.port), Handler) as server:
        print(f'Mobile web port {args.port}; settings stored in Supabase', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
