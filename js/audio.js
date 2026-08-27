/* ════════════════════════════════════════════════════════════════════
   골드드롭 - 사운드 엔진 (Web Audio API 합성음)
   ──────────────────────────────────────────────────────────────────
   ★ 음원 파일이 전혀 없어요. 브라우저가 소리를 '직접' 만들기 때문에
     용량 0KB + 인터넷 끊겨도 항상 재생됩니다!
   ★ 모바일 정책: 첫 터치 이후에만 소리가 날 수 있어요(정상).
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var Sound = {
    ctx: null,      // AudioContext (지연 생성)
    muted: false,   // OFF 상태

    /* 초기화 - 반드시 사용자 제스처(터치/클릭) 안에서 호출해야 함 */
    ensure: function () {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
    },

    /* 기본 삼각파 신호 하나 재생
       freq: 주소(Hz), dur: 길이(sec), vol: 음량(0~1),
       type: 파형('sine','triangle','square','sawtooth'),
       slideTo: 있으면 이 주소까지 부드럽게 미끄러짐 */
    blip: function (freq, dur, vol, type, slideTo, delaySec) {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx;
      var t0 = ctx.currentTime + (delaySec || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      // 뚝 끊기지 않도록 아주 짧은 공격감 + 감쇠 볼륨 설계
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    },

    /* ─── 게임 상황별 소리 ─────────────────────────────── */
    drop: function ()   { this.blip(180, 0.08, 0.18, 'triangle', 120); },          // 툭 (떨어짐)
    click: function ()  { this.blip(700, 0.05, 0.10, 'sine'); },                   // 딸깍 (버튼)
    illegal: function() { this.blip(160, 0.12, 0.12, 'sawtooth', 90); },           // 윙 (불가 열)

    /* 머지: 숫자가 클수록·연쇄가 깊을수록 높은 음 */
    merge: function (value, wave) {
      var base = 330 * Math.pow(1.06, Math.min(40, Math.log2(value) * 3 + wave));
      this.blip(base, 0.16, 0.22, 'sine', base * 2.0);
      this.blip(base * 1.5, 0.20, 0.10, 'sine', base * 1.5, 0.03);   // 화음 살짝 추가
    },

    best: function () {          // 신기록 팡파레 (도-미-솔-도)
      [523, 659, 784, 1046].forEach(function (f, i) {
        this.blip(f, 0.32, 0.20, 'triangle', null, i * 0.11);
      }.bind(this));
    },
    over: function () {          // 게임오버 하강음
      this.blip(392, 0.35, 0.18, 'sawtooth', 150);
      this.blip(196, 0.50, 0.14, 'triangle', 80, 0.28);
    },

    /* ─── 행운 시스템 효과음 ──────────────────────────── */

    /* 룰렛·바늘 회전 래칫 소리 (칸 하나 지날 때마다) */
    tick2: function () {
      this.blip(620 + Math.random() * 60, 0.035, 0.14, 'square');
    },
    /* 카드 한 장 뒤집기 */
    flip: function () {
      this.blip(300, 0.07, 0.12, 'triangle', 520);
    },
    /* 잭팟 상자 개봉 전 두근두근 저음 북 */
    drum: function () {
      this.blip(90, 0.18, 0.30, 'sine', 45);
    },
    /* 당첨! 반짝이는 상승 아르페지오 */
    win: function () {
      var self = this;
      [784, 988, 1175, 1568].forEach(function (f, i) {
        self.blip(f, 0.16, 0.22, 'square', null, i * 0.08);
      });
      this.blip(2093, 0.34, 0.16, 'sine', null, 0.36);
    },
    /* 잭팟 대박(전설급) 축하 팡파레 */
    jackpot: function () {
      var self = this;
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        self.blip(f, 0.14, 0.24, 'triangle', null, i * 0.09);
      });
      [1046, 1318, 1568].forEach(function (f, i) {
        self.blip(f * 2, 0.30, 0.13, 'square', null, 0.5 + i * 0.1);
      });
    },
    /* 낙방 (짧고 가벼운 하강음 — 너무 우울하지 않게) */
    lose: function () {
      this.blip(392, 0.18, 0.20, 'sawtooth', 240);
      this.blip(180, 0.26, 0.16, 'triangle', 110, 0.14);
    },
    /* 코인 파괴 동전 금속음 */
    coin: function () {
      this.blip(1046, 0.10, 0.20, 'square', 1568);
      this.blip(2093, 0.14, 0.12, 'sine', null, 0.05);
    },
    /* 젬 수령 딸랑 */
    gem: function () {
      this.blip(1244, 0.09, 0.16, 'sine', 1864);
    },

    /* ─── 단계 클리어 승리 아르페지오 ─── */

    clear: function () {
      var self = this;
      [659, 784, 988].forEach(function (f, i) {
        self.blip(f, 0.14, 0.20, 'square', null, i * 0.09);
      });
      this.blip(1318, 0.40, 0.22, 'triangle', null, 0.30);
    },
    /* 별 획득 딩! (별 개수만큼 순차 호출) */
    star: function (idx) {
      var f = [880, 1108, 1318][Math.min(2, idx)];
      this.blip(f, 0.22, 0.20, 'sine', f * 1.25);
    },
    /* 위험 경고 틱 (남은 드롭 3 이하) */
    tick: function () {
      this.blip(1050, 0.05, 0.13, 'square');
    },
    /* 돌블록 산산조각 (탁!) */
    stoneBreak: function () {
      this.blip(140, 0.14, 0.22, 'sawtooth', 55);
      this.blip(90, 0.18, 0.16, 'square', 45, 0.02);
    },
    /* 피버 발동 상승 스윕 */
    fever: function () {
      var ctx = this.ctx;
      if (!ctx || this.muted) return;
      for (var i = 0; i < 3; i++) {
        this.blip(220 + i * 60, 0.42, 0.15, 'sawtooth', 900 + i * 160, i * 0.03);
      }
      this.blip(1200, 0.28, 0.18, 'triangle', 1600, 0.34);
    },
    /* 광고 시청 완료 · 보상 수령 */
    reward: function () {
      var self = this;
      [523, 1046, 1568].forEach(function (f, i) {
        self.blip(f, 0.18, 0.20, 'triangle', null, i * 0.07);
      });
    },

    toggle: function () {
      this.muted = !this.muted;
      try { localStorage.setItem(MD.CONFIG.LS_MUTE, this.muted ? '1' : '0'); } catch (e) {}
      if (!this.muted) { this.ensure(); this.click(); }
      return this.muted;
    },
    loadMuted: function () {
      try { this.muted = localStorage.getItem(MD.CONFIG.LS_MUTE) === '1'; } catch (e) {}
      return this.muted;
    }
  };

  global.MD = global.MD || {};
  global.MD.Sound = Sound;

  /* Node.js 테스트 지원 */
  if (typeof module !== 'undefined') module.exports = Sound;
})(typeof window !== 'undefined' ? window : this);
