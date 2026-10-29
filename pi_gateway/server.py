"""Free vending gateway. Device credential stays on Pi, never in browser assets."""
import argparse, hashlib, json, os, secrets, socket, sqlite3, threading, time, uuid
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

class Rejected(Exception): pass
class Cloud:
 def __init__(self,config): self.config=config
 def rpc(self,name,data):
  payload=dict(data,p_device_id=self.config['device_id'],p_device_token=self.config['device_token'])
  req=Request(self.config['supabase_url']+'/rest/v1/rpc/'+name,data=json.dumps(payload).encode(),headers={'apikey':self.config['publishable_key'],'Content-Type':'application/json'},method='POST')
  try:
   with urlopen(req,timeout=15) as response: return json.load(response)
  except HTTPError as error:
   if error.code in (400,401,403,404): raise Rejected('DB가 요청을 거절했습니다. 상품 연결·재고·QR을 확인해주세요.') from None
   raise RuntimeError('DB 응답 불확실') from None

class Motor:
 def __init__(self,port):
  self.port=port;time.sleep(2.5);port.reset_input_buffer()
  for command,expected in [('PING','PONG MOTOR20_V1'),('STOP','STOPPED'),('STATUS','STATUS IDLE')]: self.send(command);self.wait(expected,3)
 def send(self,line): self.port.write((line+'\n').encode('ascii'))
 def wait(self,expected,seconds):
  deadline=time.monotonic()+seconds
  while time.monotonic()<deadline:
   line=self.port.readline(128).decode('ascii',errors='replace').strip()
   if line==expected:return
   if line.startswith('ERR '):raise RuntimeError('Arduino command rejected')
  raise TimeoutError('Arduino response missing')
 def run(self,slot,duration):
  self.port.reset_input_buffer();self.send(f'RUN {slot} {duration}');self.wait(f'STARTED {slot}',2);self.wait(f'DONE {slot}',duration/1000+2)
 def stop(self):self.send('STOP')

class Gateway:
 def __init__(self,cloud,motor,journal,durations):
  self.cloud=cloud;self.motor=motor;self.journal=str(journal);self.durations={int(k):int(v) for k,v in durations.items()};self.lock=threading.Lock()
  if any(k not in range(1,21) or v not in range(100,5001) for k,v in self.durations.items()):raise ValueError('Invalid motor mapping')
  with self.db() as db:db.execute('create table if not exists requests(id text primary key,fingerprint text not null,state text not null,order_id text,result text)')
 @contextmanager
 def db(self):
  connection=sqlite3.connect(self.journal)
  try:
   with connection:yield connection
  finally:connection.close()
 def record(self,rid,fp,state,order_id=None,result=None):
  with self.db() as db:db.execute('insert into requests values(?,?,?,?,?) on conflict(id) do update set state=excluded.state,order_id=excluded.order_id,result=excluded.result',(rid,fp,state,order_id,json.dumps(result) if result else None))
 def status(self,rid):
  with self.db() as db:row=db.execute('select state,result from requests where id=?',(rid,)).fetchone()
  if not row:return {'known':False,'requiresReview':True}
  return {'known':True,'state':row[0],'requiresReview':row[0] not in ('completed','failed','cancelled'),'result':json.loads(row[1]) if row[1] else None}
 def reconcile(self,rid):
  try:rid=str(uuid.UUID(rid))
  except (ValueError,TypeError,AttributeError):return {'known':False,'requiresReview':True}
  if not self.lock.acquire(False):return {'known':False,'requiresReview':True}
  try:
   status=self.status(rid)
   if status['known']:return status
   # A DB tombstone uses the same advisory lock as reservation. A delayed
   # POST can never reserve or run after this cancellation is acknowledged.
   result=self.cloud.rpc('cancel_unreceived_free_order',{'p_request_id':rid})
   if result.get('status')!='cancelled':return {'known':False,'requiresReview':True}
   self.record(rid,'','cancelled',result={'ok':False,'requiresReview':False,'message':'접수되지 않은 요청을 취소했습니다.'})
   return self.status(rid)
  except Exception:return {'known':False,'requiresReview':True}
  finally:self.lock.release()
 def order(self,data):
  try:
   if not isinstance(data,dict) or set(data) not in ({'requestId','items'},{'requestId','items','historyUserId'}):raise ValueError()
   history_user=str(uuid.UUID(data['historyUserId'])) if 'historyUserId' in data else None
   rid=str(uuid.UUID(data['requestId']));items=data['items']
   if not isinstance(items,list) or not 1<=len(items)<=20:raise ValueError()
   if any(not isinstance(i,dict) or type(i.get('vitamin_id')) is not int or i['vitamin_id']<1 or type(i.get('quantity')) is not int or not 1<=i['quantity']<=5 for i in items):raise ValueError()
   if sum(i['quantity'] for i in items)>5:raise ValueError()
  except (KeyError,ValueError,TypeError,AttributeError):return {'ok':False,'message':'요청 형식이 잘못됐습니다.','requiresReview':False}
  fp=hashlib.sha256(json.dumps({'items':items,'historyUserId':history_user} if history_user else items,sort_keys=True).encode()).hexdigest()
  if not self.lock.acquire(False):return {'ok':False,'message':'배출 중입니다. 잠시 기다려주세요.','requiresReview':False}
  order_id=None;started=False
  try:
   with self.db() as db:
    old=db.execute('select fingerprint,state,result from requests where id=?',(rid,)).fetchone()
    unresolved=db.execute("select count(*) from requests where state not in ('completed','failed','cancelled')").fetchone()[0]
   if old:
    if old[1]=='cancelled':return {'ok':False,'requiresReview':False,'message':'취소된 요청입니다. 새로 구매해주세요.'}
    if old[0]!=fp:return {'ok':False,'requiresReview':True,'message':'동일 요청의 내용이 변경되었습니다.'}
    if old[2]:return json.loads(old[2])
    return {'ok':False,'requiresReview':True,'message':'이전 배출 결과를 관리자가 확인해야 합니다.'}
   if unresolved:return {'ok':False,'requiresReview':True,'message':'미확정 배출이 있습니다. 관리자 확인 전에는 배출할 수 없습니다.'}
   self.record(rid,fp,'reserving')
   try:
    payload={'p_request_id':rid,'items':items}
    if history_user:payload['p_history_user_id']=history_user
    receipt=self.cloud.rpc('reserve_free_order_with_history' if history_user else 'reserve_free_order',payload)
   except Rejected as error:
    result={'ok':False,'requiresReview':False,'message':str(error)};self.record(rid,fp,'failed',result=result);return result
   order_id=receipt['order_id']
   if receipt.get('replayed') or receipt.get('status')!='dispensing':raise RuntimeError('Already reserved without local confirmation')
   self.record(rid,fp,'reserved',order_id)
   sequence=[]
   for item in receipt['items']:
    slot=item['dispenser_slot'];qty=item['quantity']
    if slot not in self.durations or type(qty)is not int or qty<1:raise Rejected('모터 설정을 확인해주세요.')
    sequence += [slot]*qty
   if not sequence or len(sequence)>5:raise Rejected('배출 수량 오류')
   self.record(rid,fp,'running',order_id)
   for slot in sequence:
    started=True;self.motor.run(slot,self.durations[slot]);time.sleep(.3)
   finished=self.cloud.rpc('finish_free_order',{'p_order_id':order_id,'p_request_id':rid,'p_result':'completed'})
   if finished.get('status')!='completed':raise RuntimeError('Finalize failed')
   result={'ok':True,'requiresReview':False,'orderId':order_id,'totalQty':len(sequence),'message':'배출 명령을 완료했습니다. 수령구에서 영양제를 확인해주세요.'}
   self.record(rid,fp,'completed',order_id,result);return result
  except Rejected as error:
   if order_id and not started:
    try:
     self.cloud.rpc('finish_free_order',{'p_order_id':order_id,'p_request_id':rid,'p_result':'failed'})
     result={'ok':False,'requiresReview':False,'message':str(error)};self.record(rid,fp,'failed',order_id,result);return result
    except Exception:pass
   result={'ok':False,'requiresReview':True,'message':'결과 확인이 필요합니다. 자동 재배출하지 않습니다.'};self.record(rid,fp,'unknown',order_id,result);return result
  except Exception:
   try:self.motor.stop()
   except Exception:pass
   if order_id:
    try:self.cloud.rpc('finish_free_order',{'p_order_id':order_id,'p_request_id':rid,'p_result':'review_required'})
    except Exception:pass
   result={'ok':False,'requiresReview':True,'message':'배출 결과 또는 DB 기록을 확인하지 못했습니다. 관리자에게 문의해주세요.'}
   self.record(rid,fp,'unknown',order_id,result);return result
  finally:self.lock.release()

def handler_for(gateway,static_root,hosts):
 token=secrets.token_urlsafe(32)
 class Handler(SimpleHTTPRequestHandler):
  def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(static_root),**kwargs)
  def log_message(self,*args):pass
  def reply(self,status,data,content_type='application/json; charset=utf-8'):
   body=data.encode() if isinstance(data,str) else json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Frame-Options','DENY');self.end_headers();self.wfile.write(body)
  def valid(self):return self.headers.get('Host') in hosts
  def control(self):return self.client_address[0] in ('127.0.0.1','::1') and self.headers.get('X-Kiosk-Token')==token
  def do_GET(self):
   if not self.valid():return self.reply(403,{'message':'허용되지 않은 주소'})
   if self.path.startswith('/api/order-status?'):
    if not self.control():return self.reply(403,{})
    from urllib.parse import parse_qs,urlsplit
    rid=parse_qs(urlsplit(self.path).query).get('requestId',[''])[0];return self.reply(200,gateway.status(rid))
   if self.path=='/api/health':return self.reply(200,{'ok':True,'mode':'free','slots':sorted(gateway.durations)})
   if self.path in ('/','/index.html'):
    html=(static_root/'index.html').read_text();return self.reply(200,html.replace('<head>','<head><meta name="kiosk-token" content="'+token+'">'),'text/html; charset=utf-8')
   if not (self.path.startswith('/static/') or self.path.startswith('/screen/') or self.path in ('/favicon.ico','/manifest.json','/logo192.png','/logo512.png','/robots.txt')):return self.reply(404,{})
   if '..' in self.path or '%' in self.path and '%2e' in self.path.lower():return self.reply(404,{})
   return super().do_GET()
  def do_POST(self):
   if not self.valid() or not self.control() or self.headers.get('Origin')!='http://'+self.headers.get('Host',''):return self.reply(403,{'ok':False,'message':'라즈베리파이 화면에서만 배출할 수 있습니다.'})
   if self.path not in ('/api/order','/api/reconcile'):return self.reply(404,{})
   try:
    size=int(self.headers.get('Content-Length','0'))
    if size<1 or size>8192 or self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError()
    data=json.loads(self.rfile.read(size))
    if not isinstance(data,dict):raise ValueError()
   except (ValueError,TypeError):return self.reply(400,{'ok':False,'message':'요청 형식 오류'})
   if self.path=='/api/reconcile':return self.reply(200,gateway.reconcile(data.get('requestId')))
   return self.reply(200,gateway.order(data))
 return Handler

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--config',default=str(Path(__file__).with_name('device.json')));parser.add_argument('--port',type=int,default=3000);args=parser.parse_args()
 config=json.loads(Path(args.config).read_text());root=Path(__file__).parent
 import fcntl
 singleton=(root/'gateway.lock').open('a')
 try:fcntl.flock(singleton,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:raise SystemExit('다른 서버 또는 복구 작업이 실행 중입니다.')
 import serial
 with serial.Serial(config['serial_port'],115200,timeout=.1,write_timeout=1,exclusive=True) as port:
  motor=Motor(port);gateway=Gateway(Cloud(config),motor,root/'journal.sqlite3',config['durations'])
  ips=socket.gethostbyname_ex(socket.gethostname())[2];hosts={f'localhost:{args.port}',f'127.0.0.1:{args.port}',f'raspberrypi.local:{args.port}'}|{f'{ip}:{args.port}' for ip in ips}
  import subprocess
  for ip in subprocess.check_output(['hostname','-I'],text=True).split():hosts.add(f'{ip}:{args.port}')
  server=ThreadingHTTPServer(('0.0.0.0',args.port),handler_for(gateway,root/'kiosk',hosts))
  print('무료 배출 키오스크: http://localhost:'+str(args.port),flush=True)
  print('모터1~20: D3~D22 (11번은 D24) / DHT22: D2 / 팬: D23. 실제 낙하는 수령구에서 확인합니다.',flush=True)
  try:server.serve_forever()
  except KeyboardInterrupt:pass
  finally:motor.stop();server.server_close()
if __name__=='__main__':main()
