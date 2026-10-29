const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
let token = null;
const rpc = async (name, body) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method:'POST', signal:controller.signal,
      headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data?.error) throw new Error(data?.error || data?.message || '관리자 요청에 실패했습니다.');
    return data;
  } finally { clearTimeout(timeout); }
};
export const loginAdmin = async (username,password) => {
  token = null;
  const data = await rpc('mobile_admin_login',{p_username:username,p_password:password});
  if (!/^[a-f0-9]{64}$/.test(data?.token || '')) throw new Error('관리자 인증 결과를 확인할 수 없습니다.');
  token = data.token;
};
export const adminAction = async (action,data={}) => {
  if (!token) throw new Error('관리자로 다시 로그인해주세요.');
  return rpc('mobile_admin_action',{p_token:token,p_action:action,p_data:data});
};
export const logoutAdmin = async () => {
  try { if (token) await adminAction('logout'); } finally { token = null; }
};
export const inventoryRequestId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
