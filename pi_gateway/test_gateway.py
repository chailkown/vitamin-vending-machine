import importlib.util,json,tempfile,unittest,uuid
from pathlib import Path
spec=importlib.util.spec_from_file_location('gateway',Path(__file__).with_name('server.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Cloud:
 def __init__(self):self.calls=[];self.reject=False;self.slot=1;self.finalize_fail=False
 def rpc(self,name,body):
  self.calls.append((name,body))
  if self.reject:raise m.Rejected('DB rejected')
  if name=='cancel_unreceived_free_order':return {'status':'cancelled'}
  if name in ('reserve_free_order','reserve_free_order_with_history'):return {'order_id':'11111111-1111-4111-8111-111111111111','status':'dispensing','items':[{'dispenser_slot':self.slot,'quantity':1}]}
  if self.finalize_fail:raise RuntimeError('lost')
  return {'status':body['p_result']}
class Motor:
 def __init__(self):self.runs=[];self.fail=False
 def run(self,slot,duration):
  self.runs.append((slot,duration))
  if self.fail:raise TimeoutError()
 def stop(self):pass
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'journal.sqlite3';self.cloud=Cloud();self.motor=Motor();self.g=m.Gateway(self.cloud,self.motor,self.path,{'1':100});self.data={'requestId':str(uuid.uuid4()),'items':[{'vitamin_id':3,'quantity':1}]}
 def tearDown(self):self.tmp.cleanup()
 def test_success_replay_never_reruns_motor(self):
  self.assertTrue(self.g.order(self.data)['ok']);self.assertTrue(self.g.order(self.data)['ok']);self.assertEqual(len(self.motor.runs),1);self.assertEqual([c[0] for c in self.cloud.calls],['reserve_free_order','finish_free_order'])
 def test_usb_unknown_blocks_restart_and_new_orders(self):
  self.motor.fail=True;self.assertTrue(self.g.order(self.data)['requiresReview']);again=m.Gateway(self.cloud,self.motor,self.path,{'1':100});self.data['requestId']=str(uuid.uuid4());self.assertTrue(again.order(self.data)['requiresReview']);self.assertEqual(len(self.motor.runs),1)
 def test_unmapped_slot_restores_without_running(self):
  self.cloud.slot=2;self.assertFalse(self.g.order(self.data)['ok']);self.assertEqual(self.motor.runs,[]);self.assertEqual(self.cloud.calls[-1][1]['p_result'],'failed')
 def test_db_reject_never_runs_motor(self):
  self.cloud.reject=True;r=self.g.order(self.data);self.assertFalse(r['ok']);self.assertFalse(r['requiresReview']);self.assertEqual(self.motor.runs,[])
 def test_finalize_error_stays_uncertain(self):
  self.cloud.finalize_fail=True;r=self.g.order(self.data);self.assertTrue(r['requiresReview']);self.assertEqual(len(self.motor.runs),1)
 def test_invalid_request_never_calls_db(self):
  self.data['items'][0]['quantity']=True;self.assertFalse(self.g.order(self.data)['ok']);self.assertEqual(self.cloud.calls,[])
 def test_qr_identity_is_rejected_before_db(self):
  self.data['qrProfile']={'id':'member'};self.assertFalse(self.g.order(self.data)['ok']);self.assertEqual(self.cloud.calls,[])
 def test_history_id_only_and_replay_owner_protected(self):
  self.data['historyUserId']=str(uuid.uuid4())
  self.assertTrue(self.g.order(self.data)['ok'])
  name,body=self.cloud.calls[0];self.assertEqual(name,'reserve_free_order_with_history')
  self.assertEqual(set(body),{'p_request_id','items','p_history_user_id'})
  self.data['historyUserId']=str(uuid.uuid4())
  self.assertTrue(self.g.order(self.data)['requiresReview']);self.assertEqual(len(self.motor.runs),1)
 def test_invalid_history_id_never_calls_db(self):
  self.data['historyUserId']='not-a-user-id';self.assertFalse(self.g.order(self.data)['ok']);self.assertEqual(self.cloud.calls,[])
 def test_cancel_unreceived_blocks_delayed_order_after_restart(self):
  result=self.g.reconcile(self.data['requestId']);self.assertFalse(result['requiresReview'])
  again=m.Gateway(self.cloud,self.motor,self.path,{'1':100})
  self.assertFalse(again.order(self.data)['ok']);self.assertEqual(self.motor.runs,[])
  self.assertEqual([c[0] for c in self.cloud.calls],['cancel_unreceived_free_order'])
 def test_reconcile_completed_never_dispenses(self):
  self.g.order(self.data);self.assertFalse(self.g.reconcile(self.data['requestId'])['requiresReview']);self.assertEqual(len(self.motor.runs),1)
 def test_changed_request_id_content_rejected(self):
  self.g.order(self.data);self.data['items'][0]['quantity']=2;self.assertTrue(self.g.order(self.data)['requiresReview']);self.assertEqual(len(self.motor.runs),1)
 def test_http_csrf_and_private_file_block(self):
  import threading,urllib.request,urllib.error
  root=Path(self.tmp.name)/'kiosk';root.mkdir();(root/'index.html').write_text('<html><head></head><body>kiosk</body></html>');(Path(self.tmp.name)/'device.json').write_text('secret')
  server=m.ThreadingHTTPServer(('127.0.0.1',0),m.handler_for(self.g,root,{f'127.0.0.1:0'}));port=server.server_address[1];server.RequestHandlerClass=m.handler_for(self.g,root,{f'127.0.0.1:{port}'})
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{port}'
  try:
   html=urllib.request.urlopen(base).read().decode();self.assertIn('kiosk-token',html);self.assertNotIn('secret',html)
   for request in [urllib.request.Request(base+'/device.json'),urllib.request.Request(base+'/api/order',data=b'{}',headers={'Content-Type':'application/json'},method='POST')]:
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(request)
    self.assertIn(error.exception.code,(403,404))
  finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
