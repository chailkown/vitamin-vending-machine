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
  if (error?.code === 'email_not_confirmed') return '이메일 인증 후 로그인해주세요.';
  if (error?.code === 'invalid_credentials') return '이메일 또는 비밀번호를 확인해주세요.';
  if (error?.status === 429) return '요청이 많습니다. 잠시 후 다시 시도해주세요.';
  return error?.message || '서버에 연결하지 못했습니다. 다시 시도해주세요.';
};

export const authenticateMember = async ({mode,email,password,name}) => {
  const client = requireAuthClient();
  const {data,error} = mode === 'signup'
    ? await client.auth.signUp({email,password,options:{data:{name}}})
    : await client.auth.signInWithPassword({email,password});
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
