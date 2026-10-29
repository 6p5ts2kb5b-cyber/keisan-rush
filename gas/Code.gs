/**
 * まなびラッシュ GAS版（Google Apps Script）
 *
 * ・ゲーム本体は GitHub Pages の「App Store 版」を読みこんで表示します（古着編なし・検定名は一般名）。
 *   ゲームを直すと、GAS版も自動で新しくなります（6時間ごとに読みなおし）。
 * ・セーブデータを Google ドライブに保存 → どの端末でも続きから遊べます。
 * ・子どもごとの きろく（正解数・クリアしたステージ・ずかん など）をスプレッドシートに記録します。
 *
 * つかいかた：このファイルを Code.gs に まるごと貼り付け → setup を1回実行 → ウェブアプリとしてデプロイ。
 */

var GAME_URL_DEFAULT = 'https://6p5ts2kb5b-cyber.github.io/keisan-rush/appstore/www/index.html';
var CACHE_HOURS = 6;
var HIST_MINUTES = 15;          // 「りれき」シートに書く間かく（分）
var MAX_KEY_CHARS = 800000;     // これより大きい セーブ項目（しゃしん など）は 同期しない

/* ====================== 最初に1回だけ実行 ====================== */
function setup() {
  var P = PropertiesService.getScriptProperties();
  var ssId = P.getProperty('SHEET_ID'), ss = null;
  if (ssId) { try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('まなびラッシュ きろく'); P.setProperty('SHEET_ID', ss.getId()); }

  var sum = ss.getSheetByName('きろく') || ss.insertSheet('きろく');
  sum.getRange(1, 1, 1, 12).setValues([[
    'さいごに あそんだ日時', 'アカウント', 'ファイル', 'なまえ', 'さんすう 正解', 'えいご 正解', 'かんじ 正解',
    '正解 ごうけい', 'クリアした ステージ', 'ずかん', '💎', 'まなびバランス ランク']]);
  var his = ss.getSheetByName('りれき') || ss.insertSheet('りれき');
  his.getRange(1, 1, 1, 9).setValues([[
    '日時', 'アカウント', 'ファイル', 'なまえ', 'さんすう 正解', 'えいご 正解', 'かんじ 正解', 'クリアした ステージ', 'ずかん']]);
  [sum, his].forEach(function (sh) {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#1f5e3a').setFontColor('#ffffff');
    sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 200);
  });
  var first = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 2) ss.deleteSheet(first);

  var fid = P.getProperty('FOLDER_ID'), folder = null;
  if (fid) { try { folder = DriveApp.getFolderById(fid); } catch (e) { folder = null; } }
  if (!folder) { folder = DriveApp.createFolder('まなびラッシュ セーブ'); P.setProperty('FOLDER_ID', folder.getId()); }

  clearGameCache_();
  var html = loadGame_();   // 読みこめるか ためす
  Logger.log('✅ じゅんび できました');
  Logger.log('きろく（スプレッドシート）: ' + ss.getUrl());
  Logger.log('セーブの フォルダ: ' + folder.getUrl());
  Logger.log('ゲームの 大きさ: ' + Math.round(html.length / 1024) + ' KB');
}

/* ====================== ページを ひらいたとき ====================== */
function doGet(e) {
  var me = who_();
  var save = me ? readSave_(me) : null;
  var html = loadGame_();
  var head = '<script>' + restoreJs_(save, me) + '</script>';
  html = html.replace(/<head([^>]*)>/i, function (m) { return m + head; });
  var tail = '<script>' + bridgeJs_() + '</script>';
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>(?![\s\S]*<\/body>)/i, tail + '</body>');
  else if (/<\/html>/i.test(html)) html = html.replace(/<\/html>(?![\s\S]*<\/html>)/i, tail + '</html>');
  else html += tail;
  return HtmlService.createHtmlOutput(html)
    .setTitle('まなびラッシュ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ====================== ページから よばれる ====================== */
function saveGame(json) {
  var me = who_();
  if (!me) return { ok: false, reason: 'noaccount' };
  var data = JSON.parse(json);
  var t = Date.now();
  writeSave_(me, JSON.stringify({ t: t, d: data }));
  try { record_(me, data); } catch (err) { console.error(err); }
  return { ok: true, t: t };
}

/* ====================== ゲーム本体を 読みこむ ====================== */
function gameUrl_() {
  return PropertiesService.getScriptProperties().getProperty('GAME_URL') || GAME_URL_DEFAULT;
}
function loadGame_() {
  var c = CacheService.getScriptCache(), n = Number(c.get('game_n') || 0);
  if (n) {
    var keys = []; for (var i = 0; i < n; i++) keys.push('game_' + i);
    var parts = c.getAll(keys), s = '';
    for (var j = 0; j < n; j++) { if (parts['game_' + j] == null) { s = null; break; } s += parts['game_' + j]; }
    if (s) return s;
  }
  var url = gameUrl_();
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error('ゲームを 読みこめませんでした（' + res.getResponseCode() + '）: ' + url);
  var html = res.getContentText('UTF-8');
  var base = url.replace(/[^\/]*$/, '');
  // 相対パス（フォントなど）を 絶対パスに
  html = html.replace(/(href|src)="(?!https?:|data:|#|\/\/)([^"]+)"/g, function (m, a, p) { return a + '="' + base + p + '"'; });
  var size = 90000, chunks = {}, k = 0;
  for (var x = 0; x < html.length; x += size) chunks['game_' + (k++)] = html.slice(x, x + size);
  try { c.putAll(chunks, CACHE_HOURS * 3600); c.put('game_n', String(k), CACHE_HOURS * 3600); } catch (e) { /* 大きすぎて 入らないときは 毎回 読む */ }
  return html;
}
function clearGameCache_() { CacheService.getScriptCache().remove('game_n'); }
/** ゲームを 直したあと すぐ 反映したいときに 実行 */
function refreshGame() { clearGameCache_(); loadGame_(); Logger.log('✅ 新しい ゲームを 読みこみました'); }

/* ====================== だれが あそんでいるか ====================== */
function who_() {
  var m = '';
  try { m = Session.getActiveUser().getEmail(); } catch (e) { m = ''; }
  return m || '';
}

/* ====================== セーブ（ドライブ）====================== */
function folder_() {
  var fid = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!fid) throw new Error('setup を 先に 実行してください');
  return DriveApp.getFolderById(fid);
}
function saveName_(me) { return 'save_' + me.replace(/[^\w.@-]/g, '_') + '.json'; }
function readSave_(me) {
  try {
    var it = folder_().getFilesByName(saveName_(me));
    if (!it.hasNext()) return null;
    return JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
  } catch (e) { return null; }
}
function writeSave_(me, text) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var f = folder_(), it = f.getFilesByName(saveName_(me));
    if (it.hasNext()) it.next().setContent(text);
    else f.createFile(saveName_(me), text, 'application/json');
  } finally { lock.releaseLock(); }
}

/* ====================== きろく（スプレッドシート）====================== */
var RANKS = [0, 30, 100, 250, 500, 1000];
function rankOf_(n) { var r = 0; for (var i = 0; i < RANKS.length; i++) if (n >= RANKS[i]) r = i; return r; }
function pj_(v, d) { try { return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function record_(me, data) {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  var sum = ss.getSheetByName('きろく'), his = ss.getSheetByName('りれき');
  var slots = pj_(data['kr_slots'], []) || [];
  var now = new Date(), cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var vals = sum.getLastRow() > 1 ? sum.getRange(2, 2, sum.getLastRow() - 1, 2).getValues() : [];
    slots.forEach(function (sl, i) {
      if (!sl || !sl.name) return;
      var pre = 'kr_s' + i + '_';
      var st = pj_(data[pre + 'kr_study'], {}) || {};
      var m = Number(st.math || 0), e = Number(st.eng || 0), k = Number(st.kok || 0);
      var stages = Object.keys(pj_(data[pre + 'kr_stage'], {}) || {}).length;
      var dex = Object.keys(pj_(data[pre + 'kr_dex3'], {}) || {}).length;
      var pts = Number(pj_(data[pre + 'kr_pts'], 0) || 0);
      var rank = Math.min(rankOf_(m), rankOf_(e), rankOf_(k));
      var row = [now, me, 'ファイル' + (i + 1), sl.name, m, e, k, m + e + k, stages, dex, pts, rank];
      var at = -1;
      for (var r = 0; r < vals.length; r++) if (vals[r][0] === me && vals[r][1] === 'ファイル' + (i + 1)) { at = r; break; }
      var prev = at >= 0 ? sum.getRange(at + 2, 1, 1, 12).getValues()[0] : null;
      var changed = !prev || prev[3] !== sl.name || prev[7] !== m + e + k || prev[8] !== stages || prev[9] !== dex;
      if (!changed) return;
      if (at >= 0) sum.getRange(at + 2, 1, 1, 12).setValues([row]);
      else { sum.appendRow(row); vals.push([me, 'ファイル' + (i + 1)]); }
      var hk = 'h_' + Utilities.base64EncodeWebSafe(me + '|' + i).slice(0, 200);
      if (!cache.get(hk)) { his.appendRow([now, me, 'ファイル' + (i + 1), sl.name, m, e, k, stages, dex]); cache.put(hk, '1', HIST_MINUTES * 60); }
    });
  } finally { lock.releaseLock(); }
}

/* ====================== ページに 入れる スクリプト ====================== */
var DUMP_JS = 'window.GAS_DUMP=function(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k||!/^kr_/.test(k)||/^kr_gas_/.test(k))continue;var v=localStorage.getItem(k);if(v==null||v.length>' + MAX_KEY_CHARS + ')continue;o[k]=v}var ks=Object.keys(o).sort(),r={};ks.forEach(function(k){r[k]=o[k]});return JSON.stringify(r)};' +
  'window.GAS_HASH=function(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h)+":"+s.length};';
function restoreJs_(save, me) {
  // ゲームより 先に 動いて、サーバーの セーブが 新しければ 端末に もどす。
  // ただし この端末に まだ ほぞんして いない 変化が あれば、端末の ほうを 優先する（あとで サーバーへ 送る）。
  return DUMP_JS + 'window.GAS_ME=' + JSON.stringify(me ? 1 : 0) + ';(function(){try{var S=' + JSON.stringify(save || null) + ';' +
    'if(!S||!S.d)return;var lt=Number(localStorage.getItem("kr_gas_t")||0);if(lt>=S.t)return;' +
    'var cur=GAS_DUMP();if(cur!=="{}"&&GAS_HASH(cur)!==localStorage.getItem("kr_gas_h"))return;' +
    'var rm=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^kr_/.test(k))rm.push(k)}' +
    'var keep={};Object.keys(S.d).forEach(function(k){keep[k]=1});rm.forEach(function(k){if(!keep[k]&&k.length<200&&localStorage.getItem(k).length<' + MAX_KEY_CHARS + ')localStorage.removeItem(k)});' +
    'Object.keys(S.d).forEach(function(k){try{localStorage.setItem(k,S.d[k])}catch(e){}});localStorage.setItem("kr_gas_t",String(S.t));localStorage.setItem("kr_gas_h",GAS_HASH(GAS_DUMP()))}catch(e){}})();';
}
function bridgeJs_() {
  return [
    '(function(){if(!window.google||!google.script)return;var MAX=' + MAX_KEY_CHARS + ',last="",busy=false,noacc=!window.GAS_ME;',
    'function dump(){return GAS_DUMP()}',
    'function badge(t,c){var b=document.getElementById("gasSync");if(!b){b=document.createElement("div");b.id="gasSync";b.style.cssText="position:fixed;left:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:80;padding:4px 10px;border-radius:99px;font:800 11px system-ui,sans-serif;color:#fff;pointer-events:none;transition:opacity .4s";document.body.appendChild(b)}b.textContent=t;b.style.background=c;b.style.opacity=1;clearTimeout(b._t);b._t=setTimeout(function(){b.style.opacity=0},2200)}',
    'function sync(){if(busy||noacc)return;var j=dump();if(j===last)return;busy=true;google.script.run.withSuccessHandler(function(r){busy=false;if(r&&r.ok){last=j;localStorage.setItem("kr_gas_t",String(r.t));localStorage.setItem("kr_gas_h",GAS_HASH(j));badge("☁ ほぞん しました","#1f5e3a")}else if(r&&r.reason==="noaccount"){noacc=true}}).withFailureHandler(function(){busy=false;badge("☁ ほぞん できませんでした（あとで もういちど）","#c8402a")}).saveGame(j)}',
    'last=localStorage.getItem("kr_gas_h")===GAS_HASH(dump())?dump():"";setTimeout(sync,4000);setInterval(sync,30000);document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")sync()});window.addEventListener("pagehide",sync);',
    'if(noacc)setTimeout(function(){badge("☁ アカウントが わからないので、この 端末だけに ほぞん します","#8a6a3a")},2500)})();'
  ].join('');
}
