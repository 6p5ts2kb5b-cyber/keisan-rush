// ===== App Store 版だけの しかけ =====
(function(){
  const $=id=>document.getElementById(id);
  // クレジット
  document.addEventListener('click',e=>{
    if(e.target.closest('#appCred')){e.preventDefault();e.stopPropagation();$('credOv').hidden=false;return}
    if(e.target.closest('#credClose')){$('credOv').hidden=true}
  },true);
  // 長押しメニューや 画像の 保存を ださない
  document.documentElement.style.webkitTouchCallout='none';
  // セーブデータの バックアップ（iOS の Preferences）
  const P=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Preferences;
  if(!P)return;
  const KEY='manabi_backup_v1';
  const dump=()=>{const o={};let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!/^kr_/.test(k))continue;const v=localStorage.getItem(k);if(v==null)continue;n+=v.length;if(n>4e6)break;o[k]=v}return JSON.stringify(o)};
  const save=()=>{try{P.set({key:KEY,value:dump()})}catch(e){}};
  (async()=>{try{
    const has=Object.keys(localStorage).some(k=>/^kr_/.test(k));
    if(!has){const r=await P.get({key:KEY});if(r&&r.value){const o=JSON.parse(r.value);Object.entries(o).forEach(([k,v])=>localStorage.setItem(k,v));if(Object.keys(o).length){location.reload();return}}}
  }catch(e){}
  setInterval(save,20000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});})();
})();
