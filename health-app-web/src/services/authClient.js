import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
export const authClient = url && key ? createClient(url, key) : null;
export const requireAuthClient = () => {
  if (!authClient) throw new Error('서버 연결 설정이 없습니다. 관리자에게 문의해주세요.');
  return authClient;
};
export const memberSession = (user) => ({userId:user.id, name:user.user_metadata?.name || '', isAdmin:false});
export const authErrorMessage = (error) => {
  if (error?.code === 'email_not_confirmed') return '계정 활성화 상태를 관리자에게 문의해주세요.';
  if (error?.code === 'invalid_credentials') return '아이디 또는 비밀번호를 확인해주세요.';
  if (error?.status === 429) return '요청이 많습니다. 잠시 후 다시 시도해주세요.';
  return error?.message || '서버에 연결하지 못했습니다. 다시 시도해주세요.';
};

export const authenticateMember = async ({mode,username,password,name}) => {
  const client = requireAuthClient();
  const loginId = (username ?? '').trim().toLowerCase();
  const legacyLogin = mode === 'login' && loginId.includes('@');
  if (!legacyLogin && !/^[a-z0-9][a-z0-9_-]{2,23}$/.test(loginId)) {
    throw new Error('아이디는 영문 또는 숫자로 시작하는 3~24자이며, 영문·숫자·밑줄·하이픈을 사용할 수 있습니다.');
  }
  const address = legacyLogin ? loginId : loginId + '@id.vitamin-vending.example.com';
  if (mode === 'signup') {
    const settings = await fetch(url + '/auth/v1/settings', {headers:{apikey:key}, signal:AbortSignal.timeout(8000)});
    if (!settings.ok || (await settings.json()).mailer_autoconfirm !== true) {
      throw new Error('지금은 가입을 완료할 수 없어요.');
    }
  }
  const {data,error} = mode === 'signup'
    ? await client.auth.signUp({email:address,password,options:{data:{name}}})
    : await client.auth.signInWithPassword({email:address,password});
  if (error?.code === 'user_already_exists' || error?.code === 'email_exists') {
    throw new Error('이미 사용 중인 아이디예요.');
  }
  if (error) throw error;
  return data;
};

export const verifySignupLink = async (link) => {
  let parsed;
  try {parsed=new URL(link.trim());} catch {throw new Error('인증 메일의 링크 전체를 붙여넣어주세요.');}
  if(parsed.origin!==new URL(url).origin || parsed.pathname!=='/auth/v1/verify' || parsed.searchParams.get('type')!=='signup') throw new Error('이 프로젝트의 회원가입 인증 링크만 사용할 수 있습니다.');
  const hash=parsed.searchParams.get('token');
  if(!hash || !/^[a-f0-9]{32,128}$/i.test(hash)) throw new Error('인증 링크 형식이 올바르지 않습니다.');
  const {data,error}=await requireAuthClient().auth.verifyOtp({token_hash:hash,type:'signup'});
  if(error)throw error;
  return data;
};
