import argparse,json,os
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--slot',type=int,required=True);parser.add_argument('--ms',type=int,required=True);args=parser.parse_args()
if args.slot not in range(1,21) or args.ms not in range(100,5001):raise SystemExit('슬롯 1~20, 시간 100~5000ms 범위로 입력하세요.')
path=Path(__file__).with_name('device.json');config=json.loads(path.read_text())
if str(args.slot) not in config['durations']:raise SystemExit('현재 연결 설정에 없는 모터입니다. 모터 연결과 DB 슬롯부터 설정하세요.')
config['durations'][str(args.slot)]=args.ms
backup=path.with_suffix('.json.before-runtime');backup.write_text(path.read_text());os.chmod(backup,0o600)
temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(config,indent=2));os.chmod(temp,0o600);os.replace(temp,path)
print('시간 설정 완료. 모터는 작동하지 않았습니다. systemctl --user restart vitamin-kiosk 로 적용하세요.')
