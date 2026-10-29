"""Run on Pi only after physically checking the collection tray and stock."""
import argparse,json
from pathlib import Path
from server import Cloud,Gateway
parser=argparse.ArgumentParser();parser.add_argument('--request');parser.add_argument('--outcome',choices=['completed','failed']);parser.add_argument('--confirmed',action='store_true');args=parser.parse_args()
root=Path(__file__).parent
import fcntl
singleton=(root/'gateway.lock').open('a')
try:fcntl.flock(singleton,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError:raise SystemExit('먼저 systemctl --user stop vitamin-kiosk 로 배출 서버를 중지해주세요.')
config=json.loads((root/'device.json').read_text());cloud=Cloud(config)
gateway=Gateway(cloud,None,root/'journal.sqlite3',config['durations'])
with gateway.db() as db:rows=db.execute('select id,state,order_id from requests').fetchall()
if not args.request:
 for row in rows:print(*row)
else:
 row=next((row for row in rows if row[0]==args.request),None)
 if not row:raise SystemExit('기록이 없습니다.')
 if not args.outcome or not args.confirmed:raise SystemExit('실제 배출·수령구를 확인한 후 --outcome completed 또는 failed와 --confirmed를 지정하세요. failed는 하나도 배출되지 않은 경우에만 사용합니다.')
 if row[1] in ('completed','failed','cancelled'):raise SystemExit('이미 확정된 기록입니다.')
 order=cloud.rpc('lookup_free_order',{'p_request_id':args.request})
 if order.get('order_id'):
  result=cloud.rpc('finish_free_order',{'p_order_id':order['order_id'],'p_request_id':args.request,'p_result':args.outcome})
  if result.get('status')!=args.outcome:raise SystemExit('DB 결과 확인 실패')
 elif args.outcome!='failed':raise SystemExit('DB에 주문이 없습니다. 배출 완료로 처리할 수 없습니다.')
 else:
  cancelled=cloud.rpc('cancel_unreceived_free_order',{'p_request_id':args.request})
  if cancelled.get('status')!='cancelled':raise SystemExit('지연된 DB 요청이 있습니다. 다시 조회하여 결과를 확인하세요.')
 with gateway.db() as db:db.execute('update requests set state=?,result=? where id=?',(args.outcome,json.dumps({'ok':args.outcome=='completed','requiresReview':False,'message':'관리자가 배출 결과를 확인했습니다.'}),args.request))
 print('결과 확인 완료. 키오스크에서 다시 누르면 이전 결과를 확인하고 잠금을 해제합니다.')
