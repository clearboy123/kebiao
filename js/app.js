/* ============================================================
 * app.js —— 课表渲染与交互
 * 依赖：core.js（KBCore）、schedule-data.js（SCHEDULE）
 * ============================================================ */
(function () {
  'use strict';
  var C = window.KBCore;
  if (!C) { console.error('缺少 core.js'); return; }

  var S = window.SCHEDULE;                 // 课表数据
  var LS_KEY = 'kebiao.settings.v1';
  var SHORT = ['日', '一', '二', '三', '四', '五', '六', '日']; // 下标按 JS getDay

  /* 配色盘：浅底 + 强调色 */
  var PALETTE = [
    { bg: '#e8f1ff', ac: '#3d6df2' },
    { bg: '#e6f8f0', ac: '#0f9d6a' },
    { bg: '#fff0df', ac: '#e8842b' },
    { bg: '#fdeaea', ac: '#e5484d' },
    { bg: '#f1eaff', ac: '#7b5cff' },
    { bg: '#e3f6fb', ac: '#0e9cb5' },
    { bg: '#fdf4e2', ac: '#d99a2b' },
    { bg: '#eef4e0', ac: '#86a528' }
  ];
  var colorOf = {};
  function courseColor(c) {
    var key = c.color || c.name;
    if (colorOf[key]) return colorOf[key];
    var h = 0;
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    var p = PALETTE[h % PALETTE.length];
    colorOf[key] = p;
    return p;
  }

  /* ---------- 设置 ---------- */
  function defaultSettings() {
    return { semesterStart: S.semesterStart || '', weekOverride: 0, showWeekend: true };
  }
  function loadSettings() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      var d = defaultSettings();
      return raw ? Object.assign(d, raw) : d;
    } catch (e) { return defaultSettings(); }
  }
  var SET = loadSettings();
  function saveSettings() {
    localStorage.setItem(LS_KEY, JSON.stringify(SET));
  }
  function semesterStart() {
    return SET.semesterStart && /^\d{4}-\d{2}-\d{2}$/.test(SET.semesterStart) ? SET.semesterStart : (S.semesterStart || '');
  }

  /* ---------- 状态 ---------- */
  var now = function () { return new Date(); };
  var view = 'today';          // today | week | about
  var curWeek = 0;              // 当前渲染的周(用于按周备注)
  var totalWeeks = Math.max(1, S.totalWeeks || 20);

  function todayWeekRaw() { return C.weekNumberOf(C.toISO(now()), semesterStart()); }
  function clampWeek(w) { return Math.max(1, Math.min(totalWeeks, w)); }
  function currentWeek() { return clampWeek(todayWeekRaw()); }
  function selectedWeek() {
    return SET.weekOverride > 0 ? clampWeek(SET.weekOverride) : currentWeek();
  }

  /* ---------- 工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function dayNameWD(wd) { // wd 1..7
    return '周' + '一二三四五六日'.charAt(wd - 1);
  }
  function fmtMD(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? (+m[2]) + '月' + (+m[3]) + '日' : iso;
  }
  function fmtMDs(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? (+m[1]) + '.' + m[2] + '.' + m[3] : iso;
  }
  function periodNoOf(c) { return c.period ? c.period.no : (c.index + 1); }

  /* 某天某周应上的课（按开始节次排序） */
  function dayCourses(wd, weekNum) {
    var list = (S.courses || []).filter(function (c) {
      return c.day === wd && C.activeInWeek(c, weekNum);
    });
    list.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    return list;
  }
  /* 某天某周“安排过但本周不上”的课（用于周视图虚线提示单双周） */
  function dayCoursesInactive(wd, weekNum) {
    return (S.courses || []).filter(function (c) { return c.day === wd && !C.activeInWeek(c, weekNum); });
  }

  /* 查找某一节次是否在某课程区间内 */
  function covers(c, periodNo) { return periodNo >= c.start && periodNo <= c.end; }

  function inTerm(weekNum) { return weekNum >= 1 && weekNum <= totalWeeks; }

  /* ============================================================
   * 视图1：今天
   * ============================================================ */
  function renderToday() {
    var t = now();
    var iso = C.toISO(t);
    var wd = C.mondayBasedWeekday(t);
    var wkRaw = todayWeekRaw();
    var inTermFlag = inTerm(wkRaw);

    $('todayDate').textContent = fmtMD(iso) + ' ' + dayNameWD(wd);
    $('todayWeek').textContent = inTermFlag ? ('第 ' + wkRaw + ' 周') : (wkRaw < 1 ? '未开学' : '已结课');
    $('todayWeek').title = S.termLabel || '';


    var listEl = $('todayList');
    var bannerEl = $('todayNext');
    var nowMin = t.getHours() * 60 + t.getMinutes();

    if (!inTermFlag) {
      bannerEl.classList.add('hidden');
      listEl.innerHTML = '<div class="empty-tip">' +
        (wkRaw < 1 ? '新学期还没开始，先看看本周视图的课表吧' : '本学期课程已结束') + '</div>';
      $('tomorrowBlock').innerHTML = '';
      return;
    }

    var courses = dayCourses(wd, wkRaw);
    var locate = C.locatePeriod(S.periods, nowMin);

    /* 进行中的课程 */
    var ongoingCourse = null;
    if (locate.type === 'ongoing') {
      var pno = periodNoOf(locate);
      for (var i = 0; i < courses.length; i++) {
        if (covers(courses[i], pno)) { ongoingCourse = courses[i]; break; }
      }
    }
    /* 下一节课（尚未开始的最近的课） */
    var nextCourse = null;
    var boundaryNo = locate.type === 'ongoing' ? periodNoOf(locate) + 1 : (locate.type === 'upcoming' ? periodNoOf(locate) : 999);
    for (var j = 0; j < courses.length; j++) {
      var cj = courses[j];
      if (ongoingCourse && cj.id === ongoingCourse.id) continue;
      if (cj.start >= boundaryNo) { nextCourse = cj; break; }
    }

    /* 横幅 */
    if (ongoingCourse) {
      var endMin = C.hmToMin(S.periods[ongoingCourse.end - 1].end);
      bannerEl.className = 'next-banner';
      bannerEl.innerHTML = '<b>正在进行</b> · ' + esc(ongoingCourse.name) +
        '（第' + ongoingCourse.start + '-' + ongoingCourse.end + '节）@ ' + esc(ongoingCourse.location || '—') +
        '，还有 <b>' + Math.max(0, endMin - nowMin) + '</b> 分钟下课';
    } else if (nextCourse) {
      var startMin0 = C.hmToMin(S.periods[nextCourse.start - 1].start);
      var mm = startMin0 - nowMin;
      bannerEl.className = 'next-banner';
      bannerEl.innerHTML = '下一节 · <b>' + esc(nextCourse.name) + '</b> ' +
        S.periods[nextCourse.start - 1].start + ' 在 ' + esc(nextCourse.location || '—') +
        (mm > 0 ? '（还有 ' + mm + ' 分钟）' : '');
    } else if (courses.length) {
      bannerEl.className = 'next-banner';
      bannerEl.innerHTML = '今天的课已经全部结束 🎉';
    } else {
      bannerEl.classList.add('hidden');
    }

    listEl.innerHTML = courses.length
      ? courses.map(function (c) { return cardHTML(c, nowMin, ongoingCourse, wkRaw); }).join('')
      : '<div class="empty-tip">今天没有课，好好休息 ☕</div>';

    /* 明天预告 */
    var tmr = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    var tmrWd = C.mondayBasedWeekday(tmr);
    var tmrIso = C.toISO(tmr);
    var tmrWk = C.weekNumberOf(tmrIso, semesterStart());
    var tmrBox = $('tomorrowBlock');
    if (inTerm(tmrWk)) {
      var tmCourses = dayCourses(tmrWd, tmrWk);
      tmrBox.innerHTML = '<div class="subtitle">明天 · ' + dayNameWD(tmrWd) + ' ' + fmtMDs(tmrIso) + '（第' + tmrWk + '周）</div>' +
        '<div class="card-list">' + (tmCourses.length ? tmCourses.map(function (c) { return cardHTML(c, null, null, tmrWk); }).join('') : '<div class="empty-tip">明天没有课</div>') + '</div>';
    } else {
      tmrBox.innerHTML = '<div class="subtitle">明天 · ' + dayNameWD(tmrWd) + '</div><div class="empty-tip">明天不在学期内</div>';
    }
  }

  function weeksLabel(c) {
    var w = C.parseWeekSpec(c.weeks);
    var full = w.type === 'range' && w.from <= 1 && w.to >= totalWeeks && w.parity === 'all';
    return full ? '' : (C.descWeeks(w) || '');
  }
  function cardHTML(c, nowMin, ongoingCourse, weekNum) {
    var p1 = S.periods[c.start - 1], p2 = S.periods[c.end - 1];
    var col = courseColor(c);
    var isNow = ongoingCourse && ongoingCourse.id === c.id;
    var weeks = weeksLabel(c);
    return '<div class="course-card' + (isNow ? ' now' : '') + '" style="border-left-color:' + col.ac + '">' +
      '<div class="card-time">' +
      '<div class="pno">' + c.start + (c.end > c.start ? '-' + c.end : '') + '节</div>' +
      (S.showTimes === false ? '' : '<div class="ptime">' + p1.start + (p1.start !== p2.start ? '-' + p2.end : '~' + p2.end) + '</div>') +
      '</div>' +
      '<div class="card-main">' +
      '<div class="card-title"><span style="color:' + col.ac + '">' + esc(c.name) + '</span>' +
      (c.tag ? '<span class="badge lab">' + esc(c.tag) + '</span>' : '') +
      (weeks ? '<span class="badge weeks">' + esc(weeks) + '</span>' : '') +
      '</div>' +
      (c.weekRemark && c.weekRemark[weekNum] ? '<div class="meta" style="color:#d97706;font-size:12px;margin-top:4px">⚠ ' + esc(c.weekRemark[weekNum]) + '</div>' : '') +
      '<div class="meta">' +
      (c.teacher ? '<div class="row"><span class="ic">👤</span><span>' + esc(c.teacher) + '</span></div>' : '') +
      '<div class="row"><span class="ic">📍</span><span>' + esc(c.location || '地点待定') + '</span></div>' +
      '</div></div></div>';
  }

  /* ============================================================
   * 视图2：本周课表（网格）
   * ============================================================ */
  var SH = 58, COLW = 102, TCOLW = 66;
  function readGridMetrics() {
    var rs = getComputedStyle(document.documentElement);
    var sh = parseFloat(rs.getPropertyValue('--sh'));
    var cw = parseFloat(rs.getPropertyValue('--colw'));
    if (isFinite(sh) && sh > 0) SH = sh;
    if (isFinite(cw) && cw > 0) COLW = cw;
  }

  function weekStartISO(weekNum) {
    return C.addDays(semesterStart(), (weekNum - 1) * 7);
  }

  function renderWeek() {
    readGridMetrics();
    var wk = selectedWeek();
    curWeek = wk;
    var monday = C.parseISO(weekStartISO(wk));
    var days = [];
    for (var i = 1; i <= 7; i++) {
      days.push({ wd: i, iso: C.toISO(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i - 1)) });
    }
    if (!SET.showWeekend) days = days.slice(0, 5);

    $('weekTitle').textContent = '第 ' + wk + ' 周';
    var todayIso = C.toISO(now());
    var sub = C.addDays(weekStartISO(wk), 0) + ' ~ ' + C.addDays(weekStartISO(wk), 6) + ' · ' + S.termLabel;
    var todayWk = currentWeek();
    if (todayWk === wk) sub += '（本周）';
    $('weekSub').textContent = sub;

    var nPeriods = S.periods.length;
    var gridH = nPeriods * SH;

    /* 表头 */
    var head = '<div class="g-timehead"></div>';
    for (var h = 0; h < days.length; h++) {
      var d = days[h];
      var isToday = d.iso === todayIso;
      head += '<div class="day-cell' + (isToday ? ' today' : '') + '">' +
        '<span class="weekday">' + (d.wd === 7 ? '周日' : '周' + '一二三四五六'.charAt(d.wd - 1)) + '</span>' +
        '<span class="daynum">' + fmtMDs(d.iso) + '</span></div>';
    }

    /* 时间列 */
    var timeCol = '';
    for (var p = 0; p < nPeriods; p++) {
      var per = S.periods[p];
      timeCol += '<div class="tcell"><span class="pno">' + per.no + '</span>' +
        (S.showTimes === false ? '' : '<span class="ptime">' + per.start + '-' + per.end + '</span>') + '</div>';
    }

    /* 每天一列 */
    var cols = '';
    for (var k = 0; k < days.length; k++) {
      var dd = days[k];
      var isToday2 = dd.iso === todayIso;
      var active = dayCourses(dd.wd, wk).map(function (c) { return { c: c, active: true, start: c.start, end: c.end }; });
      var clusters = layoutDay(active);   // 只排本周要上的课
      var blocks = clusters.map(function (cl) {
        return cl.items.map(function (it) { return blockHTML(it.c, true, it.col, cl.cols); }).join('');
      }).join('');
      var nowLine = '';
      if (isToday2 && todayWk === wk) nowLine = nowLineHTML();
      cols += '<div class="daycol' + (isToday2 ? ' today' : '') + '" style="height:' + gridH + 'px">' +
        blocks + nowLine + '</div>';
    }

    $('gridWrap').innerHTML = '<div class="g-head">' + head + '</div><div class="g-body">' +
      '<div class="g-timecol" style="height:' + gridH + 'px">' + timeCol + '</div>' + cols + '</div>';

    /* 图例 */
    $('legend').innerHTML =
      '<span><i class="dot" style="background:#3d6df2"></i>本周要上的课</span>' +
      '<span>🔴 红线=现在</span>';
  }

  /* 同一天内多条课程的重叠检测 & 分列（类似日历）：返回 [{items:[{c,active,col}], cols}]
   * 用于一条课与另一条课在同一时段时并排显示，避免叠成"重影"。 */
  function layoutDay(items) {
    var sorted = items.slice().sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    var clusters = [];
    var curItems = [], colEnd = [], clusterEnd = -1, curCols = 0;
    function closeCluster() {
      if (curItems.length) clusters.push({ items: curItems, cols: curCols });
      curItems = []; colEnd = []; clusterEnd = -1; curCols = 0;
    }
    for (var i = 0; i < sorted.length; i++) {
      var it = sorted[i];
      if (it.start > clusterEnd) closeCluster();
      var col = 0;
      while (col < colEnd.length && colEnd[col] > it.start) col++;
      if (col === colEnd.length) colEnd.push(it.end); else colEnd[col] = it.end;
      if (col + 1 > curCols) curCols = col + 1;
      it.col = col;
      curItems.push(it);
      if (it.end > clusterEnd) clusterEnd = it.end;
    }
    closeCluster();
    return clusters;
  }

  function blockHTML(c, activeThisWeek, colIdx, colCount) {
    var col = courseColor(c);
    var top = (c.start - 1) * SH;
    var height = (c.end - c.start + 1) * SH - 5;
    colCount = colCount || 1;
    colIdx = colIdx || 0;
    var blockW = COLW / colCount;
    var left = colIdx * blockW + 2;
    var width = blockW - 4;
    var posStyle = 'top:' + top + 'px;height:' + height + 'px;left:' + left + 'px;width:' + width + 'px;';
    var small = (c.end - c.start + 1) <= 1;
    var p1 = S.periods[c.start - 1];
    var tag = c.tag ? '<span class="badge lab">' + esc(c.tag) + '</span>' : '';
    var inner = small
      ? '<span class="cb-name">' + esc(c.name) + '</span>'
      : '<span class="cb-name">' + esc(c.name) + '</span>' +
        (tag) +
        (c.location ? '<span class="cb-loc">📍' + esc(c.location) + '</span>' : '') +
        (c.teacher ? '<span class="cb-sub">' + esc(c.teacher) + '</span>' : '') +
        '<span class="cb-sub">' + (S.showTimes === false ? '' : (p1.start + ' ')) + '第' + c.start + (c.end > c.start ? '-' + c.end : '') + '节</span>' +
        (c.weekRemark && c.weekRemark[curWeek] ? '<span class="cb-remark">⚠' + esc(c.weekRemark[curWeek]) + '</span>' : '');
    return '<div class="course-block' + (activeThisWeek ? '' : ' off') + (small ? ' tiny' : '') +
      '" style="' + posStyle + 'background:' + col.bg + ';border-left-color:' + col.ac + '">' +
      inner + '</div>';
  }

  function nowLineHTML() {
    var t = now();
    var nowMin = t.getHours() * 60 + t.getMinutes();
    var first = S.periods[0], last = S.periods[S.periods.length - 1];
    var dayStart = C.hmToMin(first.start), dayEnd = C.hmToMin(last.end);
    var nPeriods = S.periods.length;
    var gridH = nPeriods * SH;
    if (nowMin < dayStart || nowMin > dayEnd) return '';
    var top = (nowMin - dayStart) / (dayEnd - dayStart) * gridH;
    return '<div class="nowline" style="top:' + top + 'px"></div>';
  }

  /* ============================================================
   * 视图3：说明与设置
   * ============================================================ */
  function renderAbout() {
    var courses = S.courses || [];
    var daysCovered = {};
    var maxPeriod = 0;
    courses.forEach(function (c) {
      daysCovered[c.day] = 1;
      if (c.end > maxPeriod) maxPeriod = c.end;
    });
    var statEl = $('statPanel');
    statEl.innerHTML = '<div class="panel-title">课程统计</div>' +
      '<div class="stat-grid">' +
      '<div class="stat-box"><div class="n">' + courses.length + '</div><div class="l">总课程数</div></div>' +
      '<div class="stat-box"><div class="n">' + Object.keys(daysCovered).length + '</div><div class="l">覆盖星期数</div></div>' +
      '<div class="stat-box"><div class="n">' + maxPeriod + '</div><div class="l">最晚到第几节</div></div>' +
      '</div>';
    $('setStartDate').value = semesterStart();
    $('setWeek').value = SET.weekOverride || 0;
    $('setShowWeekend').checked = !!SET.showWeekend;
  }

  /* ============================================================
   * 导航与绑定
   * ============================================================ */
  function switchView(v) {
    view = v;
    ['today', 'week', 'about'].forEach(function (k) {
      $('view-' + k).classList.toggle('hidden', k !== v);
    });
    var tabs = document.querySelectorAll('.tabbar .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-view') === v);
    }
    if (v === 'today') renderToday();
    if (v === 'week') renderWeek();
    if (v === 'about') renderAbout();
  }

  function refreshTopbar() {
    $('appTitle').textContent = S.title || '我的课表';
    $('termLabel').textContent = S.termLabel || '';
    document.title = (S.title || '我的课表') + ' · 第' + currentWeek() + '周';
  }

  function renderAll() {
    refreshTopbar();
    switchView(view);
  }

  function stepWeek(delta) {
    SET.weekOverride = clampWeek(selectedWeek() + delta);
    saveSettings();
    $('setWeek').value = SET.weekOverride;
    renderWeek();
  }

  function bind() {
    var tabs = document.querySelectorAll('.tabbar .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        switchView(this.getAttribute('data-view'));
      });
    }
    $('btnToday').addEventListener('click', function () {
      SET.weekOverride = 0; saveSettings();
      switchView('today');
    });
    $('btnPrev').addEventListener('click', function () { stepWeek(-1); });
    $('btnNext').addEventListener('click', function () { stepWeek(1); });
    $('btnSave').addEventListener('click', function () {
      var sd = $('setStartDate').value;
      var wo = parseInt($('setWeek').value, 10);
      if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) SET.semesterStart = sd;
      SET.weekOverride = isFinite(wo) && wo > 0 ? wo : 0;
      SET.showWeekend = $('setShowWeekend').checked;
      saveSettings();
      renderAll();
    });
    $('btnReset').addEventListener('click', function () {
      localStorage.removeItem(LS_KEY);
      SET = loadSettings();
      renderAll();
    });

    /* 每分钟刷新"今天"，保证高亮/倒计时准确 */
    setInterval(function () {
      if (view === 'today') renderToday();
      if (view === 'week') renderWeek();
    }, 20000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { if (view === 'today') renderToday(); if (view === 'week') renderWeek(); }
    });
    var rs;
    window.addEventListener('resize', function () {
      clearTimeout(rs);
      rs = setTimeout(function () { if (view === 'week') renderWeek(); }, 200);
    });
  }

  bind();
  renderAll();
})();
