/* ════════════════════════════════════════════════════════════════════
   골드드롭 - 메인 컨트롤러
   ──────────────────────────────────────────────────────────────────
   ★ 흐름: 메뉴 → 드롭→연쇄 → [목표달성? 두배 도전 : 드롭소진? 종료]
     종료 시 마감 상자 개봉 → 부활(광고/젬) 또는 재도전.
   ★ 행운 시스템
     1) 오늘의 룰렛: 하루 1회 무료, 출석 스트릭 누적
     2) 두배 도전: 클리어 보상을 건 확률 게임(최대 3연속)
     3) 마감 보석 상자: 게임오버마다 등급 추첨(시청 광고로 1회 추가)
     4) 황금코인: 폭파 옆에 끼면 점수 + 젬 지급
   ★ 광고 연결부는 index.html 의 ▼ 표시 자리에 코드만 넣으면 작동합니다.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CFG = window.MD.CONFIG;
  var Sound = window.MD.Sound;
  var B = window.MD.Board;
  var R = window.MD.Renderer;
  var Eco = window.MD.Eco;

  /* ── 게임 상태 ── */
  var game = {
    state: 'menu',            // menu | playing | paused | clear | over
    grid: B.createGrid(),
    score: 0, displayScore: 0,

    best: B.loadBest(), stageBest: B.loadStageBest(), totalStars: B.loadStars(),

    stage: 1, stageStartScore: 0, target: 0,
    dropsLeft: 0, dropsTotal: 0, runStars: 0,
    pendingClear: false, reviveUsed: false,
    bestChainRun: 0, chestMoreUsed: false,

    currentValue: 1, nextValue: 1,
    aimCol: -1,
    busy: false, phase: 'idle',
    waveTimer: null, waveIdx: 0,
    milestonesHit: {}, newBestFlag: false,

    heat: 0, feverUntil: 0,

    fx: {
      falling: null, pops: [], floats: [],
      colOffsets: [0,0,0,0,0,0].map(function(){return {cells:0,t0:0};}),
      shakeAmp: 0, shakeStart: 0
    }
  };

  /* ── DOM 참조 ── */
  var $ = function (id) { return document.getElementById(id); };
  var elCanvas, elScore, elBest, elStage, elDrops, elGems,
      elFill, elTargetTxt, elCur, elNext, elHeat, elFeverTag,
      ovMenu, ovPause, ovOver, ovClear, comboBanner,
      menuBest, menuStars, menuStage, menuChain, streakDays;

  /* ╔══════════════════════════════════════════════╗
     ║ 광고 매니저                                    ║
     ║ index.html 의 주석 자리에 애드센스 단위 코드를   ║
     ║ 붙여넣으면 자동으로 인식해 노출합니다.           ║
     ╚══════════════════════════════════════════════╝ */
  var Ads = {
    oversSeen: 0,
    clearsSeen: 0,
    lastShownAt: 0,

    _hasRealUnit: function (containerId) {
      var box = $(containerId);
      return !!(box && box.querySelector('ins.adsbygoogle'));
    },

    _countdownClose: function (ovEl, sec, onClose) {
      var btn = ovEl.querySelector('.ad-close');
      btn.disabled = true;
      var left = sec;
      btn.textContent = left + '초 후 닫기 가능';
      var t = setInterval(function () {
        left--;
        if (left <= 0) {
          clearInterval(t);
          btn.disabled = false;
          btn.textContent = '닫기';
        } else {
          btn.textContent = left + '초 후 닫기 가능';
        }
      }, 1000);
      btn.onclick = function () {
        if (btn.disabled) return;
        Sound.click();
        ovEl.classList.remove('show');
        onClose();
      };
    },

    /* 전면광고: 게임오버 N번째마다 · 클리어 3번마다 */
    maybeInterstitial: function (onDone) {
      var self = this;
      var now = performance.now();
      var gapOk = this.lastShownAt === 0 ||
                  (now - this.lastShownAt >= CFG.ADS.INTERSTITIAL_MIN_GAP_MS);
      var due = (this.oversSeen > 0 && this.oversSeen % CFG.ADS.INTERSTITIAL_EVERY_N_OVER === 0)
             || (this.clearsSeen > 0 && this.clearsSeen % 3 === 0);
      if (!gapOk || !due) return onDone();

      this.lastShownAt = now;
      var ov = $('ovAd');
      var panel = $('adTestPanel');
      var realBox = $('adRealBox');

      if (this._hasRealUnit('adRealBox')) {
        panel.style.display = 'none';
        realBox.style.display = '';
      } else if (CFG.ADS.TEST_MODE) {
        panel.style.display = '';
        realBox.style.display = 'none';
      } else {
        return onDone();          // 코드 없음 + 테스트 모드 끔 → 조용히 생략
      }

      ov.classList.add('show');
      this._countdownClose(ov, CFG.ADS.INTERSTITIAL_CLOSE_SEC, onDone);
    },

    /* 시청 보상형 광고. 외부 어댑터(window.MDRewarded)가 있으면 우선 사용 */
    showRewarded: function (onReward, onFail, purposeText) {
      var self = this;
      $('rewardStatus').textContent = purposeText || '광고를 시청하면 보상을 받습니다.';
      if (window.MDRewarded && typeof window.MDRewarded.show === 'function') {
        window.MDRewarded.show(onReward, onFail);
        return;
      }
      var ov = $('ovReward');
      var status = $('rewardStatus');

      if (this._hasRealUnit('adRewardBox')) {
        ov.classList.add('show');
        var btn = $('btnClaimReward');
        btn.style.display = 'none';
        setTimeout(function () {
          btn.style.display = '';
          status.textContent = '시청 완료! 아래 버튼을 눌러 보상을 받으세요.';
          btn.onclick = function () {
            Sound.reward();
            ov.classList.remove('show');
            onReward();
          };
        }, CFG.ADS.REWARDED_CLOSE_SEC * 2000);
      } else if (CFG.ADS.TEST_MODE) {
        /* 테스트 모드: 짧은 로딩 후 바로 지급 (설정 확인용) */
        ov.classList.add('show');
        status.textContent += ' (테스트 모드)';
        setTimeout(function () {
          status.textContent = '시청 완료!';
          setTimeout(function () {
            Sound.reward();
            ov.classList.remove('show');
            onReward();
          }, 500);
        }, CFG.ADS.REWARDED_CLOSE_SEC * 1000);
      } else {
        onFail();
      }
    }
  };

  /* ════════════════════ 유틸 ════════════════════ */

  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function cellOffsetX() { return R.gap || 6; }
  function cellPx() { return R.cell || 60; }

  function refreshGemHud() {
    elGems.textContent = fmt(Eco.gems());
  }

  /* ════════════════════ 오늘의 미션 (메뉴 칩) ════════════════════ */

  function renderMissions() {
    var box = $('missionChips');
    if (!box) return;
    box.innerHTML = '';
    CFG.MISSIONS.forEach(function (m) {
      var val = Eco.missionValue(m.key);
      var done = val >= m.target;
      var pct = Math.min(100, Math.round(val / m.target * 100));
      var row = document.createElement('div');
      row.className = 'mchip' + (done ? ' done' : '');
      row.innerHTML =
        '<span class="mchip-name">' + m.name + '</span>' +
        '<span class="mchip-bar"><i class="mchip-fill" style="width:' + pct + '%"></i></span>' +
        '<span class="mchip-val">' + (done ? '+' + m.reward : Math.min(val, m.target) + '/' + m.target) + '</span>';
      box.appendChild(row);
    });
  }

  function collectMissionsIfAny() {
    var paid = Eco.collectMissions();
    if (paid.length) {
      paid.forEach(function (p, i) {
        setTimeout(function () { Sound.gem(); }, i * 260);
      });
      pushCenterFloat('오늘의 미션 보너스!', '#43d68c');
      refreshGemHud();
    }
    renderMissions();
  }

  /* ════════════════════ 행운 룰렛 ════════════════════ */

  var Wheel = {
    overlay: null, canvas: null, ctx2d: null,
    rot: 0, spinning: false, raf: null,
    segColors: ['#ffc93c', '#fff3c9', '#ff8a5c', '#fff3c9',
                '#57c8ff', '#fff3c9', '#c86bff', '#fff3c9'],

    init: function () {
      this.overlay = $('ovWheel');
      this.canvas = $('wheelCanvas');
      this.ctx2d = this.canvas.getContext('2d');
      this.paint(this.rot);
    },
    segAngle: function () {
      return Math.PI * 2 / CFG.WHEEL.SEGMENTS.length;
    },
    paint: function (rot) {
      var ctx = this.ctx2d;
      if (!ctx) return;
      var W = this.canvas.width, H = this.canvas.height;
      var cx = W / 2, cy = H / 2, rad = W / 2 - 10;
      var n = CFG.WHEEL.SEGMENTS.length;
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < n; i++) {
        var a0 = i * this.segAngle() + rot;
        var a1 = a0 + this.segAngle();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rad, a0, a1);
        ctx.closePath();
        ctx.fillStyle = this.segColors[i % this.segColors.length];
        ctx.fill();
        ctx.strokeStyle = '#1a130c';
        ctx.lineWidth = 3;
        ctx.stroke();

        /* 구간 금액 라벨 */
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a0 + this.segAngle() / 2);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = "16px 'Black Han Sans', sans-serif";
        ctx.fillStyle = '#1a130c';
        ctx.fillText(CFG.WHEEL.SEGMENTS[i].v + '', rad - 22, 0);
        /* 작은 젬 모양 장식 */
        ctx.beginPath();
        ctx.moveTo(rad - 64, -5); ctx.lineTo(rad - 55, -5);
        ctx.lineTo(rad - 50, 0); ctx.lineTo(rad - 55, 6); ctx.lineTo(rad - 64, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      /* 가장자리 도트 장식 */
      for (i = 0; i < n; i++) {
        var am = i * this.segAngle() + rot;
        var dx = cx + Math.cos(am) * (rad + 4.5);
        var dy = cy + Math.sin(am) * (rad + 4.5);
        ctx.beginPath(); ctx.arc(dx, dy, 3, 0, 7);
        ctx.fillStyle = '#ffc93c'; ctx.fill();
      }
    },

    open: function () {
      Sound.ensure(); Sound.click();
      var st = Eco.spinStatus();
      streakDays.textContent = st.streak;
      $('wheelStreak').innerHTML =
        '연속 출석 <b>' + st.streak + '일차</b> — 하루 한 번 무료!';
      $('wheelResult').textContent = '버튼을 누르면 돌아갑니다!';
      $('wheelResult').classList.remove('win');
      $('btnSpin').disabled = !st.canSpin;
      $('btnSpin').textContent = st.canSpin ? '룰렛 돌리기' : '내일 다시 도전!';
      updateWheelBadge();
      this.overlay.classList.add('show');
    },
    close: function () {
      if (this.spinning) return;         // 회전 중엔 못 닫게 막음
      this.overlay.classList.remove('show');
      refreshMenuStats();
    },

    spin: function () {
      var self = this;
      var st = Eco.spinStatus();
      if (!st.canSpin || this.spinning) return;

      this.spinning = true;
      Eco.markSpun();                    // 중복 방지 선점
      $('btnSpin').disabled = true;

      var idx = Eco.rollWheel();
      var n = CFG.WHEEL.SEGMENTS.length;
      var seg = this.segAngle();
      /* 포인터(위쪽 -90°)가 당첨 구간 중심에 오도록 하는 최종 각도 */
      var centerTarget = -Math.PI / 2 - (idx * seg + seg / 2);
      var jitter = (Math.random() - 0.5) * seg * 0.62;
      var turns = CFG.WHEEL.MIN_TURNS + Math.floor(Math.random() * 2);
      var from = this.rot;
      var to = from + turns * Math.PI * 2 +
               ((centerTarget + jitter - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      var t0 = performance.now();
      var dur = CFG.WHEEL.SPIN_MS;
      var lastBucket = Math.floor((from + Math.PI / 2) / seg);
      var resEl = $('wheelResult');
      resEl.textContent = '두근두근...';
      resEl.classList.remove('win');

      function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

      function frame(now) {
        var t = Math.min(1, (now - t0) / dur);
        var ang = from + (to - from) * easeOutQuart(t);
        self.rot = ang;
        self.paint(ang);

        /* 칸 경계 지날 때 래칫 소리 */
        var bucket = Math.floor((ang + Math.PI / 2) / seg);
        if (bucket !== lastBucket && t < 0.985) {
          lastBucket = bucket;
          Sound.tick2();
        }
        if (t < 1) { self.raf = requestAnimationFrame(frame); return; }

        /* 결과 확정 */
        var won = CFG.WHEEL.SEGMENTS[idx].v;
        self.spinning = false;
        Sound.win();
        if (won >= 40) setTimeout(function () { Sound.jackpot(); }, 420);
        var bal = Eco.addGems(won);
        refreshGemHud();
        renderMissions();
        resEl.textContent = fmt(won) + '젬 당첨! (보유 ' + fmt(bal) + ')';
        resEl.classList.add('win');
        $('btnSpin').textContent = '내일 다시 도전!';
      }
      this.raf = requestAnimationFrame(frame);
    }
  };

  function updateWheelBadge() {
    var badge = $('wheelBadge');
    if (!badge) return;
    badge.hidden = !Eco.spinStatus().canSpin;
  }

  /* ════════════════════ 두배 도전 ════════════════════ */

  var du = {
    active: false, round: 0, pending: 0, busy: false,

    start: function (rewardGems) {
      this.active = true; this.round = 0;
      this.pending = rewardGems; this.busy = false;
      $('duPanel').style.display = '';
      $('duBtns').style.display = '';
      $('duHint').style.display = '';
      $('duResult').hidden = true;
      $('btnNext').style.display = 'none';
      this.refreshQuestion();
      this.setDialVisual(Eco.duOdds(0), 1);
    },

    refreshQuestion: function () {
      $('duQuestion').innerHTML =
        '이번 클리어 보상 <b>' + fmt(this.pending) + '젬</b>. 그대로 가져갈까요?';
      $('clearBonus').textContent =
        '두배 도전 보유 중: ' + fmt(this.pending) + '젬';
    },

    setDialVisual: function (chancePct, hubMult) {
      var winDeg = chancePct * 3.6;
      var dial = $('duDial');
      dial.style.background =
        'conic-gradient(var(--gold) 0deg ' + winDeg + 'deg, #7a2b1f ' + winDeg + 'deg 360deg)';
      dial.style.transform = 'rotate(0deg)';
      $('duHubTxt').textContent = 'x' + hubMult;
    },

    attempt: function () {
      var self = this;
      if (this.busy || !this.active) return;
      this.busy = true;
      Sound.click();

      var chance = Eco.duOdds(this.round);
      var win = Eco.duRoll(this.round);
      var maxRound = CFG.DOUBLEUP.CHANCES.length;

      /* 바늘 대신 다이얼을 회전시켜 당첨/낙방 구간에 멈춘다 */
      var wrap = document.querySelector('.du-board-wrap');
      var dial = $('duDial');
      var winDeg = chance * 3.6;
      var total = CFG.DOUBLEUP.SPIN_MS;
      var t0 = performance.now();
      var from = 0;
      var turns = 3 + Math.floor(Math.random() * 2);
      var tickBucket = 0;

      /* 목표 각도: 포인터가 위(-90°=270°) 기준, gold 구간 시작은 0°
         → 최종 회전각 theta 의 mod 360 이
           당첨이면 (90±winDeg*0.4), 실패면 낙방 구간 어딘가. */
      var landWinIn = (90 + (Math.random() - 0.5) * winDeg * 0.7);
      var landLoseIn = (winDeg + 20 + Math.random() * ((360 - winDeg) - 40));
      var nearMiss = false;
      if (!win && Math.random() < 0.6) {
        /* 아깝다 연출: 당첨 경계 근처에 착지 */
        landLoseIn = winDeg + (Math.random() * CFG.DOUBLEUP.NEAR_MISS_DEG * 0.7 + 2);
        nearMiss = true;
      }
      var landMod = win ? landWinIn : landLoseIn;
      var to = from + turns * 360 + (landMod - (from % 360) + 360) % 360;

      $('btnDuSafe').disabled = true;
      $('btnDuGo').disabled = true;

      function frame(now) {
        var t = Math.min(1, (now - t0) / total);
        var e = 1 - Math.pow(1 - t, 4);
        var ang = from + (to - from) * e;
        dial.style.transform = 'rotate(' + ang + 'deg)';
        var bucket = Math.floor(ang / 45);
        if (bucket !== tickBucket) { tickBucket = bucket; Sound.tick2(); }
        if (t < 1) { requestAnimationFrame(frame); return; }

        /* ── 판정 ── */
        self.busy = false;
        $('btnDuSafe').disabled = false;
        $('btnDuGo').disabled = false;

        if (win) {
          self.pending *= 2;
          self.round++;
          refreshGemHud();
          Sound.win();
          if (self.pending >= 40) setTimeout(function(){ Sound.jackpot(); }, 350);
          showDuResult(true, null, nearMiss);
          if (self.round >= maxRound) {
            /* 최대 연속 성공: 자동 정산 */
            dupFinish(false, true);
            return;
          }
          $('duHint').textContent =
            '성공! 이제 x' + Math.pow(2, self.round + 1) + ' 에 도전할 수 있어요 (당첨 ' +
            Eco.duOdds(self.round) + '%).';
          self.refreshQuestion();
          self.setDialVisual(Eco.duOdds(self.round), Math.pow(2, self.round));
        } else {
          if (nearMiss) {
            wrap.classList.remove('tease'); void wrap.offsetWidth;
            wrap.classList.add('tease');
          }
          Sound.lose();
          showDuResult(false, self.pending, nearMiss);
          dupFinish(false, false);
        }
      }
      requestAnimationFrame(frame);
    },

    takeSafe: function () {
      if (this.busy || !this.active) return;
      Sound.click();
      dupFinish(true, false);
    }
  };
    /* 실제 정산 처리 */
  function dupFinish(safeCollect, autoSettle) {
    if (!du.active) return;
    var gain = safeCollect ? du.pending : 0;
    du.active = false;
    $('duBtns').style.display = 'none';
    $('duHint').style.display = 'none';
    if (gain > 0) {
      var bal = Eco.addGems(gain);
      refreshGemHud();
      renderMissions();
      $('duResult').hidden = false;
      $('duResult').className = 'du-result win';
      $('duResult').textContent = '+' + fmt(gain) + '젬 획득! (보유 ' + fmt(bal) + ')';
      $('clearBonus').textContent = '획득 젬 +' + fmt(gain);
    } else if (autoSettle) {
      /* 최대 연속 성공 보상은 이미 pending 반영 → 여기서 정산 */
      bal = Eco.addGems(du.pending);
      refreshGemHud(); renderMissions();
      $('duResult').hidden = false;
      $('duResult').className = 'du-result win';
      $('duResult').textContent = '풀코스 성공! +' + fmt(du.pending) + '젬!';
      $('clearBonus').textContent = '획득 젬 +' + fmt(du.pending);
    }
    $('btnNext').style.display = '';
    Sound.click();
  }
  /* 실제 정산 처리는 상단의 dupFinish 가 담당합니다 */

  function showDuResult(winNow, lostAmount, nearMiss) {
    var el = $('duResult');
    el.hidden = false;
    if (winNow) {
      el.className = 'du-result win';
      el.textContent = '당첨! 보상 x' + Math.pow(2, du.round);
    } else {
      el.className = 'du-result lose';
      el.textContent = nearMiss
        ? '바짝 아깝다… ' + fmt(lostAmount) + '젬이 증발!'
        : '낙방… ' + fmt(lostAmount) + '젬 사라짐';
    }
  }

  /* ════════════════════ 보석 상자 (게임오버) ════════════════════ */

  var chestSeqToken = 0;

  function resetChestUI() {
    var cards = $('chestCards').querySelectorAll('.chest-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('open');
    }
    $('chestResult').innerHTML = '&nbsp;';
    $('chestZone').classList.remove('glow');
    $('btnChestMore').style.display = 'none';
  }

  function openChest() {
    var token = ++chestSeqToken;
    resetChestUI();
    var rarity = Eco.rollChest();
    var cards = Eco.drawChestCards(rarity);
    var cardEls = $('chestCards').querySelectorAll('.chest-card');

    function setFace(el, data) {
      var face = el.querySelector('.cc-face');
      face.innerHTML =
        '<span class="cc-rank">' + data.label + '</span>' +
        '<span class="cc-gem">+' + data.gems + '젬</span>';
      face.style.background = data.color;
    }

    [0, 1, 2].forEach(function (k) {
      setTimeout(function () {
        if (token !== chestSeqToken) return;
        if (k === 2) Sound.drum();
        else Sound.flip();
        setFace(cardEls[k], cards[k]);
        cardEls[k].classList.add('open');
        if (k === 2) {
          setTimeout(function () {
            if (token !== chestSeqToken) return;
            var isBig = rarity.key === 'epic' || rarity.key === 'legend';
            if (isBig) {
              Sound.jackpot();
              $('chestZone').classList.add('glow');
            } else {
              Sound.win();
            }
            var bal = Eco.addGems(rarity.gems);
            refreshGemHud();
            renderMissions();
            $('chestResult').textContent =
              '[' + rarity.label + '] 상자!' + (isBig ? ' 대박!' : '') +
              ' +' + rarity.gems + '젬 (보유 ' + fmt(bal) + ')';
            if (!game.chestMoreUsed) $('btnChestMore').style.display = '';
          }, 340);
        }
      }, k === 0 ? 500 : k === 1 ? 1150 : 1850);
    });
  }

  function offerChestMore() {
    game.chestMoreUsed = true;
    Ads.showRewarded(
      openChest,
      function () {
        $('btnChestMore').textContent = '광고를 사용할 수 없어요';
        setTimeout(function () {
          $('btnChestMore').style.display = 'none';
        }, 1500);
      },
      '광고를 시청하면 상자를 한 번 더 엽니다.'
    );
  }

  /* ════════════════════ 런/스테이지 흐름 ════════════════════ */

  function startGame() {
    game.grid = B.createGrid();
    game.score = 0; game.displayScore = 0;
    game.runStars = 0;
    game.reviveUsed = false;
    game.bestChainRun = 0;
    game.chestMoreUsed = false;
    game.milestonesHit = {}; game.newBestFlag = false;
    game.heat = 0; game.feverUntil = 0;
    game.fx.falling = null; game.fx.pops.length = 0;
    game.fx.floats.length = 0; game.fx.shakeAmp = 0;
    beginStage(1);
    game.state = 'playing';
    hideAllOverlays();
    refreshGemHud();
    updateHUD();
  }

  function beginStage(n) {
    game.stage = n;
    game.stageStartScore = game.score;
    game.target = B.targetScore(n);
    game.dropsTotal = B.dropsForStage(n);
    game.dropsLeft = game.dropsTotal;
    game.pendingClear = false;

    if (!B.hasAnyRoom(game.grid)) {
      B.doReviveClear(game.grid, 1);
      pushCenterFloat('판 정리!', '#ff9636');
    }
    if (typeof game.nextValue !== 'number' || game.nextValue < 1) game.nextValue = 1;
    game.currentValue = rollSpawn();
    game.nextValue = rollSpawn();

    game.busy = false; game.phase = 'idle';
    game.state = 'playing';
    hideAllOverlays();
    updateHUD(true);
  }

  function rollSpawn() {
    var special = B.decideSpecial(game.stage, game.grid);
    if (special !== null) return special;
    return B.pickSpawnValue(game.grid);
  }

  function tryDrop(col) {
    if (game.state !== 'playing' || game.busy) return;
    var row = B.dropRow(game.grid, col);
    if (row < 0) {
      Sound.illegal();
      game.fx.shakeAmp = 5; game.fx.shakeStart = performance.now();
      return;
    }
    Sound.ensure(); Sound.drop();

    game.dropsLeft--;
    if (game.dropsLeft >= 1 && game.dropsLeft <= 3) Sound.tick();

    B.applyDrop(game.grid, col, game.currentValue);
    game.fx.falling = {
      col: col, toR: row, value: game.currentValue,
      fromY: cellOffsetX() - cellPx() * 1.4,
      t0: performance.now(), done: false
    };
    game.busy = true; game.phase = 'drop';
    updateHUD();
  }

  function landCheck(now) {
    game.fx.falling = null;
    game.waveIdx = 0;
    game.phase = 'wave';
    queueWave(50);
  }

  function queueWave(delay) {
    clearTimeout(game.waveTimer);
    game.waveTimer = setTimeout(function () { resolveWave(performance.now()); }, delay);
  }

  function resolveWave(now) {
    var pairs = B.findWavePairs(game.grid);
    if (!pairs.length) { settle(now); return; }

    game.waveIdx++;
    if (game.waveIdx > game.bestChainRun) game.bestChainRun = game.waveIdx;
    var events = B.applyPairs(game.grid, pairs);

    /* 특수 블록 파괴(돌·황금코인) */
    var dead = B.breakSpecialsNear(game.grid, events);
    var stonePts = dead.stones.length * CFG.STONE.BREAK_SCORE;

    var mult = CFG.COMBO_BONUS[Math.min(game.waveIdx - 1, CFG.COMBO_BONUS.length - 1)];
    var feverOn = game.feverUntil > now;
    var base = 0;

    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      base += e.newValue;
      game.fx.pops.push({ r: e.r, c: e.c, value: e.newValue, t0: now });
      game.fx.floats.push({
        x: cellOffsetX() + (e.c + 0.5) * cellPx(),
        y: cellOffsetX() + (e.r + 0.35) * cellPx(),
        text: '+' + Math.round(e.newValue * mult * (feverOn ? CFG.FEVER.SCORE_MULT : 1)),
        color: mult > 1 ? '#ffc93c' : '#ffffff',
        t0: now
      });
    }
    var gained = Math.round(base * mult * (feverOn ? CFG.FEVER.SCORE_MULT : 1)) + stonePts;
    game.score += gained;

    /* 돌 파괴 연출 */
    for (i = 0; i < dead.stones.length; i++) {
      (function (d) {
        game.fx.floats.push({
          x: cellOffsetX() + (d.c + 0.5) * cellPx(),
          y: cellOffsetX() + (d.r + 0.35) * cellPx(),
          text: '+' + CFG.STONE.BREAK_SCORE, color: '#b9b2a6', t0: now
        });
        R.burst(cellOffsetX() + (d.c + 0.5) * cellPx(),
                cellOffsetX() + (d.r + 0.5) * cellPx(), '#8f887c', 14);
      })(dead.stones[i]);
    }
    if (dead.stones.length) Sound.stoneBreak();

    /* 황금코인 파괴 → 점수 + 젬 지급 */
    for (i = 0; i < dead.coins.length; i++) {
      (function (d, k) {
        var px = cellOffsetX() + (d.c + 0.5) * cellPx();
        var py = cellOffsetX() + (d.r + 0.35) * cellPx();
        game.fx.floats.push({
          x: px, y: py,
          text: '+' + CFG.COIN.BREAK_SCORE + '! 골드!', color: '#ffc93c', t0: now
        });
        game.fx.floats.push({
          x: px, y: py + cellPx() * 0.34,
          text: '젬 +' + CFG.COIN.GEMS_PER_POP, color: '#ffe08a',
          t0: now + 110
        });
        R.burst(px, py + cellPx() * 0.15, '#ffd75e', 18);
        R.burstStars(px, py, 5);
      })(dead.coins[i], i);
    }
    if (dead.coins.length) {
      Sound.coin();
      setTimeout(function () { Sound.gem(); }, 160);
      Eco.addGems(dead.coins.length * CFG.COIN.GEMS_PER_POP);
      refreshGemHud();
      renderMissions();
    }

    Sound.merge(events[0].newValue, game.waveIdx);

    /* 피버 충전 */
    if (game.feverUntil <= now) {
      game.heat = Math.min(CFG.FEVER.CHARGE_AT, game.heat + CFG.FEVER.HEAT_PER_WAVE);
      if (game.heat >= CFG.FEVER.CHARGE_AT) triggerFever(now);
    }

    if (game.waveIdx >= 2 || events[0].newValue >= 64) {
      game.fx.shakeAmp = Math.min(9, 2 + game.waveIdx * 1.4);
      game.fx.shakeStart = now;
    }
    if (mult >= 2) showCombo(mult, game.waveIdx);

    checkMilestones(events);

    if (!game.pendingClear && game.score - game.stageStartScore >= game.target) {
      game.pendingClear = true;
      pushCenterFloat('목표 달성!', '#43d68c');
    }

    var moved = B.compact(game.grid);
    for (var c = 0; c < CFG.COLS; c++) {
      if (moved[c] > 0) game.fx.colOffsets[c] = { cells: moved[c], t0: now };
    }
    updateHUD();
    queueWave(CFG.WAVE_DELAY_MS);
  }

  function settle(now) {
    game.phase = 'idle';

    if (game.pendingClear) { stageClear(); return; }

    if (game.waveIdx === 0 && game.feverUntil <= now) {
      game.heat = Math.max(0, game.heat - CFG.FEVER.HEAT_FAIL_PENALTY);
      updateHeatBar();
    }

    if (!B.hasAnyRoom(game.grid)) { gameOver('판이 가득 찼어요!'); return; }

    if (game.dropsLeft <= 0) { gameOver('드롭을 다 썼어요!'); return; }

    game.currentValue = game.nextValue;
    game.nextValue = rollSpawn();
    game.busy = false;
    updateHUD();
  }

  function triggerFever(now) {
    game.heat = 0;
    game.feverUntil = now + CFG.FEVER.DURATION_MS;
    Sound.fever();
    var b = comboBanner;
    b.textContent = '피버 타임!! 점수 x' + CFG.FEVER.SCORE_MULT;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    clearTimeout(comboHideTimer);
    comboHideTimer = setTimeout(function () { b.classList.remove('pop'); }, 1400);
    document.body.classList.add('fever-on');
    setTimeout(function () { document.body.classList.remove('fever-on'); },
               CFG.FEVER.DURATION_MS);
    updateHeatBar();
  }

  /* ─── 단계 클리어 → 두배 도전 진입 ─── */
  function stageClear() {
    game.state = 'clear';
    Sound.clear();

    var ratio = game.dropsLeft / Math.max(1, game.dropsTotal);
    var stars = ratio >= CFG.STAGE.STAR_3_RATIO ? 3
              : ratio >= CFG.STAGE.STAR_2_RATIO ? 2 : 1;
    var bonus = game.dropsLeft * CFG.STAGE.BONUS_PER_DROP;
    game.score += bonus;
    game.runStars += stars;
    game.totalStars += stars;
    B.saveStars(game.totalStars);
    Eco.bumpMission('clears', 1);                 // 오늘의 미션 카운터
    if (game.bestChainRun >= 3) Eco.recordChain(game.bestChainRun);
    if (game.stage > game.stageBest) {
      game.stageBest = game.stage;
      B.saveStageBest(game.stageBest);
    }

    $('clearTitle').textContent = 'STAGE ' + game.stage + ' 클리어!';
    $('nextTarget').textContent =
      '다음 STAGE ' + (game.stage + 1) + ' 목표: ' +
      fmt(B.targetScore(game.stage + 1)) + '점';

    /* 별 순차 점등 */
    var starEls = [$('cs1'), $('cs2'), $('cs3')];
    starEls.forEach(function (s, i) {
      s.classList.remove('lit');
      if (i < stars) {
        setTimeout(function () {
          s.classList.add('lit');
          Sound.star(i);
          R.burstStars(R.gap + R.cell * CFG.COLS / 2, R.gap + R.cell * 2, 8);
        }, 450 + i * 380);
      }
    });

    Ads.maybeInterstitial(function () {
      ovClear.classList.add('show');
      Ads.clearsSeen++;
      /* 남은 드롭 보너스 문구에 원래 목적(드롭 효율) 유지 */
      $('clearBonus').textContent = '남은 드롭 보너스 +' + fmt(bonus) + '점';
      var rewardGems = CFG.GEMS.CLEAR_BASE + stars * CFG.GEMS.PER_STAR;
      du.start(rewardGems);
      refreshGemHud();
      updateHUD();
    });
  }

  function nextStage() {
    Sound.click();
    hideAllOverlays();
    beginStage(game.stage + 1);
  }

  /* ─── 게임오버 ─── */
  function gameOver(reason) {
    clearTimeout(game.waveTimer);
    game.state = 'over';
    Sound.over();
    Ads.oversSeen++;

    /* 최고 연쇄 저장 + 미션 반영 */
    if (game.bestChainRun > 0) {
      Eco.recordChain(game.bestChainRun);
      menuChain.textContent = Eco.chainBest();
    }

    if (game.score > game.best) {
      game.best = game.score; game.newBestFlag = true;
      B.saveBest(game.score);
      setTimeout(function () { Sound.best(); }, 420);
      var n = 14;
      for (var i = 0; i < n; i++) {
        R.burst(
          Math.random() * elCanvas.getBoundingClientRect().width,
          Math.random() * elCanvas.getBoundingClientRect().height * 0.7,
          CFG.PALETTE[i % CFG.PALETTE.length], 16
        );
      }
    }

    $('overReason').textContent = reason || '';
    $('finalScore').textContent = fmt(game.score);
    $('finalBest').textContent = fmt(game.best);
    $('finalStage').textContent = game.stage;
    $('finalChain').textContent = game.bestChainRun;
    $('newBestBadge').style.display = game.newBestFlag ? '' : 'none';

    /* 부활 조건 */
    var freeCells = CFG.ROWS * CFG.COLS - B.countFilled(game.grid);
    var canRevive = !game.reviveUsed &&
                  game.dropsLeft <= 0 &&
                  freeCells <= CFG.REVIVE.MIN_FREE_CELLS;
    var canAffordGem = Eco.gems() >= CFG.GEMS.REVIVE_COST;
    $('btnRevive').style.display = canRevive ? '' : 'none';
    $('btnReviveGem').style.display =
      (canRevive && canAffordGem) ? '' : 'none';
    $('btnReviveGem').innerHTML =
      '젬 ' + CFG.GEMS.REVIVE_COST + '개로 부활 <small>(보유 ' +
      fmt(Eco.gems()) + ')</small>';

    resetChestUI();
    $('ovOver').classList.add('show');
    /* 상자 자동 개봉 시퀀스 */
    setTimeout(openChest, 650);
  }

  /* ─── 부활 ─── */
  function doRevive() {
    var res = B.doReviveClear(game.grid, CFG.REVIVE.CLEAR_BOTTOM_ROWS);

    for (var i = 0; i < CFG.COLS; i++) {
      R.burst(
        cellOffsetX() + (i + 0.5) * cellPx(),
        cellOffsetX() + (CFG.ROWS - 1) * cellPx(),
        '#ff9636', 16
      );
    }
    game.fx.shakeAmp = 9; game.fx.shakeStart = performance.now();
    pushCenterFloat('부활! 아래 ' + res.removedRows.length + '줄 폭파', '#ff5e5b');

    game.reviveUsed = true;
    game.dropsLeft = CFG.REVIVE.RESTORE_DROPS;
    game.dropsTotal = Math.max(game.dropsTotal, CFG.REVIVE.RESTORE_DROPS);
    game.heat = 0; game.feverUntil = 0;

    game.state = 'playing';
    hideAllOverlays();
    chestSeqToken++;                              // 상자 시퀀스 취소

    if (!B.hasAnyRoom(game.grid)) gameOver('판이 가득 찼어요!');
    else { game.busy = false; refreshGemHud(); updateHUD(true); }
  }

  function offerRevive() {
    Sound.click();
    Ads.showRewarded(
      doRevive,
      function () {
        $('btnRevive').textContent = '광고를 사용할 수 없어요';
        setTimeout(function () {
          $('btnRevive').textContent = '광고 보고 무료 부활';
        }, 1800);
      },
      '광고를 시청하면 그대로 이어서 플레이합니다.'
    );
  }

  function offerGemRevive() {
    Sound.click();
    if (Eco.spendGems(CFG.GEMS.REVIVE_COST)) {
      doRevive();
    } else {
      $('btnReviveGem').textContent = '젬이 부족해요…';
      setTimeout(updateReviveBtnAfterFail, 1400);
    }
  }
  function updateReviveBtnAfterFail() {
    if (game.state === 'over') {
      $('btnReviveGem').innerHTML =
        '젬 ' + CFG.GEMS.REVIVE_COST + '개로 부활 <small>(보유 ' +
        fmt(Eco.gems()) + ')</small>';
    }
  }

  /* ════════════════════ 일시정지 ════════════════════ */

  var pausedAt = 0;
  function setPaused(p) {
    if (p && game.state === 'playing') {
      game.state = 'paused'; pausedAt = performance.now();
      $('ovPause').classList.add('show');
    } else if (!p && game.state === 'paused') {
      var d = performance.now() - pausedAt;
      [game.fx.falling, game.fx.pops, game.fx.floats].forEach(function (arrItem) {
        if (!arrItem) return;
        if (Array.isArray(arrItem)) arrItem.forEach(function (o) { o.t0 += d; });
        else arrItem.t0 += d;
      });
      for (var c = 0; c < CFG.COLS; c++)
        if (game.fx.colOffsets[c]) game.fx.colOffsets[c].t0 += d;
      if (game.feverUntil > pausedAt) game.feverUntil += d;
      game.state = 'playing';
      $('ovPause').classList.remove('show');
    }
  }

  /* ════════════════════ 그리기 루프 ════════════════════ */

  function loop(now) {
    requestAnimationFrame(loop);

    if (game.phase === 'drop' && game.fx.falling && game.fx.falling.done) {
      landCheck(now);
    }
    if (game.displayScore !== game.score) {
      var diff = game.score - game.displayScore;
      game.displayScore += Math.ceil(diff * 0.18);
      elScore.textContent = fmt(game.displayScore);
      updateProgressBar();
    }
    updateHeatBar();
    R.draw(now, game);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game.state === 'playing') setPaused(true);
  });

  /* ════════════════════ 입력 ════════════════════ */

  function colFromEvent(ev) {
    var rect = elCanvas.getBoundingClientRect();
    var clientX = (ev.touches ? ev.touches[0].clientX : ev.clientX);
    var col = Math.floor((clientX - rect.left) / rect.width * CFG.COLS);
    return Math.max(0, Math.min(CFG.COLS - 1, col));
  }

  function bindInput(cv) {
    cv.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      Sound.ensure();
      game.aimCol = colFromEvent(ev);
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    cv.addEventListener('pointermove', function (ev) {
      game.aimCol = colFromEvent(ev);
    });
    cv.addEventListener('pointerup', function (ev) {
      ev.preventDefault();
      tryDrop(colFromEvent(ev));
    });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('keydown', function (e) {
      /* 룰렛 열려있으면 먼저 처리 */
      if ($('ovWheel').classList.contains('show')) {
        if (e.key === 'Enter' || e.key === ' ') { Sound.click(); Wheel.spin(); }
        else if (e.key === 'Escape') { Wheel.close(); }
        return;
      }
      if (e.key === 'ArrowLeft')  { game.aimCol = Math.max(0, (game.aimCol < 0 ? 0 : game.aimCol) - 1); }
      else if (e.key === 'ArrowRight'){ game.aimCol = Math.min(CFG.COLS - 1, (game.aimCol < 0 ? 0 : game.aimCol) + 1); }
      else if (e.key === ' ') {
        if (game.state === 'playing') tryDrop(game.aimCol < 0 ? Math.floor(CFG.COLS / 2) : game.aimCol);
        else if (game.state === 'menu' || game.state === 'over') startGame();
      }
      else if (e.key === 'Enter') {
        if (game.state === 'menu' || game.state === 'over') startGame();
        else if (game.state === 'clear' && $('btnNext').style.display !== 'none') nextStage();
      }
      else if (e.key === 'm' || e.key === 'M') { toggleSoundBtn(); }
      else if (e.key === 'r' || e.key === 'R') { if (game.state !== 'menu') startGame(); }
      else if (e.key === 'Escape') {
        if (game.state === 'playing' || game.state === 'paused')
          setPaused(game.state === 'playing');
      }
    });
  }

  /* ════════════════════ HUD / 오버레이 ════════════════════ */

  function paintChip(spanEl, value) {
    if (value === B.STONE) {
      spanEl.textContent = '돌';
      spanEl.style.background = CFG.THEME.STONE;
      spanEl.style.color = '#fff';
      return;
    }
    if (value === B.COIN) {
      spanEl.textContent = '코인';
      spanEl.style.background = '#ffc93c';
      spanEl.style.color = '#1a130c';
      spanEl.style.fontSize = '11px';
      return;
    }
    spanEl.style.fontSize = '';
    spanEl.textContent = value;
    spanEl.style.background = R.colorOf(value);
    spanEl.style.color = '#fff';
  }

  function updateProgressBar() {
    var done = Math.max(0, game.displayScore - game.stageStartScore);
    var pct = Math.min(100, done / Math.max(1, game.target) * 100);
    elFill.style.width = pct + '%';
    elFill.classList.toggle('full', pct >= 100);
    elFill.parentElement.classList.toggle('near', pct >= 80 && pct < 100);
    elTargetTxt.textContent = fmt(Math.min(done, game.target)) + ' / ' + fmt(game.target)
                            + (pct >= 100 ? ' 달성!' : '');
  }

  function updateHeatBar() {
    var feverOn = game.feverUntil > performance.now();
    if (elFeverTag) elFeverTag.hidden = !feverOn;
    if (feverOn) {
      elHeat.style.width = '100%';
      elHeat.classList.add('fever');
      return;
    }
    elHeat.classList.remove('fever');
    elHeat.style.width = (game.heat / CFG.FEVER.CHARGE_AT * 100) + '%';
  }

  function refreshMenuStats() {
    menuBest.textContent = fmt(game.best);
    menuStars.textContent = game.totalStars;
    menuStage.textContent = game.stageBest;
    menuChain.textContent = Eco.chainBest();
    var st = Eco.spinStatus();
    streakDays.textContent = st.streak;
    collectMissionsIfAny();
    updateWheelBadge();
    refreshGemHud();
  }

  function updateHUD(fullRefresh) {
    elBest.textContent = fmt(game.best);
    elStage.textContent = game.stage;
    elDrops.textContent = game.dropsLeft;
    elDrops.classList.toggle('danger', game.dropsLeft <= 3);
    paintChip(elCur, game.currentValue);
    paintChip(elNext, game.nextValue);
    if (fullRefresh) updateProgressBar();
  }

  function pushCenterFloat(text, color) {
    game.fx.floats.push({
      x: cellOffsetX() + CFG.COLS / 2 * cellPx(),
      y: cellOffsetX() + (CFG.ROWS / 2 - 0.6) * cellPx(),
      text: text, color: color, t0: performance.now()
    });
  }

  var comboHideTimer = null;
  function showCombo(mult, waves) {
    comboBanner.textContent = '연쇄 x' + mult + ' (' + waves + '단)!';
    comboBanner.style.fontSize = Math.min(38, 23 + waves * 2.5) + 'px';
    comboBanner.classList.remove('pop'); void comboBanner.offsetWidth;
    comboBanner.classList.add('pop');
    clearTimeout(comboHideTimer);
    comboHideTimer = setTimeout(function () { comboBanner.classList.remove('pop'); }, 800);
  }

  function checkMilestones(events) {
    for (var i = 0; i < events.length; i++) {
      var v = events[i].newValue;
      if (v >= 32 && !game.milestonesHit[v]) {
        game.milestonesHit[v] = true;
        pushCenterFloat(v + ' 돌파!', '#ffb300');
      }
    }
  }

  function hideAllOverlays() {
    ovMenu.classList.remove('show');
    ovPause.classList.remove('show');
    ovOver.classList.remove('show');
    ovClear.classList.remove('show');
  }

  function toggleSoundBtn() {
    var muted = Sound.toggle();
    $('btnSound').classList.toggle('off', muted);
    $('btnSoundP').classList.toggle('off', muted);
  }

  function backToMenu() {
    Sound.click();
    game.state = 'menu';
    hideAllOverlays();
    ovMenu.classList.add('show');
    refreshMenuStats();
    updateHUD(true);
  }

  /* ════════════════════ 초기화 ════════════════════ */

  function init() {
    elCanvas = $('board'); elScore = $('score'); elBest = $('best');
    elStage = $('stageNum'); elDrops = $('dropsLeft'); elGems = $('gemCount');
    elFill = $('progressFill'); elTargetTxt = $('targetText');
    elCur = $('tileCur'); elNext = $('tileNext'); elHeat = $('heatFill');
    elFeverTag = $('feverTag');
    ovMenu = $('ovMenu'); ovPause = $('ovPause'); ovOver = $('ovOver');
    ovClear = $('ovClear'); comboBanner = $('comboBanner');
    menuBest = $('menuBest'); menuStars = $('menuStars');
    menuStage = $('menuStage'); menuChain = $('menuChain');
    streakDays = $('streakDays');

    R.init(elCanvas);
    Sound.loadMuted();
    $('btnSound').classList.toggle('off', Sound.muted);
    $('btnSoundP').classList.toggle('off', Sound.muted);

    Wheel.init();
    bindInput(elCanvas);

    /* ── 이벤트 연결 ── */
    $('btnStart').addEventListener('click', function () { Sound.ensure(); Sound.click(); startGame(); });
    $('btnAgain').addEventListener('click', function () {
      Sound.ensure(); Sound.click();
      Ads.maybeInterstitial(function () { startGame(); });
    });
    $('btnMenuFromOver').addEventListener('click', backToMenu);
    $('btnNext').addEventListener('click', nextStage);
    $('btnRevive').addEventListener('click', offerRevive);
    $('btnReviveGem').addEventListener('click', offerGemRevive);
    $('btnChestMore').addEventListener('click', offerChestMore);
    $('btnResume').addEventListener('click', function () { Sound.click(); setPaused(false); });
    $('btnQuit').addEventListener('click', function () { Sound.click(); setPaused(false); startGame(); });
    $('btnMenuPause').addEventListener('click', function () { Sound.click(); setPaused(false); backToMenu(); });
    $('btnPause').addEventListener('click', function () { Sound.click(); setPaused(true); });
    $('btnSound').addEventListener('click', toggleSoundBtn);
    $('btnSoundP').addEventListener('click', toggleSoundBtn);

    $('btnWheelOpen').addEventListener('click', function () { Wheel.open(); });
    $('btnWheelClose').addEventListener('click', function () { Wheel.close(); });
    $('btnSpin').addEventListener('click', function () { Wheel.spin(); });

    /* 두배 도전 */
    $('btnDuGo').addEventListener('click', function () { du.attempt(); });
    $('btnDuSafe').addEventListener('click', function () { du.takeSafe(); });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { R.resize(); }).observe(elCanvas.parentElement);
    }
    window.addEventListener('resize', function () { R.resize(); });

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }

    elScore.textContent = '0';
    game.target = B.targetScore(1);
    game.dropsTotal = B.dropsForStage(1);
    game.dropsLeft = game.dropsTotal;
    $('btnNext').style.display = 'none';

    refreshMenuStats();
    updateHUD(true);
    requestAnimationFrame(loop);

    /* 테스트/디버그 핸들 */
    window.__gdGame = game;
    window.__gdAds = Ads;
    window.__gdWheel = Wheel;
    window.__gdDu = du;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
