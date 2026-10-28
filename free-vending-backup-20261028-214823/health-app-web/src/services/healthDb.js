import { requireAuthClient } from './authClient';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isHealthDbConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const request = async (path, options = {}) => {
  if (!isHealthDbConfigured) {
    throw new Error('Supabase 앱 DB 환경변수가 없습니다.');
  }

  const { data: { session }, error: sessionError } = await requireAuthClient().auth.getSession();
  if (sessionError) throw sessionError;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      ...headers,
      Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || 'Supabase 요청에 실패했습니다.');
  }

  return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('서버 응답이 지연됩니다. 연결을 확인하고 다시 시도해주세요.');
    throw error;
  } finally { clearTimeout(timeout); }
};

export const getHealthProfile = async (userId) => {
  const data = await request(`member_health_profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  return data?.[0] || null;
};

export const saveHealthProfile = async ({ userId, profile, kioskPayload }) => {
  const body = {
    user_id: userId,
    name: profile.name,
    age: Number(profile.age),
    gender: profile.gender,
    height: Number(profile.height),
    weight: Number(profile.weight),
    smoking_status: profile.smoking === '흡연 중',
    alcohol_level: profile.alcohol,
    conditions: profile.conditions,
    allergies: profile.allergies,
    medications: profile.medications,
    qr_payload: kioskPayload,
    updated_at: new Date().toISOString(),
  };

  const profileRows = await request('member_health_profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([body]),
  });

  // QR expiration belongs to the newly generated QR itself, not the profile save time.
  if (!profileRows?.[0]) throw new Error('저장 결과를 확인하지 못했습니다. 다시 시도해주세요.');
  return profileRows[0];
};

export const getVendingMachines = async () => {
  const data = await request('app_vending_machines?select=*&order=created_at.asc');
  return data || [];
};

export const getPurchaseHistory = async (userId) => {
  if (!userId) throw new Error('다시 로그인해주세요.');
  const rows = await request(`orders?user_id=eq.${encodeURIComponent(userId)}&status=eq.completed&select=*,order_items(*)&order=completed_at.desc`);
  if (!Array.isArray(rows)) throw new Error('구매 내역 응답을 확인할 수 없습니다.');
  return rows.filter((order) => order.user_id === userId && order.status === 'completed');
};

export const saveVendingMachine = async (machine) => {
  const body = {
    machine_id: machine.id,
    name: machine.name,
    address: machine.address,
    latitude: Number(machine.lat),
    longitude: Number(machine.lng),
    status: machine.status,
    updated_at: new Date().toISOString(),
  };

  const rows = await request('app_vending_machines?on_conflict=machine_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([body]),
  });
  return rows?.[0] || null;
};

export const deleteVendingMachine = async (machineId) => {
  await request(`app_vending_machines?machine_id=eq.${encodeURIComponent(machineId)}`, {
    method: 'DELETE',
  });
};

export const mapDbProfileToAppProfile = (row, fallbackProfile) => {
  if (!row) return fallbackProfile;
  return {
    ...fallbackProfile,
    name: row.name || fallbackProfile.name,
    age: String(row.age ?? fallbackProfile.age),
    gender: row.gender || fallbackProfile.gender,
    height: String(row.height ?? fallbackProfile.height),
    weight: String(row.weight ?? fallbackProfile.weight),
    smoking: row.smoking_status ? '흡연 중' : '비흡연',
    alcohol: row.alcohol_level || fallbackProfile.alcohol,
    conditions: Array.isArray(row.conditions) ? row.conditions : fallbackProfile.conditions,
    allergies: row.allergies || fallbackProfile.allergies,
    medications: row.medications || fallbackProfile.medications,
  };
};

export const mapDbMachineToAppMachine = (row) => ({
  id: row.machine_id,
  name: row.name,
  address: row.address,
  lat: Number(row.latitude),
  lng: Number(row.longitude),
  status: row.status,
});
