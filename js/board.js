/* ════════════════════════════════════════════════════════════════════
   골드드롭 - 게임 규칙 엔진 (순수 로직)
   ──────────────────────────────────────────────────────────────────
   ★ 화면 그리기/소리 코드가 전혀 없는 순수 "규칙" 파일입니다.
   ★ 좌표 체계: grid[행 r][열 c], r=0 이 맨 위, r=ROWS-1 이 바닥.
   ★ 특수 블록 두 종류
      - 돌블록(-1): 머지가 안 되는 장애물. 머지 폭발에 인접하면 파쇄(+점수).
      - 황금코인(-2): 역시 머지는 안 되지만, 파괴되면 점수 + 젬을 뱉는
        '노려야 할 보물'. 사방에서 폭발을 유도해 부숴라.
      - 목표 점수 공식 계산기 targetScore(stage)
      - 부활용 유틸: countStones / countCoins
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CFG = null;
  function cfg() { return CFG || (global.MD ? global.MD.CONFIG : null); }

  var STONE_VALUE = -1;   // 돌블록 표시값
  var COIN_VALUE  = -2;   // 황금코인 표시값

  var Board = {

    STONE: STONE_VALUE,
    COIN: COIN_VALUE,

    /* 빈 게임판 만들기 (전부 0 = 빈 칸) */
    createGrid: function () {
      var C = cfg();
      var grid = [];
      for (var r = 0; r < C.ROWS; r++) grid.push(new Array(C.COLS).fill(0));
      return grid;
    },

    /* 이 열(col)에 블록이 떨어지면 착지하는 행 번호. 꽉 찼으면 -1 */
    dropRow: function (grid, col) {
      for (var r = grid.length - 1; r >= 0; r--) {
        if (grid[r][col] === 0) return r;
      }
      return -1;
    },

    /* 실제로 떨어뜨려 값을 기록. 반환: {r, c} 착지 칸 (꽉 찼으면 null) */
    applyDrop: function (grid, col, value) {
      var r = this.dropRow(grid, col);
      if (r < 0) return null;
      grid[r][col] = value;
      return { r: r, c: col };
    },

    /* ─── 단계별 목표 점수 공식 ─────────────────────────────
       대충 아무 열에나 누르면 절대 못 넘는 초선형 커브.
       예) 1단계 420 / 3단계 약 1330 / 5단계 약 2480 */
    targetScore: function (stage) {
      var S = cfg().STAGE;
      var raw = (S.TARGET_BASE + S.TARGET_LINEAR * (stage - 1)) *
                Math.pow(S.TARGET_GROWTH, stage - 1);
      return Math.round(raw / 10) * 10;   // 십의 자리 반올림으로 깔끔하게
    },

    /* 단계별 지급 드롭 수 */
    dropsForStage: function (stage) {
      var S = cfg().STAGE;
      return Math.min(S.DROPS_CAP, S.DROPS_BASE + S.DROPS_PER_STAGE * (stage - 1));
    },

    /* ─── 머지(합치기) 한 판 검색 ──────────────────────────────
       서로 겹치지 않는 "같은 숫자 인접 쌍"들을 찾음.
       돌(-1)·코인(-2)은 숫자 취급하지 않음 → 둘이 붙어도 절대 머지되지 않음! */
    findWavePairs: function (grid) {
      var used = {};
      var pairs = [];
      var ROWS = grid.length, COLS = grid[0].length;

      for (var r = ROWS - 1; r >= 0; r--) {
        for (var c = 0; c < COLS; c++) {
          var v = grid[r][c];
          if (!v || v < 0 || used[r + ',' + c]) continue;

          var nb = [
            { r: r,     c: c + 1 },
            { r: r,     c: c - 1 },
            { r: r + 1, c: c     },
            { r: r - 1, c: c     }
          ];
          for (var i = 0; i < nb.length; i++) {
            var nr = nb[i].r, nc = nb[i].c;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            if (used[nr + ',' + nc]) continue;
            var nv = grid[nr][nc];
            if (nv !== v || nv < 1) continue;

            var a, b;
            if (nr > r || (nr === r && nc < c)) { a = nr + ',' + nc; b = r + ',' + c; }
            else { a = r + ',' + c; b = nr + ',' + nc; }
            var pa = a.split(','), pb = b.split(',');
            pairs.push({ a: { r: +pa[0], c: +pa[1] }, b: { r: +pb[0], c: +pb[1] } });
            used[a] = used[b] = true;
            break;
          }
        }
      }
      return pairs;
    },

    /* 머지 쌍 적용: 앵커 *=2, 짝 = 0
       반환: [{r,c,newValue}] */
    applyPairs: function (grid, pairs) {
      var events = [];
      for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        grid[p.a.r][p.a.c] *= 2;
        grid[p.b.r][p.b.c] = 0;
        /* bR·bC = 합쳐져 사라진 짝의 자리(폭발 범위에 포함) */
        events.push({
          r: p.a.r, c: p.a.c,
          bR: p.b.r, bC: p.b.c,
          newValue: grid[p.a.r][p.a.c]
        });
      }
      return events;
    },

    /* ─── 특수 블록 파괴 검사 ────────────────────────────────
       방금 머지가 일어난 칸들(events)에 상하좌우로 붙은 돌·코인을 수집해 파괴.
       반환: { stones:[{r,c}], coins:[{r,c}] } */
    breakSpecialsNear: function (grid, events) {
      var deadStones = [], deadCoins = [];
      var seen = {};
      for (var i = 0; i < events.length; i++) {
        var centers = [
          { r: events[i].r, c: events[i].c },
          { r: events[i].bR, c: events[i].bC }   // 사라진 짝 자리
        ];
        var dirs = [];
        for (var k = 0; k < centers.length; k++) {
          if (centers[k].r === undefined) continue;
          dirs.push(
            { r: centers[k].r - 1, c: centers[k].c },
            { r: centers[k].r + 1, c: centers[k].c },
            { r: centers[k].r,     c: centers[k].c - 1 },
            { r: centers[k].r,     c: centers[k].c + 1 }
          );
        }
        for (var d = 0; d < dirs.length; d++) {
          var rr = dirs[d].r, cc = dirs[d].c;
          if (rr < 0 || rr >= grid.length || cc < 0 || cc >= grid[0].length) continue;
          var key = rr + ',' + cc;
          if (seen[key]) continue;
          if (grid[rr][cc] === STONE_VALUE) {
            grid[rr][cc] = 0;
            seen[key] = true;
            deadStones.push({ r: rr, c: cc });
          } else if (grid[rr][cc] === COIN_VALUE) {
            grid[rr][cc] = 0;
            seen[key] = true;
            deadCoins.push({ r: rr, c: cc });
          }
        }
      }
      return { stones: deadStones, coins: deadCoins };
    },

    /* ─── 중력 정리 ────────────────────────────────────────────
       돌블록도 숫자블록처럼 아래로 떨어짐. */
    compact: function (grid) {
      var ROWS = grid.length, COLS = grid[0].length;
      var moved = {};
      for (var c = 0; c < COLS; c++) {
        var write = ROWS - 1;
        var maxShift = 0;
        for (var r = ROWS - 1; r >= 0; r--) {
          var v = grid[r][c];
          if (v !== 0) {
            if (write !== r) {
              grid[write][c] = v;
              grid[r][c] = 0;
              if (write - r > maxShift) maxShift = write - r;
            }
            write--;
          }
        }
        moved[c] = maxShift;
      }
      return moved;
    },

    /* ─── 새 블록 값 추첨 ───────────────────────────────────── */
    pickSpawnValue: function (grid) {
      var C = cfg();
      var high = 1;
      for (var r = 0; r < grid.length; r++)
        for (var c = 0; c < grid[0].length; c++)
          if (grid[r][c] > high) high = grid[r][c];

      var pow2Floor = Math.pow(2, Math.floor(Math.log2(Math.max(1, high / C.SPAWN_MAX_DIVIDER))));
      var cap = Math.max(C.SPAWN_MIN_KINDS === 2 ? 2 : 1, pow2Floor);

      var candidates = [];
      for (var v = 1; v <= cap; v *= 2) candidates.push(v);
      if (candidates.length === 0) candidates.push(1);

      var total = 0, weights = [];
      for (var i = 0; i < candidates.length; i++) {
        var w = Math.pow(C.SPAWN_DECAY, i);
        weights.push(w); total += w;
      }
      var roll = Math.random() * total;
      for (var k = 0; k < candidates.length; k++) {
        roll -= weights[k];
        if (roll <= 0) return candidates[k];
      }
      return 1;
    },

    /* 판이 붐비면 특수 블록 배제 — 난이도 급작스러운 악화를 막아줌 */
    _crowded: function (grid) {
      return this.countFilled(grid) > this.cellCount() * 0.55;
    },

    /* 이번 드롭이 돌블록일까? (단계 기반 확률) */
    rollStone: function (stage, grid) {
      var C = cfg();
      if (!C.STONE || stage < C.STONE.START_STAGE) return false;
      if (this._crowded(grid)) return false;
      var chance = Math.min(C.STONE.MAX_CHANCE,
                    C.STONE.BASE_CHANCE + (stage - C.STONE.START_STAGE) * C.STONE.PER_STAGE);
      return Math.random() < chance;
    },

    /* 이번 드롭이 황금코인일까? */
    rollCoin: function (stage, grid) {
      var C = cfg();
      if (!C.COIN || stage < C.COIN.START_STAGE) return false;
      if (this._crowded(grid)) return false;
      if (this.countStones(grid) + this.countCoins(grid) >= 3) return false; // 동시 다발 제한
      var chance = Math.min(C.COIN.MAX_CHANCE,
                    C.COIN.BASE_CHANCE + (stage - C.COIN.START_STAGE) * C.COIN.PER_STAGE);
      return Math.random() < chance;
    },

    /* 드롭 직전 호출: null | STONE | COIN 중 하나를 정한다 */
    decideSpecial: function (stage, grid) {
      if (this.rollCoin(stage, grid)) return COIN_VALUE;
      if (this.rollStone(stage, grid)) return STONE_VALUE;
      return null;
    },

    cellCount: function () { var C = cfg(); return C.ROWS * C.COLS; },

    countFilled: function (grid) {
      var n = 0;
      for (var r = 0; r < grid.length; r++)
        for (var c = 0; c < grid[0].length; c++)
          if (grid[r][c] !== 0) n++;
      return n;
    },

    countStones: function (grid) {
      var n = 0;
      for (var r = 0; r < grid.length; r++)
        for (var c = 0; c < grid[0].length; c++)
          if (grid[r][c] === STONE_VALUE) n++;
      return n;
    },

    countCoins: function (grid) {
      var n = 0;
      for (var r = 0; r < grid.length; r++)
        for (var c = 0; c < grid[0].length; c++)
          if (grid[r][c] === COIN_VALUE) n++;
      return n;
    },

    /* 어디 한 열이라도 놓을 수 있으면 true. false = 게임오버 */
    hasAnyRoom: function (grid) {
      for (var c = 0; c < grid[0].length; c++)
        if (this.dropRow(grid, c) >= 0) return true;
      return false;
    },

    /* ─── 부활 처리: 아래 N줄 폭파 + 돌 전멸 ─────────────
       반환: { removedRows:[행번호], stones:number, coins:number } */
    doReviveClear: function (grid, rowsToClear) {
      var stones = this.countStones(grid);
      var coins = this.countCoins(grid);
      var cleared = [];
      var last = grid.length - 1;
      for (var i = 0; i < rowsToClear; i++) {
        var r = last - i;
        if (r < 0) break;
        for (var c = 0; c < grid[0].length; c++) grid[r][c] = 0;
        cleared.push(r);
      }
      /* 돌은 줄과 무관하게 전부 청소 */
      for (r = 0; r < grid.length; r++)
        for (c = 0; c < grid[0].length; c++)
          if (grid[r][c] === STONE_VALUE) { grid[r][c] = 0; }

      this.compact(grid);
      return { removedRows: cleared, stones: stones, coins: coins };
    },

    /* 최고 기록 저장/로드 */
    loadBest: function () {
      try { return parseInt(localStorage.getItem(cfg().LS_BEST), 10) || 0; }
      catch (e) { return 0; }
    },
    saveBest: function (score) {
      try { localStorage.setItem(cfg().LS_BEST, String(score)); } catch (e) {}
    },
    loadStars: function () {
      try { return parseInt(localStorage.getItem(cfg().LS_STARS), 10) || 0; }
      catch (e) { return 0; }
    },
    saveStars: function (total) {
      try { localStorage.setItem(cfg().LS_STARS, String(total)); } catch (e) {}
    },
    loadStageBest: function () {
      try { return parseInt(localStorage.getItem(cfg().LS_STAGE), 10) || 0; }
      catch (e) { return 0; }
    },
    saveStageBest: function (stage) {
      try { localStorage.setItem(cfg().LS_STAGE, String(stage)); } catch (e) {}
    },
    todayKey: function () {
      var d = new Date();
      var mm = ('' + (d.getMonth() + 1)).padStart(2, '0');
      var dd = ('' + d.getDate()).padStart(2, '0');
      return '' + d.getFullYear() + mm + dd;
    },
    loadDailyBest: function () {
      try { return parseInt(localStorage.getItem(cfg().LS_DAILY + this.todayKey()), 10) || 0; }
      catch (e) { return 0; }
    },
    saveDailyBest: function (score) {
      try { localStorage.setItem(cfg().LS_DAILY + this.todayKey(), String(score)); } catch (e) {}
    },

    __testHooks: { setConfig: function (c) { CFG = c; } }
  };

  global.MD = global.MD || {};
  global.MD.Board = Board;

  if (typeof module !== 'undefined') module.exports = Board;
})(typeof window !== 'undefined' ? window : this);
