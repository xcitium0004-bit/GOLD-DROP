/* ════════════════════════════════════════════════════════════════════
   골드드롭 - 렌더러 (Canvas 2D 그리기 전담)
   ──────────────────────────────────────────────────────────────────
   ★ "펠트 & 골드" 스타일
     - 크림 판 + 먹색 잉크 테두리 + 하드 섀도우
     - 황금코인 타일은 반짝이는 동전으로 별도 연출
     - 목표 근접 시 골드 펄스 / 피버 비네트 / 위험 붉은 펄스
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var CFG = global.MD.CONFIG;
  var T = CFG.THEME;

  /* ── 애니메이션 보조 함수 ── */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInQuad(t) { return t * t; }
  function easeOutBack(t) {
    var c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  /* 둥근 사각형 경로 (구형 브라우저 호환) */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var Renderer = {

    canvas: null, ctx: null,
    cell: 60,
    particles: [],

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
    },

    resize: function () {
      var cv = this.canvas;
      var rect = cv.getBoundingClientRect();
      if (rect.width < 10) return;
      var dpr = Math.min(2.5, global.devicePixelRatio || 1);
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
      this.dpr = dpr;
      this.gap = 6;                              /* 안쪽 여백(px) */
      this.cell = (rect.width - this.gap * 2) / CFG.COLS;
    },

    colorOf: function (v) {
      if (!v || v < 0) return null;
      var idx = Math.log2(v);
      if (idx < CFG.PALETTE.length) return CFG.PALETTE[idx];
      return CFG.PALETTE[CFG.PALETTE.length - 1];
    },
    isGold: function (v) { return v > 0 && Math.log2(v) >= CFG.PALETTE.length; },

    burst: function (px, py, color, count) {
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = (60 + Math.random() * 160) * this.cell / 60;
        this.particles.push({
          x: px, y: py,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: 0.45 + Math.random() * 0.25, age: 0,
          size: 2.5 + Math.random() * 4, color: color
        });
      }
    },

    /* 별 모양 조각 (클리어 축하용) */
    burstStars: function (px, py, count) {
      for (var i = 0; i < count; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        var sp = (140 + Math.random() * 180) * this.cell / 60;
        this.particles.push({
          x: px, y: py,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.7 + Math.random() * 0.3, age: 0,
          size: 5 + Math.random() * 6,
          color: ['#ffc93c', '#ff5e5b', '#57c8ff', '#43d68c'][i % 4],
          star: true
        });
      }
    },

    drawStar: function (ctx, cx, cy, spikes, outerR, innerR) {
      var rot = Math.PI / 2 * 3;
      var x = cx, y = cy;
      var step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(cx, cy - outerR);
      for (var i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerR; y = cy + Math.sin(rot) * outerR;
        ctx.lineTo(x, y); rot += step;
        x = cx + Math.cos(rot) * innerR; y = cy + Math.sin(rot) * innerR;
        ctx.lineTo(x, y); rot += step;
      }
      ctx.lineTo(cx, cy - outerR);
      ctx.closePath();
    },

    /* ═══ 매 프레임 그리기 ═══ */
    draw: function (now, game) {
      var ctx = this.ctx;
      if (!ctx) return;
      var dpr = this.dpr || 1;
      var cell = this.cell;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var W = this.canvas.width / dpr, H = this.canvas.height / dpr;

      /* 화면 흔들림 */
      if (game.fx.shakeAmp > 0.3) {
        var sT = now - game.fx.shakeStart;
        var decay = Math.max(0, 1 - sT / 220);
        ctx.translate(
          Math.sin(sT * 0.9) * game.fx.shakeAmp * decay,
          Math.cos(sT * 1.3) * game.fx.shakeAmp * decay * 0.6
        );
        if (decay <= 0) game.fx.shakeAmp = 0;
      }

      /* 종이 판 (플랫, 잉크 테두리는 CSS가 담당 → 안쪽만 칠함) */
      ctx.clearRect(-20, -20, W + 40, H + 40);
      rr(ctx, 3, 3, W - 6, H - 6, 12);
      ctx.fillStyle = T.BG_BOARD; ctx.fill();

      /* 조작 중 열 하이라이트 or 금지 열 */
      var aimR = (game.aimCol >= 0) ? global.MD.Board.dropRow(game.grid, game.aimCol) : -1;
      if (game.state === 'playing' && game.aimCol >= 0) {
        ctx.fillStyle = aimR >= 0 ? T.COLUMN_TINT : T.ILLEGAL;
        ctx.fillRect((this.gap || 6) + game.aimCol * cell, 4, cell, H - 8);
        /* 열 바닥 마커(역삼각형) */
        if (aimR >= 0) {
          var mx = (this.gap || 6) + (game.aimCol + 0.5) * cell;
          ctx.fillStyle = T.INK;
          ctx.beginPath();
          ctx.moveTo(mx - 7, H - 16);
          ctx.lineTo(mx + 7, H - 16);
          ctx.lineTo(mx, H - 7);
          ctx.closePath(); ctx.fill();
        }
      }

      /* 빈 칸: 못(pig) 점 그리드 — 공작판 느낌 */
      ctx.fillStyle = T.PEG;
      for (var r = 0; r < CFG.ROWS; r++) {
        for (var c = 0; c < CFG.COLS; c++) {
          if (game.grid[r][c]) continue;
          var ex = this.px(c), ey = this.py(r, c, now, game);
          ctx.beginPath();
          ctx.arc(ex + cell / 2, ey + cell / 2, Math.max(2, cell * 0.05), 0, 7);
          ctx.fill();
        }
      }

      /* ── 고정 블록들 ── */
      for (r = 0; r < CFG.ROWS; r++) {
        for (c = 0; c < CFG.COLS; c++) {
          var v = game.grid[r][c];
          if (!v) continue;
          this.tile(this.px(c), this.py(r, c, now, game), cell, v, 1, now);
        }
      }

      /* ── 머지 팝 애니메이션 ── */
      for (var i = game.fx.pops.length - 1; i >= 0; i--) {
        var p = game.fx.pops[i];
        var pt = clamp01((now - p.t0) / CFG.POP_MS);
        if (pt >= 1) { game.fx.pops.splice(i, 1); continue; }
        var sc = easeOutBack(pt);
        var x = this.px(p.c), y = this.py(p.r, p.c, now, game);
        ctx.globalAlpha = (1 - pt) * 0.55;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * (0.25 + pt * 0.55), 0, 7);
        ctx.stroke();
        ctx.globalAlpha = 1;
        this.tile(x, y, cell, p.value, sc, now);
        if (pt > 0.12 && !p.burstDone) {
          p.burstDone = true;
          this.burst(x + cell / 2, y + cell / 2, this.colorOf(p.value), 12);
        }
      }

      /* ── 낙하 중 블록 (공중 회전 살짝) ── */
      var f = game.fx.falling;
      if (f) {
        var ft = clamp01((now - f.t0) / CFG.DROP_MS);
        var fy = f.fromY + (this.py(f.toR, f.col, now, game) - f.fromY) * easeInQuad(ft);
        var tilt = Math.sin(ft * Math.PI) * 0.06;
        ctx.save();
        ctx.translate(this.px(f.col) + cell / 2, fy + cell / 2);
        ctx.rotate(tilt);
        this.tile(-cell / 2, -cell / 2, cell, f.value, 1, now);
        ctx.restore();
        if (ft >= 1) f.done = true;
      }

      /* ── 드롭 미리보기 유령 ── */
      if (game.state === 'playing' && game.aimCol >= 0 && aimR >= 0 && !f) {
        this.tileGhost(this.px(game.aimCol), this.py(aimR, game.aimCol, now, game), cell, game.currentValue);
      }

      /* ── 점수 플로팅 텍스트 (잉크 스트로크+캔디색, 만화 풍) ── */
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (i = game.fx.floats.length - 1; i >= 0; i--) {
        var fl = game.fx.floats[i];
        var ft2 = clamp01((now - fl.t0) / 750);
        if (ft2 >= 1) { game.fx.floats.splice(i, 1); continue; }
        var rise = easeOutCubic(ft2) * cell * 0.95;
        var sc2 = ft2 < 0.18 ? 0.6 + easeOutBack(ft2 / 0.18) * 0.4 : 1;
        ctx.globalAlpha = 1 - ft2 * ft2;
        ctx.font = '900 ' + Math.round(cell * 0.32 * sc2) + 'px Jua, sans-serif';
        ctx.lineWidth = Math.max(3, cell * 0.07);
        ctx.strokeStyle = T.INK;
        ctx.lineJoin = 'round';
        ctx.strokeText(fl.text, fl.x, fl.y - rise);
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, fl.x, fl.y - rise);
        ctx.globalAlpha = 1;
      }

      /* ── 파티클 ── */
      var dt = Math.min(0.05, (now - (this._last || now)) / 1000);
      this._last = now;
      for (i = this.particles.length - 1; i >= 0; i--) {
        var pa = this.particles[i];
        pa.age += dt;
        if (pa.age >= pa.life) { this.particles.splice(i, 1); continue; }
        pa.vy += 420 * dt;
        pa.x += pa.vx * dt; pa.y += pa.vy * dt;
        var k = 1 - pa.age / pa.life;
        ctx.globalAlpha = k;
        ctx.fillStyle = pa.color;
        if (pa.star) {
          ctx.save();
          ctx.translate(pa.x, pa.y);
          ctx.rotate(pa.age * 8);
          this.drawStar(ctx, 0, 0, 5, pa.size, pa.size * 0.45);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
        }
      }
      ctx.globalAlpha = 1;

      /* ── 피버 비네트 (불꽃 가장자리 맥동) ── */
      if (game.feverUntil > now) {
        var pulse = 0.28 + Math.sin(now / 90) * 0.10;
        var grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
        grad.addColorStop(0, 'rgba(255,120,40,0)');
        grad.addColorStop(1, T.FEVER_GLOW + pulse + ')');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        /* 불티 파티클 */
        if (Math.random() < 0.35) {
          this.particles.push({
            x: Math.random() * W, y: H + 6,
            vx: (Math.random() - 0.5) * 30, vy: -(120 + Math.random() * 140),
            life: 0.6 + Math.random() * 0.4, age: 0,
            size: 2.5 + Math.random() * 3,
            color: ['#ffb300', '#ff7828', '#ff5e5b'][Math.floor(Math.random() * 3)]
          });
        }
      }

      /* ── 위험 경고 (남은 드롭 ≤ 3): 붉은 펄스 ── */
      if (game.state === 'playing' && game.dropsLeft <= 3 && game.dropsLeft > 0) {
        var dp = 0.22 + Math.abs(Math.sin(now / 300)) * 0.20;
        var g2 = ctx.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.8);
        g2.addColorStop(0, 'rgba(255,60,50,0)');
        g2.addColorStop(1, T.DANGER_GLOW + dp + ')');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.restore();
    },

    px: function (col) { return (this.gap || 6) + col * this.cell; },
    py: function (row, col, now, game) {
      var y = (this.gap || 6) + row * this.cell;
      var off = game.fx.colOffsets[col];
      if (off && off.cells > 0) {
        var t = clamp01((now - off.t0) / CFG.SLIDE_MS);
        y += off.cells * this.cell * (1 - easeOutCubic(t));
        if (t >= 1) off.cells = 0;
      }
      return y;
    },

    /* ─── 타일 하나 (플랫 + 먹선 + 하드섀도우) ─── */
    tile: function (x, y, cell, v, scale, now) {
      var ctx = this.ctx;

      /* 특수 타일 분기 */
      if (v === global.MD.Board.STONE) return this.stoneTile(x, y, cell, scale);
      if (v === global.MD.Board.COIN)  return this.coinTile(x, y, cell, scale, now);

      var pad = cell * 0.07;
      var w = (cell - pad * 2) * scale;
      var cx = x + cell / 2, cy = y + cell / 2;
      var bx = cx - w / 2, by = cy - w / 2;
      var col = this.colorOf(v);
      var rad = w * 0.24;

      /* 하드 섀도우 (블러 없는 오프셋 실루엣) */
      rr(ctx, bx, by + w * 0.09, w, w, rad);
      ctx.fillStyle = T.INK;
      ctx.fill();

      /* 본체: 단일 플랫 색 (그라디언트 없음!) */
      rr(ctx, bx, by, w, w, rad);
      ctx.fillStyle = col; ctx.fill();

      /* 먹색 굵은 테두리 */
      rr(ctx, bx, by, w, w, rad);
      ctx.lineWidth = Math.max(2.5, w * 0.065);
      ctx.strokeStyle = T.INK;
      ctx.stroke();

      /* 좌상단 하이라이트 꼭지 (스티커 인쇄 느낌) */
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      rr(ctx, bx + w * 0.12, by + w * 0.12, w * 0.20, w * 0.11, w * 0.05);
      ctx.fill();

      /* 황금 블록 반짝 (2048+) */
      if (this.isGold(v)) {
        var tw = 0.5 + Math.sin((now || 0) / 150) * 0.5;
        ctx.globalAlpha = 0.35 + tw * 0.45;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        rr(ctx, bx - 3, by - 3, w + 6, w + 6, rad + 3);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      /* 숫자: 먹색 아웃라인 + 흰 글자 (아케이드 각인체) */
      var str = String(v);
      var fs = w * (str.length <= 2 ? 0.50 : str.length === 3 ? 0.42 : 0.34);
      ctx.font = '400 ' + fs + 'px Jua, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = fs * 0.16;
      ctx.strokeStyle = T.INK;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, cx, cy + w * 0.02);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(str, cx, cy + w * 0.02);
    },

    /* 돌블록: 깨진 암석 질감 */
    stoneTile: function (x, y, cell, scale) {
      var ctx = this.ctx;
      var pad = cell * 0.08;
      var w = (cell - pad * 2) * scale;
      var bx = x + (cell - w) / 2, by = y + (cell - w) / 2;
      var cx = bx + w / 2, cy = by + w / 2;

      /* 하드 섀도우 */
      rr(ctx, bx, by + w * 0.09, w, w, w * 0.20);
      ctx.fillStyle = T.INK; ctx.fill();

      /* 몸통 */
      rr(ctx, bx, by, w, w, w * 0.20);
      ctx.fillStyle = T.STONE; ctx.fill();
      rr(ctx, bx, by, w, w, w * 0.20);
      ctx.lineWidth = Math.max(2.5, w * 0.065);
      ctx.strokeStyle = T.INK; ctx.stroke();

      /* 균열 무늬 (고정 패턴 — 프레임마다 흔들리지 않게) */
      ctx.strokeStyle = 'rgba(37,28,21,0.4)';
      ctx.lineWidth = Math.max(1.5, w * 0.04);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.26, cy - w * 0.10);
      ctx.lineTo(cx - w * 0.08, cy + w * 0.02);
      ctx.lineTo(cx - w * 0.16, cy + w * 0.22);
      ctx.moveTo(cx + w * 0.10, cy - w * 0.26);
      ctx.lineTo(cx + w * 0.20, cy - w * 0.02);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.1, cy + w * 0.26);
      ctx.lineTo(cx + w * 0.12, cy + w * 0.30);
      ctx.stroke();
    },

    /* 황금코인: 빛나는 동전 (별 양각 + 회전 광택) */
    coinTile: function (x, y, cell, scale, now) {
      var ctx = this.ctx;
      var pad = cell * 0.08;
      var w = (cell - pad * 2) * scale;
      var bx = x + (cell - w) / 2, by = y + (cell - w) / 2;
      var cx = bx + w / 2, cy = by + w / 2;

      /* 하드 섀도우 */
      rr(ctx, bx, by + w * 0.09, w, w, w * 0.5);
      ctx.fillStyle = T.INK; ctx.fill();

      /* 본체 원 */
      var r = w / 2 - Math.max(2.5, w * 0.065);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 7);
      ctx.fillStyle = '#ffc93c'; ctx.fill();
      ctx.lineWidth = Math.max(2.5, w * 0.065);
      ctx.strokeStyle = T.INK; ctx.stroke();

      /* 안쪽 링 */
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.74, 0, 7);
      ctx.strokeStyle = '#d99a1c'; ctx.lineWidth = Math.max(1.5, w * 0.045); ctx.stroke();

      /* 별 양각 */
      this.drawStar(ctx, cx, cy, 5, r * 0.48, r * 0.21);
      ctx.fillStyle = '#d99a1c'; ctx.fill();

      /* 돌아가는 광택 호 */
      var rot = (now || 0) / 700;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.88, rot % (Math.PI * 2), rot % (Math.PI * 2) + 1.1);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(2, w * 0.05);
      ctx.lineCap = 'round';
      ctx.stroke();
    },

    tileGhost: function (x, y, cell, v) {
      var ctx = this.ctx;
      var pad = cell * 0.08;
      var w = cell - pad * 2;
      rr(ctx, x + pad, y + pad, w, w, w * 0.24);
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = (v === global.MD.Board.STONE) ? T.STONE
                        : (v === global.MD.Board.COIN) ? '#d99a1c'
                        : (this.colorOf(v) || T.GHOST);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
    },

    textColorOf: function (hex) {   // 칩(HUD)용: 밝은 배경 → 먹색 글자
      return T.INK;
    },

    lighten: function (hex, amt) {
      var n = parseInt(hex.slice(1), 16);
      var r = Math.min(255, (n >> 16 & 255) + amt);
      var g = Math.min(255, (n >> 8 & 255) + amt);
      var b = Math.min(255, (n & 255) + amt);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
  };

  global.MD.Renderer = Renderer;
})(window);
