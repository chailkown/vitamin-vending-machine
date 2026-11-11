import { useEffect, useState } from 'react';
import { getFanThresholds, updateFanThresholds } from '../services/adminService';

export default function AdminEnvironment({ machineId, machineName }) {
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const thresholds = await getFanThresholds(machineId);
        if (!live) return;
        setSaved(thresholds);
        setValues(thresholds);
      } catch {
        if (live) setError('기준값을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해주세요.');
      }
    };
    load();
    return () => { live = false; };
  }, [attempt, machineId]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const thresholds = await updateFanThresholds(machineId, {
        temperatureOn: Number(values.temperatureOn),
        humidityOn: Number(values.humidityOn),
      });
      setSaved(thresholds);
      setValues(thresholds);
      setMessage('저장되었습니다.');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const dirty = values && (Number(values.temperatureOn) !== saved.temperatureOn ||
    Number(values.humidityOn) !== saved.humidityOn);

  return (
    <section className="admin-panel cooler-panel">
      <header className="cooler-header">
        <span>{machineName}</span>
        <h2>쿨러 켜짐 기준</h2>
        <p>쿨러가 켜지는 온도와 습도를 설정하세요.</p>
      </header>
      {values ? (
        <form className="cooler-form" onSubmit={save}>
          <div className="cooler-fields">
            <label>켜지는 온도
              <span><input required type="number" min="2" max="80" step="1" inputMode="numeric"
                value={values.temperatureOn} disabled={saving}
                onChange={event => setValues({ ...values, temperatureOn: event.target.value })} /><b aria-hidden="true">°C</b></span>
            </label>
            <label>켜지는 습도
              <span><input required type="number" min="5" max="100" step="1" inputMode="numeric"
                value={values.humidityOn} disabled={saving}
                onChange={event => setValues({ ...values, humidityOn: event.target.value })} /><b aria-hidden="true">%</b></span>
            </label>
          </div>
          <p className="cooler-note">온도와 습도가 모두 기준 이상이면 켜집니다. 켜진 뒤 온도가 기준보다 2°C 내려가거나 습도가 5%p 내려가면 꺼집니다.</p>
          <button className="cooler-save" type="submit" disabled={saving || !dirty}>{saving ? '저장 중…' : '기준값 저장'}</button>
        </form>
      ) : error ? (
        <button className="secondary-btn" type="button" onClick={()=>{setError('');setAttempt(attempt+1);}}>다시 불러오기</button>
      ) : <p role="status">기준값 불러오는 중…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
