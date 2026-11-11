import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

spec=importlib.util.spec_from_file_location('gateway',Path(__file__).with_name('server.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class FanSyncTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.cloud=Mock();self.motor=Mock()
  self.g=m.Gateway(self.cloud,self.motor,Path(self.tmp.name)/'journal.sqlite3',{'1':500})
  self.g.fan_path=Path(self.tmp.name)/'fan-settings.json'
  self.g.fan_settings={'temperatureOn':30,'humidityOn':70}
  self.sync=m.FanSettingsSync(self.g)
  self.cloud.rpc.return_value={'temperatureOn':28,'humidityOn':65}
 def tearDown(self):self.tmp.cleanup()
 def test_change_only_and_disk_cache(self):
  self.sync.fetch();self.sync.apply();self.sync.fetch();self.sync.apply()
  self.assertEqual(self.motor.configure_fan.call_count,1)
  self.assertTrue(self.g.fan_path.exists())
  self.cloud.rpc.return_value={'temperatureOn':29,'humidityOn':66}
  self.sync.fetch();self.sync.apply()
  self.assertEqual(self.motor.configure_fan.call_count,2)
 def test_busy_defers_and_latest_wins(self):
  self.g.lock.acquire()
  try:self.sync.fetch();self.sync.apply();self.motor.configure_fan.assert_not_called()
  finally:self.g.lock.release()
  self.cloud.rpc.return_value={'temperatureOn':27,'humidityOn':64}
  self.sync.fetch();self.sync.apply()
  self.motor.configure_fan.assert_called_once_with({'temperatureOn':27,'humidityOn':64})
 def test_usb_failure_retries_without_success_cache(self):
  self.sync.fetch();self.motor.configure_fan.side_effect=TimeoutError()
  with self.assertRaises(TimeoutError):self.sync.apply()
  self.assertIsNone(self.sync.applied)
  self.assertEqual(self.g.fan_settings,{'temperatureOn':30,'humidityOn':70})
  self.motor.configure_fan.side_effect=None;self.sync.apply()
  self.assertEqual(self.sync.applied,{'temperatureOn':28,'humidityOn':65})
 def test_bad_cloud_response_keeps_last_settings(self):
  self.sync.fetch();self.sync.apply()
  for bad in [None,{},[],{'temperatureOn':True,'humidityOn':50},{'temperatureOn':20,'humidityOn':101}]:
   self.cloud.rpc.return_value=bad
   with self.assertRaises(ValueError):self.sync.fetch()
  self.assertEqual(self.g.fan_settings,{'temperatureOn':28,'humidityOn':65})
  self.cloud.rpc.side_effect=OSError()
  with self.assertRaises(OSError):self.sync.fetch()
  self.assertEqual(self.g.fan_settings,{'temperatureOn':28,'humidityOn':65})
 def test_startup_reapplies_even_if_cached_same(self):
  self.g.fan_settings={'temperatureOn':28,'humidityOn':65}
  self.sync.fetch();self.sync.apply();self.motor.configure_fan.assert_called_once()

if __name__=='__main__':unittest.main()
