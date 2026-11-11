"""Show Pi sensor readings every three seconds without opening the Arduino USB port."""
import json
import time
from urllib.error import URLError
from urllib.request import urlopen


def main():
    print('온습도 모니터 · 3초 간격 · 종료 Ctrl+C', flush=True)
    try:
        while True:
            started = time.monotonic()
            stamp = time.strftime('%H:%M:%S')
            try:
                with urlopen('http://localhost:3000/api/environment', timeout=2.5) as response:
                    data = json.load(response)
                if data.get('busy'):
                    status = '배출 중 · 센서 조회 대기'
                elif not data.get('sensorOk'):
                    status = '센서 읽기 실패 · 연결 확인'
                else:
                    status = f"온도 {data['temperature']:.1f}°C | 습도 {data['humidity']:.1f}%"
                if 'fanOn' in data:
                    status += ' | 팬 제어 ' + ('ON' if data['fanOn'] else 'OFF')
                print(f'{stamp} | {status}', flush=True)
            except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as error:
                print(f'{stamp} | 조회 실패: {error}', flush=True)
            time.sleep(max(0, 3 - (time.monotonic() - started)))
    except KeyboardInterrupt:
        print('\n모니터 종료')


if __name__ == '__main__':
    main()
