const PENDING_KEY='vitamin-kiosk-pending-order';
let inFlight=false;
export const placeOrder=async(cart,options={})=>{
  if(inFlight)return {ok:false,code:'ORDER_BUSY',message:'이미 배출 중입니다.'};
  if(!Array.isArray(cart)||!cart.length||cart.some(({product,qty})=>!Number.isSafeInteger(product?.id)||!Number.isInteger(qty)||qty<1)||cart.reduce((n,it)=>n+it.qty,0)>5)return {ok:false,code:'INVALID_CART',message:'한 번에 1~5개를 선택해주세요.'};
  const storage=window.localStorage;
  const token=document.querySelector('meta[name="kiosk-token"]')?.content;
  if(!token)return {ok:false,code:'GATEWAY_UNAVAILABLE',message:'라즈베리파이 배출 서버로 키오스크를 열어주세요.'};
  const pending=storage.getItem(PENDING_KEY);
  if(pending){
    try{
      const reference=JSON.parse(pending);
      const response=await fetch('/api/order-status?requestId='+encodeURIComponent(reference.requestId),{headers:{'X-Kiosk-Token':token}});
      const status=await response.json();
      if(status.known&&!status.requiresReview){storage.removeItem(PENDING_KEY);return {ok:false,code:'RECOVERED',message:'이전 배출 결과 확인을 마쳤습니다. 현재 선택을 확인한 뒤 다시 눌러주세요.'};}
    }catch{}
    return {ok:false,code:'RECOVERY_REQUIRED',requiresReview:true,message:'이전 배출 결과를 관리자가 확인해야 합니다.'};
  }
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  const requestId=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  inFlight=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),60000);
  try{
    storage.setItem(PENDING_KEY,JSON.stringify({requestId}));
    const response=await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json','X-Kiosk-Token':token},signal:controller.signal,
      body:JSON.stringify({requestId,items:cart.map(({product,qty})=>({vitamin_id:product.id,quantity:qty})),qrProfile:options.qrProfile||null})});
    const result=await response.json();
    if(!result.requiresReview)storage.removeItem(PENDING_KEY);
    return result;
  }catch{return {ok:false,code:'RECOVERY_REQUIRED',requiresReview:true,message:'배출 결과를 확인하지 못했습니다. 자동 재배출하지 않습니다. 관리자에게 문의해주세요.'};}
  finally{inFlight=false;clearTimeout(timeout);}
};
