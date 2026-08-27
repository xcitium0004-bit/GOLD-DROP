/* ════════════════════════════════════════════════════════════════════
   골드드롭 - 재화·행운 로직 (순수 계산 전담)
   ──────────────────────────────────────────────────────────────────
   화면 그리기가 일절 없는 순수 파일입니다.
   젬 지갑 / 오늘의 룰렛 / 두배 도전 판정 / 보석 상자 추첨 /
   오늘의 미션 진행 을 전부 여기서만 다룹니다.
   저장소는 브라우저 localStorage, 실패해도 게임이 죽지 않게
   전부 안전장치(try/catch)를 걸어 두었습니다.
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CFG = null;
  function cfg() { return CFG || (global.MD ? global.MD.CONFIG : null); }

  /* ── 날짜 키 (오늘 기준 YYYY-MM-DD) ── */
  function dayKey(d) {
    var t = d ? new Date(d) : new Date();
    var mm = ('' + (t.getMonth() + 1)).padStart(2, '0');
    var dd = ('' + t.getDate()).padStart(2, '0');
    return t.getFullYear() + '-' + mm + '-' + dd;
  }
  function yesterdayKey() {
    var y = new Date(); y.setDate(y.getDate() - 1);
    return dayKey(y);
  }

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, String(val));
    } catch (e) { return null; }
  }

  var Eco = {

    /* ══════════ 젬 지갑 ══════════ */

    _GKEY: 'gd_gems',
    gems: function () { return parseInt(store(this._GKEY), 10) || 0; },
    addGems: function (n) {
      var v = Math.max(0, this.gems() + n);
      store(this._GKEY, v);
      if (n > 0) this.bumpMission('gems', n);     // 미션: 오늘 젬 모으기
      return v;
    },
    spendGems: function (cost) {
      if (this.gems() < cost) return false;
      store(this._GKEY, this.gems() - cost);
      return true;
    },

    /* ══════════ 오늘의 행운 룰렛 ══════════ */

    _SPIN_KEY: 'gd_spin',
    spinStatus: function () {
      // { canSpin, streak } 오늘 아직 돌렸는지 + 연속 일수
      var today = dayKey();
      var data = store(this._SPIN_KEY);
      var lastDay = '', streak = 1;
      if (data) {
        try {
          var j = JSON.parse(data);
          lastDay = j.day || '';
          streak = j.streak || 1;
        } catch (e) {}
      }
      if (lastDay === today) {
        return { canSpin: false, streak: streak };
      }
      if (lastDay === yesterdayKey()) streak += 1; else streak = 1;
      return { canSpin: true, streak: streak, _next: { day: today, streak: streak } };
    },
    markSpun: function () {
      var st = this.spinStatus();
      if (st._next) {
        store(this._SPIN_KEY, JSON.stringify(st._next));
        return st.streak;
      }
      return st.streak;
    },

    /* 룰렛 구간 추첨 → 구간 번호 반환 */
    rollWheel: function () {
      var segs = cfg().WHEEL.SEGMENTS;
      var total = 0, i;
      for (i = 0; i < segs.length; i++) total += segs[i].w;
      var r = Math.random() * total;
      for (i = 0; i < segs.length; i++) {
        r -= segs[i].w;
        if (r <= 0) return i;
      }
      return 0;
    },

    /* ══════════ 두배 도전 ══════════ */

    duOdds: function (roundIdx) {          // roundIdx: 0부터
      var arr = cfg().DOUBLEUP.CHANCES;
      if (roundIdx >= arr.length) return 0;
      return arr[roundIdx];
    },
    duRoll: function (roundIdx) {          // true = 당첨
      return Math.random() * 100 < this.duOdds(roundIdx);
    },
    duMultiAfterWin: function (roundIdx) { // 라운드 승리 후 배수
      return Math.pow(2, roundIdx + 1);
    },

    /* ══════════ 보석 상자 ══════════ */

    rollChest: function () {
      var table = cfg().CHEST.TABLE;
      var total = 0, i;
      for (i = 0; i < table.length; i++) total += table[i].chance;
      var r = Math.random() * total;
      for (i = 0; i < table.length; i++) {
        r -= table[i].chance;
        if (r <= 0) return table[i];
      }
      return table[0];
    },
    chestOf: function (key) {
      var table = cfg().CHEST.TABLE;
      for (var i = 0; i < table.length; i++)
        if (table[i].key === key) return table[i];
      return table[0];
    },
    /* 열기 전 카드 3장 준비. 진짜 등급은 마지막에 공개,
       그 앞 카드는 확률적으로 한 단계 위 카드를 흔들어준다(아깝다 연출). */
    drawChestCards: function (realRarity) {
      var table = cfg().CHEST.TABLE;
      var idxOf = function (k) {
        for (var i = 0; i < table.length; i++) if (table[i].key === k) return i;
        return 0;
      };
      var realIdx = idxOf(realRarity.key);
      var cards = [];
      for (var c = 0; c < 2; c++) {
        var tease = Math.random() < cfg().CHEST.DECOY_HIGH && realIdx > 0;
        var pick = tease
          ? table[Math.max(0, realIdx - 1)]           // 한 단계 위 흔들기
          : table[Math.min(table.length - 1, realIdx + (Math.random() < 0.5 ? 0 : 1))];
        cards.push(pick);
      }
      cards.push(realRarity);
      return cards;
    },

    /* ══════════ 오늘의 미션 (자동 수령) ══════════ */

    _mKey: function (k) { return 'gd_m_' + dayKey() + '_' + k; },
    missionValue: function (k) { return parseInt(store(this._mKey(k)), 10) || 0; },
    bumpMission: function (k, by) {
      store(this._mKey(k), this.missionValue(k) + (by || 1));
    },
    missionsDone: function () {
      var out = [], list = cfg().MISSIONS;
      for (var i = 0; i < list.length; i++) {
        if (this.missionValue(list[i].key) >= list[i].target) out.push(list[i]);
      }
      return out;
    },

    /* 메뉴 진입 때 호출: 완료된 미션 보너스를 한 번씩 수령. 지급 목록 반환 */
    collectMissions: function () {
      var claimed = JSON.parse(store('gd_m_done') || '{}');
      var nowDone = {};
      var paid = [];
      var list = cfg().MISSIONS;
      for (var i = 0; i < list.length; i++) {
        var m = list[i], key = dayKey() + '|' + m.key;
        if (!claimed[key] && this.missionValue(m.key) >= m.target) {
          claimed[key] = 1;
          this.addGems(m.reward);
          paid.push({ name: m.name, reward: m.reward });
        }
      }
      /* 오래된 날짜 키 청소(저장공간 위생) */
      var todayTag = dayKey() + '|';
      Object.keys(claimed).forEach(function (k) {
        if (k.indexOf(todayTag) !== 0 && k.indexOf(dayKey(new Date(Date.now() - 172800000)) + '|') !== 0)
          delete claimed[k];
      });
      store('gd_m_done', JSON.stringify(claimed));
      return paid;
    },

    /* ══════════ 최고 연쇄 ══════════ */
    chainBest: function () { return parseInt(store(cfg().LS_CHAIN), 10) || 0; },
    recordChain: function (waves) {
      var isRecord = waves > this.chainBest();
      if (isRecord) store(cfg().LS_CHAIN, waves);
      if (waves >= 3) this.bumpMission('chain', 1);
      return isRecord;
    },

    /* Node.js 단위 테스트용 */
    __testHooks: {
      setConfig: function (c) { CFG = c; },
      dayKey: dayKey, yesterdayKey: yesterdayKey, store: store
    }
  };

  global.MD = global.MD || {};
  global.MD.Eco = Eco;

  if (typeof module !== 'undefined') module.exports = Eco;
})(typeof window !== 'undefined' ? window : this);
