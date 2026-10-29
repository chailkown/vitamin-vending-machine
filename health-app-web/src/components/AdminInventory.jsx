import {useEffect,useRef,useState} from 'react';
import {adminAction,inventoryRequestId} from '../services/adminService';

export default function AdminInventory({hidden=false}) {
  const [products,setProducts]=useState([]),[values,setValues]=useState({});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [pending,setPending]=useState(null);
  const lock=useRef(false);
  const refresh=async()=>{
    const rows=await adminAction('list');
    if(!Array.isArray(rows))throw new Error('재고 목록을 확인할 수 없습니다.');
    setProducts(rows);
  };
  useEffect(()=>{let live=true;adminAction('list').then(rows=>{
    if(!Array.isArray(rows))throw new Error('재고 목록 오류');
    if(live)setProducts(rows);
  }).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  const save=async(product,action,retry=null)=>{
    if(lock.current)return;
    const input=values[product?.id]??'';
    if(!retry && (!/^\d{1,6}$/.test(input) || (action==='add' && Number(input)<1))){setError('입고는 1개 이상, 재고 수정은 0 이상의 정수로 입력해주세요.');return;}
    const operation=retry || {action,data:{id:product.id,quantity:Number(input),expected:product.stock,requestId:inventoryRequestId()}};
    lock.current=true;setBusy(true);setError('');setMessage('');setPending(operation);
    try {
      const result=await adminAction(operation.action,operation.data);
      if(result?.ok!==true)throw new Error('저장 결과를 확인할 수 없습니다.');
      setPending(null);setValues(prev=>({...prev,[operation.data.id]:''}));
      setMessage(`DB 저장 완료 · 재고 ${result.stock}개`);
      await refresh();
    } catch(e) {setError(`${e.message} 결과가 불명확하면 같은 요청 확인을 눌러주세요.`);}
    finally {lock.current=false;setBusy(false);}
  };
  return <section className="admin-panel admin-inventory" aria-label="재고 관리" hidden={hidden}>
    <h2>영양제 재고 관리</h2>
    <p>활성 상품 {products.length}개 · 입고는 추가 수량, 재고 수정은 실제 남은 총수량입니다.</p>
    <button type="button" disabled={busy} onClick={async()=>{setError('');try{await refresh();}catch(e){setError(e.message);}}}>재고 새로고침</button>
    {message && <p role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {pending && <div className="admin-actions">
      <button type="button" disabled={busy} onClick={()=>save(null,null,pending)}>같은 요청 결과 확인</button>
      <button type="button" disabled={busy} onClick={async()=>{try{await refresh();setPending(null);setError('');setMessage('최신 재고를 불러왔습니다. 입고가 이미 반영됐는지 확인 후 입력하세요.');}catch(e){setError(e.message);}}}>최신 재고 확인 후 다시 입력</button>
    </div>}
    {products.map(product=><article className="machine-admin-card" key={product.id}>
      <div><strong>{product.name}</strong><span>{product.category} · 슬롯 {product.dispenser_slot??'미지정'}</span><strong>현재 재고 {product.stock}개</strong></div>
      <div className="admin-form">
        <label>수량<input type="number" min="0" max="999999" step="1" inputMode="numeric" aria-label={`${product.name} 수량`} value={values[product.id]??''} disabled={busy||Boolean(pending)} onChange={e=>setValues(prev=>({...prev,[product.id]:e.target.value}))}/></label>
        <div className="admin-actions"><button type="button" disabled={busy||Boolean(pending)} onClick={()=>save(product,'add')}>입고 추가</button><button type="button" disabled={busy||Boolean(pending)} onClick={()=>save(product,'set')}>이 수량으로 수정</button></div>
      </div>
    </article>)}
  </section>;
}
