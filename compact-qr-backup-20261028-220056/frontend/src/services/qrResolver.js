import { supabase, isSupabaseConfigured } from '../config/supabase';
import { parseQrPayload } from './qrPayload';
export const resolveQrPayload = async (raw) => {
  if(typeof raw!=='string'||raw.length>1800)return {ok:false,message:'QR 데이터가 올바르지 않습니다.'};
  let value;
  try { value=JSON.parse(raw); } catch { return parseQrPayload(raw); }
  if(value?.type !== 'vitamin-token') return parseQrPayload(raw);
  if(value.version!==1 || !/^[a-f0-9]{64}$/.test(value.token || '')) return {ok:false,message:'유효하지 않은 QR입니다.'};
  if(!isSupabaseConfigured || !supabase) return {ok:false,message:'QR 확인에 인터넷 연결이 필요합니다.'};
  const {data,error}=await supabase.rpc('resolve_member_qr',{p_token:value.token});
  if(error) return {ok:false,message:'QR이 변경되었거나 연결에 실패했습니다. 휴대폰에서 새 QR을 만들어주세요.'};
  const result=parseQrPayload(data);
  return result.ok ? {...result,credential:value.token} : result;
};
