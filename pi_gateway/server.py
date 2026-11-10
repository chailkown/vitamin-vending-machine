"""Free vending gateway. Device credential stays on Pi, never in browser assets."""
import argparse, hashlib, json, math, os, re, secrets, sqlite3, tempfile, threading, time, uuid
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MOTOR_PINS = (3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 26, 14, 15, 16, 17, 18, 19, 20, 21, 28)
from urllib.request import Request, urlopen
from urllib.error import HTTPError

class Rejected(Exception): pass
class Cloud:
 def __init__(self,config): self.config=config
 def verify_admin(self, token):
  if not re.fullmatch(r'[a-f0-9]{64}', token):
   return False
  payload={'p_token':token,'p_action':'list','p_data':{}}
  req=Request(self.config['supabase_url']+'/rest/v1/rpc/mobile_admin_action',
              data=json.dumps(payload).encode(), headers={'apikey':self.config['publishable_key'],
              'Content-Type':'application/json'}, method='POST')
  try:
   with urlopen(req,timeout=8) as response:
    return isinstance(json.load(response),list)
  except HTTPError as error:
   if error.code in (400,401,403):return False
   raise
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
 def environment(self):
  self.send('ENV')
  deadline=time.monotonic()+2
  while time.monotonic()<deadline:
   line=self.port.readline(128).decode('ascii',errors='replace').strip()
   if line.startswith('ERR '):raise RuntimeError('ENV unsupported')
   parts=line.split()
   if len(parts)!=6 or parts[0]!='ENV' or parts[4]!='FAN' or parts[5] not in ('0','1'):
    continue
   valid=parts[1]=='OK'
   temp,humidity=(float(parts[2]),float(parts[3])) if valid else (None,None)
   valid=valid and math.isfinite(temp) and math.isfinite(humidity)
   return {'sensorOk':valid,'temperature':temp if valid else None,
           'humidity':humidity if valid else None,'fanOn':parts[5]=='1'}
  raise TimeoutError('ENV response missing')
 def configure_fan(self, settings):
  values=f"{settings['temperatureOn']} {settings['humidityOn']}"
  self.send('FANCFG '+values)
  self.wait('FANCFG OK '+values,2)
 def stop(self):self.send('STOP')

class Gateway:
 def __init__(self,cloud,motor,journal,durations):
  self.cloud=cloud;self.motor=motor;self.journal=str(journal);self.durations={int(k):int(v) for k,v in durations.items()};self.lock=threading.Lock()
  if any(k not in range(1,21) or v not in range(100,5001) for k,v in self.durations.items()):raise ValueError('Invalid motor mapping')
  self.active_motor=None
  self.recent_motors=()
  with self.db() as db:db.execute('create table if not exists requests(id text primary key,fingerprint text not null,state text not null,order_id text,result text)')
 @contextmanager
 def db(self):
  connection=sqlite3.connect(self.journal)
  try:
   with connection:yield connection
  finally:connection.close()
 def record(self,rid,fp,state,order_id=None,result=None):
  with self.db() as db:db.execute('insert into requests values(?,?,?,?,?) on conflict(id) do update set state=excluded.state,order_id=excluded.order_id,result=excluded.result',(rid,fp,state,order_id,json.dumps(result) if result else None))
 def read_environment(self):
  if not self.lock.acquire(False):
   return {'busy':True,'activeMotor':self.active_motor,'recentMotors':self.recent_motors}
  try:
   return {**self.motor.environment(),'thresholds':self.fan_settings,
           'activeMotor':self.active_motor,'recentMotors':self.recent_motors,
           'machine':self.cloud.config.get('machine_name') or '자판기 '+self.cloud.config['device_id'][:8]}
  finally:self.lock.release()
 def change_fan(self, settings):
  if set(settings)!={'temperatureOn','humidityOn'}:
   raise ValueError('온도와 습도 기준을 입력해주세요.')
  temp,humidity=settings['temperatureOn'],settings['humidityOn']
  if type(temp) is not int or type(humidity) is not int or not 2<=temp<=80 or not 5<=humidity<=100:
   raise ValueError('온도 2~80℃, 습도 5~100%의 정수를 입력해주세요.')
  if not self.lock.acquire(False):
   return {'busy':True}
  temp_path=None
  try:
   with tempfile.NamedTemporaryFile(mode='w',dir=self.fan_path.parent,delete=False) as pending:
    temp_path=Path(pending.name)
    json.dump(settings,pending)
   self.motor.configure_fan(settings)
   try:
    os.replace(temp_path,self.fan_path)
   except OSError:
    self.motor.configure_fan(self.fan_settings)
    raise
   self.fan_settings=settings
   return {'thresholds':settings}
  finally:
   try:
    if temp_path is not None:temp_path.unlink(missing_ok=True)
   finally:self.lock.release()
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
    started=True
    duration=self.durations[slot]
    command={'slot':slot,'pin':MOTOR_PINS[slot - 1],'durationMs':duration}
    self.active_motor=command
    result='unconfirmed'
    try:
     self.motor.run(slot,duration)
     result='done'
    finally:
     entry={**command,'result':result,'endedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
     self.recent_motors=(entry,*self.recent_motors[:9])
     self.active_motor=None
    time.sleep(.3)
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
  def environment_origin(self):
   origin=self.headers.get('Origin')
   host=self.headers.get('Host','').rsplit(':',1)[0]
   return origin if origin==f'http://{host}:3001' else None
  def environment_reply(self,status,data):
   body=json.dumps(data,ensure_ascii=False).encode()
   self.send_response(status)
   self.send_header('Content-Type','application/json; charset=utf-8')
   self.send_header('Content-Length',str(len(body)))
   self.send_header('Cache-Control','no-store')
   self.send_header('Vary','Origin')
   origin=self.environment_origin()
   if origin:self.send_header('Access-Control-Allow-Origin',origin)
   self.end_headers()
   self.wfile.write(body)
  def do_OPTIONS(self):
   if self.path!='/api/environment' or not self.valid() or not self.environment_origin():
    return self.reply(403,{})
   self.send_response(204)
   self.send_header('Access-Control-Allow-Origin',self.environment_origin())
   self.send_header('Access-Control-Allow-Methods','GET, POST')
   self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization')
   self.send_header('Vary','Origin')
   self.end_headers()
  def valid(self):
   address,port=self.connection.getsockname()[:2]
   return self.headers.get('Host') in hosts or self.headers.get('Host')==f'{address}:{port}'
  def control(self):return self.client_address[0] in ('127.0.0.1','::1') and self.headers.get('X-Kiosk-Token')==token
  def do_GET(self):
   if not self.valid():return self.reply(403,{'message':'허용되지 않은 주소'})
   if self.path.startswith('/api/order-status?'):
    if not self.control():return self.reply(403,{})
    from urllib.parse import parse_qs,urlsplit
    rid=parse_qs(urlsplit(self.path).query).get('requestId',[''])[0];return self.reply(200,gateway.status(rid))
   if self.path=='/api/environment':
    try:return self.environment_reply(200,gateway.read_environment())
    except (OSError,RuntimeError,ValueError,AttributeError):
     return self.environment_reply(503,{'message':'온습도 응답을 확인하지 못했습니다.'})
   if self.path=='/api/health':return self.reply(200,{'ok':True,'mode':'free','slots':sorted(gateway.durations)})
   if self.path in ('/','/index.html'):
    html=(static_root/'index.html').read_text();return self.reply(200,html.replace('<head>','<head><meta name="kiosk-token" content="'+token+'">'),'text/html; charset=utf-8')
   if not (self.path.startswith('/static/') or self.path.startswith('/screen/') or self.path in ('/favicon.ico','/manifest.json','/logo192.png','/logo512.png','/robots.txt')):return self.reply(404,{})
   if '..' in self.path or '%' in self.path and '%2e' in self.path.lower():return self.reply(404,{})
   return super().do_GET()
  def do_POST(self):
   if self.path=='/api/environment':
    if not self.valid() or not self.environment_origin():
     return self.environment_reply(403,{'message':'허용되지 않은 주소입니다.'})
    try:
     size=int(self.headers.get('Content-Length','0'))
     if not 0<size<=512:raise ValueError('설정 형식을 확인해주세요.')
     token=self.headers.get('Authorization','').removeprefix('Bearer ')
     if not gateway.cloud.verify_admin(token):
      return self.environment_reply(403,{'message':'관리자로 다시 로그인해주세요.'})
     data=json.loads(self.rfile.read(size))
     if not isinstance(data,dict):raise ValueError('설정 형식을 확인해주세요.')
     return self.environment_reply(200,gateway.change_fan(data))
    except ValueError as error:return self.environment_reply(400,{'message':str(error)})
    except (OSError,RuntimeError,AttributeError):
     return self.environment_reply(503,{'message':'팬 설정을 적용하지 못했습니다. Mega 펌웨어와 연결을 확인해주세요.'})
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
  gateway.fan_path=Path(args.config).with_name('fan-settings.json')
  gateway.fan_settings={'temperatureOn':30,'humidityOn':70}
  if gateway.fan_path.exists():
   settings=json.loads(gateway.fan_path.read_text())
   motor.configure_fan(settings)
   gateway.fan_settings=settings
  hosts={f'localhost:{args.port}',f'127.0.0.1:{args.port}',f'raspberrypi.local:{args.port}'}
  server=ThreadingHTTPServer(('0.0.0.0',args.port),handler_for(gateway,root/'kiosk',hosts))
  print('무료 배출 키오스크: http://localhost:'+str(args.port),flush=True)
  print('모터1~20: D3~D21 (11번 D26, 20번 D28) / DHT22: D2 / 팬: D23. 실제 낙하는 수령구에서 확인합니다.',flush=True)
  try:server.serve_forever()
  except KeyboardInterrupt:pass
  finally:motor.stop();server.server_close()
if __name__=='__main__':main()
