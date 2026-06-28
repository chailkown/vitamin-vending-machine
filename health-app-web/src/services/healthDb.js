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

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || 'Supabase 요청에 실패했습니다.');
  }

  return data;
};

export const findAppUser = async (userId) => {
  const data = await request(`app_users?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  return data?.[0] || null;
};

export const findAppAdmin = async (userId) => {
  const data = await request(`app_admins?admin_id=eq.${encodeURIComponent(userId)}&select=*`);
  return data?.[0] || null;
};

export const createAppUser = async ({ userId, password, name }) => {
  const data = await request('app_users', {
    method: 'POST',
    body: JSON.stringify([{ user_id: userId, password, name }]),
  });
  return data?.[0] || null;
};

export const getHealthProfile = async (userId) => {
  const data = await request(`app_health_profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`);
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

  const profileRows = await request('app_health_profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([body]),
  });

  await request('app_qr_payloads', {
    method: 'POST',
    body: JSON.stringify([{
      user_id: userId,
      payload_hash: btoa(unescape(encodeURIComponent(JSON.stringify(kioskPayload)))).slice(0, 120),
      payload: kioskPayload,
      expires_at: new Date(Date.now() + 30 * 1000).toISOString(),
    }]),
  });

  return profileRows?.[0] || null;
};

export const getVendingMachines = async () => {
  const data = await request('app_vending_machines?select=*&order=created_at.asc');
  return data || [];
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
