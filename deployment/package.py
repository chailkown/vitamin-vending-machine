"""Build a Pi bundle from compiled web assets; credentials stay outside web roots."""
import argparse, json, re, shutil, uuid
from pathlib import Path

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--device-config',type=Path,required=True)
 parser.add_argument('--output',type=Path)
 args=parser.parse_args();root=Path(__file__).resolve().parents[1]
 output=(args.output or root/'.deploy/free_vending_update').resolve()
 config=json.loads(args.device_config.read_text(encoding='utf-8'))
 uuid.UUID(config['device_id'])
 if not re.fullmatch('[a-f0-9]{64}',config['device_token']):raise SystemExit('기기 인증값 형식 오류')
 if not config['supabase_url'].startswith('https://') or not config['publishable_key']:raise SystemExit('공개 DB 설정 확인 필요')
 for source in (root/'frontend/build',root/'health-app-web/dist'):
  if not (source/'index.html').is_file():raise SystemExit('먼저 두 웹의 npm run build를 실행하세요.')
 if output==root or root in output.parents and any(part in output.relative_to(root).parts for part in ('src','public','build','dist')):
  raise SystemExit('출력은 저장소 루트나 웹 공개 폴더 밖의 전용 패키지 경로를 사용하세요.')
 (output/'pi').mkdir(parents=True,exist_ok=True)
 for name in ('server.py','recover.py','set_runtime.py','test_gateway.py','open_kiosk.sh'):
  shutil.copy2(root/'pi_gateway'/name,output/'pi'/name)
 shutil.copytree(root/'frontend/build',output/'pi/kiosk',dirs_exist_ok=True)
 shutil.copytree(root/'health-app-web/dist',output/'mobile',dirs_exist_ok=True)
 shutil.copy2(root/'deployment/install.sh',output/'install.sh')
 shutil.copy2(args.device_config,output/'pi/device.json')
 (output/'pi/device.json').chmod(0o600)
 print('Pi bundle: '+str(output))
 print('Device credential is private; do not publish the bundle or add it to Git.')
if __name__=='__main__':main()
