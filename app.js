/* シー待ち時間ナビ（最小版）— 待ち時間・営業状況を日本語で一覧。チェックは端末に保存 */
(function () {
  'use strict';
  var SB = 'https://ajqbrrusenlybiloxcir.supabase.co/functions/v1';
  var BASES = [SB + '/api', 'https://api.themeparks.wiki/v1'];
  var KEY = 'parknavi.sea.v1', CK = 'parknavi.sea.cache.v1';
  var $ = function (id) { return document.getElementById(id); };
  var st = { favs: {}, filter: 'all', onlyFav: false };
  var data = { at: null, items: [], hours: null, ok: false, pid: null };
  try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) st.favs = s.favs || {}; } catch (e) { }
  try { var c = JSON.parse(localStorage.getItem(CK) || 'null'); if (c) data = c; } catch (e) { }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ favs: st.favs })); } catch (e) { } }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  var base = null;
  function getJSON(path) {
    var bs = base ? [base] : BASES.slice();
    function next() {
      if (!bs.length) return Promise.resolve(null);
      var b = bs.shift();
      return fetch(b + path, { cache: 'no-store' }).then(function (r) {
        if (!r.ok || (r.headers.get('content-type') || '').indexOf('json') < 0) return next();
        return r.json().then(function (j) { base = b; return j; });
      }).catch(next);
    }
    return next();
  }
  function lookup(name) {
    var n = (name || '').toLowerCase();
    for (var i = 0; i < SEA_DICT.length; i++) if (n.indexOf(SEA_DICT[i][0]) >= 0) return SEA_DICT[i];
    return null;
  }
  function tokyoTime(iso) {
    try { return new Date(iso).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return ''; }
  }
  function findPark() {
    if (data.pid) return Promise.resolve(data.pid);
    return getJSON('/destinations').then(function (j) {
      if (!j || !j.destinations) return null;
      for (var i = 0; i < j.destinations.length; i++) {
        var d = j.destinations[i];
        if (!/tokyo disney/i.test(d.name || '')) continue;
        for (var k = 0; k < (d.parks || []).length; k++) if (/disneysea/i.test(d.parks[k].name)) return d.parks[k].id;
      }
      return null;
    });
  }
  function refresh() {
    $('stat').textContent = '更新中…';
    return findPark().then(function (pid) {
      if (!pid) { data.ok = false; return; }
      data.pid = pid;
      return Promise.all([getJSON('/entity/' + pid + '/live'), getJSON('/entity/' + pid + '/schedule')]).then(function (r) {
        if (r[0] && r[0].liveData) {
          data.items = r[0].liveData.filter(function (e) { return e.entityType === 'ATTRACTION' || e.entityType === 'SHOW'; }).map(function (e) {
            var q = e.queue && e.queue.STANDBY ? e.queue.STANDBY.waitTime : null;
            return { id: e.id, en: e.name, type: e.entityType, status: e.status, wait: q, shows: (e.showtimes || []).map(function (s) { return s.startTime; }) };
          });
          data.at = Date.now(); data.ok = true;
        } else data.ok = false;
        if (r[1] && r[1].schedule) {
          var today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
          var h = r[1].schedule.filter(function (x) { return x.date === today && x.type === 'OPERATING'; })[0];
          data.hours = h ? [tokyoTime(h.openingTime), tokyoTime(h.closingTime)] : null;
        }
        try { localStorage.setItem(CK, JSON.stringify(data)); } catch (e) { }
      });
    }).catch(function () { data.ok = false; }).then(render);
  }
  function statusText(it) {
    if (it.status === 'OPERATING') return it.wait != null ? { t: it.wait + '分', c: it.wait >= 60 ? 'bad' : it.wait >= 30 ? 'mid' : 'good' } : { t: '運営中', c: 'good' };
    if (it.status === 'DOWN') return { t: '一時休止', c: 'warn' };
    if (it.status === 'REFURBISHMENT') return { t: '整備中', c: 'off' };
    return { t: '本日は休止', c: 'off' };
  }
  function render() {
    var upd = data.at ? tokyoTime(data.at) : '';
    $('stat').textContent = data.items.length ? ('現地 ' + upd + ' 更新' + (data.ok ? '' : '（通信できず・前回の情報）')) : (data.ok === false ? '情報を取得できませんでした' : '');
    $('hours').textContent = data.hours ? '本日の営業 ' + data.hours[0] + '〜' + data.hours[1] : '';
    var rows = data.items.map(function (it) {
      var d = lookup(it.en);
      return { it: it, ja: d ? d[1] : it.en, land: d ? d[2] : 8, known: !!d, s: statusText(it) };
    }).filter(function (r) {
      if (st.filter === 'att' && r.it.type !== 'ATTRACTION') return false;
      if (st.filter === 'show' && r.it.type !== 'SHOW') return false;
      if (st.onlyFav && !st.favs[r.it.id]) return false;
      return true;
    });
    rows.sort(function (a, b) {
      var fa = st.favs[a.it.id] ? 0 : 1, fb = st.favs[b.it.id] ? 0 : 1; if (fa !== fb) return fa - fb;
      var oa = a.it.status === 'OPERATING' ? 0 : 1, ob = b.it.status === 'OPERATING' ? 0 : 1; if (oa !== ob) return oa - ob;
      var wa = a.it.wait == null ? 999 : a.it.wait, wb = b.it.wait == null ? 999 : b.it.wait; if (wa !== wb) return wa - wb;
      return a.ja < b.ja ? -1 : 1;
    });
    $('list').innerHTML = rows.length ? rows.map(function (r) {
      var shows = r.it.type === 'SHOW' && r.it.shows.length ? '<div class="sub">' + r.it.shows.map(tokyoTime).join(' / ') + '</div>' : '';
      return '<div class="row"><button class="star" data-id="' + esc(r.it.id) + '" aria-pressed="' + !!st.favs[r.it.id] + '" aria-label="やりたい">' + (st.favs[r.it.id] ? '★' : '☆') + '</button>' +
        '<div class="nm"><div class="ja">' + esc(r.ja) + '</div>' + (r.known ? '' : '') + '<div class="en">' + esc(r.known ? r.it.en : '') + '</div><div class="land">' + esc(SEA_LANDS[r.land]) + (r.it.type === 'SHOW' ? '・ショー' : '') + '</div>' + shows + '</div>' +
        '<div class="w ' + r.s.c + '">' + esc(r.s.t) + '</div></div>';
    }).join('') : '<p class="empty">' + (data.items.length ? '該当なし' : '読み込み中、または情報がありません') + '</p>';
    ['all', 'att', 'show'].forEach(function (f) { $('f_' + f).setAttribute('aria-pressed', st.filter === f); });
    $('f_fav').setAttribute('aria-pressed', st.onlyFav);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('star')) { var id = t.getAttribute('data-id'); if (st.favs[id]) delete st.favs[id]; else st.favs[id] = 1; save(); render(); return; }
    if (t.id === 'f_all') st.filter = 'all'; else if (t.id === 'f_att') st.filter = 'att'; else if (t.id === 'f_show') st.filter = 'show';
    else if (t.id === 'f_fav') st.onlyFav = !st.onlyFav; else if (t.id === 'reload') { refresh(); return; } else return;
    render();
  });
  render(); refresh();
  setInterval(refresh, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  try { if ('serviceWorker' in navigator && location.protocol === 'https:' && /github\.io$|localhost/.test(location.hostname)) navigator.serviceWorker.register('sw.js'); } catch (e) { }
  window.__sea = { lookup: lookup, statusText: statusText };
})();
