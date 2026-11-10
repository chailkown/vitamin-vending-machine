import { useEffect, useState } from 'react';
import { updateFanThresholds } from '../services/adminService';

const endpoint = new URL('/api/environment', window.location.href);
if (!document.querySelector('meta[name="vitamin-env-proxy"]')) endpoint.port = '3000';

export default function AdminEnvironment({ machineName }) {
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        const data = await response.json();
        if (!response.ok || !data.thresholds) throw new Error('기준값을 불러오지 못했어요.');
        if (controller.signal.aborted) return;
        setSaved(data.thresholds);
        setValues(data.thresholds);
      } catch {
        if (!controller.signal.aborted) setError('기준값을 불러오지 못했어요. 기기 연결을 확인하고 다시 시도해 주세요.');
      }
    };
    load();
    return () => controller.abort();
  }, [attempt]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const thresholds = await updateFanThresholds(endpoint, {
        temperatureOn: Number(values.temperatureOn),
        humidityOn: Number(values.humidityOn),
      });
      setSaved(thresholds);
      setValues(thresholds);
      setMessage('쿨러 기준값을 저장했어요.');
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
          <p className="cooler-note">두 기준을 모두 넘을 때만 켜는 조건은 기기 펌웨어 업데이트 후 적용돼요. 현재는 한 기준에 도달하면 켜집니다.</p>
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
