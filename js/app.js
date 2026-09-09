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
  var CUS_KEY = 'kebiao.customs.v1';   // 自定义活动（只存本机浏览器，别人看不到）

  function loadCustoms() {
    try { var a = JSON.parse(localStorage.getItem(CUS_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveCustoms(a) { localStorage.setItem(CUS_KEY, JSON.stringify(a)); }
  var CUSTOMS = loadCustoms();
  function customWeeks(x) { return x.weeks && String(x.weeks).trim() ? x.weeks : '1-' + totalWeeks + '周'; }
  function toPseudoCustom(x) {
    return { id: 'cus-' + x.id, name: x.title || '活动', teacher: '', location: (x.note || ''),
             day: x.day, start: x.start, end: x.end, isCustom: true, weeks: customWeeks(x) };
  }
  function customsOnDay(wd, wk) {
    return CUSTOMS.filter(function (x) { return x.day === wd && C.activeInWeek({ weeks: customWeeks(x) }, wk); });
  }
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
  /* 周课表方块里的课程名简写（长名 → 短名），给"地点"腾地方 */
  var SHORT_NAMES = {
    '恶意代码分析与处理': '恶意代码',
    '习近平新时代中国特色社会主义思想概论': '习概',
    '信息论与编码': '信息论',
    '入侵检测技术': '入侵检测',
    'Linux操作系统': 'Linux'
  };
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

    var courses = dayCourses(wd, wkRaw)
      .concat(customsOnDay(wd, wkRaw).map(toPseudoCustom))
      .sort(function (a, b) { return a.start - b.start || a.end - b.end; });
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
      var tmCourses = dayCourses(tmrWd, tmrWk)
        .concat(customsOnDay(tmrWd, tmrWk).map(toPseudoCustom))
        .sort(function (a, b) { return a.start - b.start || a.end - b.end; });
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
    var isCus = !!c.isCustom;
    var isNow = ongoingCourse && ongoingCourse.id === c.id;
    var weeks = weeksLabel(c);
    var border = isCus ? '' : ';border-left-color:' + col.ac;
    var delAttr = isCus ? ' data-del="' + esc(String(c.id).replace(/^cus-/, '')) + '"' : '';
    return '<div class="course-card' + (isNow ? ' now' : '') + (isCus ? ' custom' : '') + '"' + delAttr + ' style="' + border.slice(1) + '">' +
      '<div class="card-time">' +
      '<div class="pno">' + c.start + (c.end > c.start ? '-' + c.end : '') + '节</div>' +
      (S.showTimes === false ? '' : '<div class="ptime">' + p1.start + (p1.start !== p2.start ? '-' + p2.end : '~' + p2.end) + '</div>') +
      '</div>' +
      '<div class="card-main">' +
      '<div class="card-title"><span' + (isCus ? '' : ' style="color:' + col.ac + '"') + '>' + (isCus ? '☆ ' : '') + esc(c.name) + '</span>' +
      (isCus ? '<span class="badge weeks">我的</span>' : '') +
      (c.tag && !isCus ? '<span class="badge lab">' + esc(c.tag) + '</span>' : '') +
      (weeks && !isCus ? '<span class="badge weeks">' + esc(weeks) + '</span>' : '') +
      '</div>' +
      (c.weekRemark && c.weekRemark[weekNum] ? '<div class="meta" style="color:#d97706;font-size:12px;margin-top:4px">⚠ ' + esc(c.weekRemark[weekNum]) + '</div>' : '') +
      '<div class="meta">' +
      (c.teacher ? '<div class="row"><span class="ic">👤</span><span>' + esc(c.teacher) + '</span></div>' : '') +
      (c.location ? '<div class="row"><span class="ic">' + (isCus ? '📝' : '📍') + '</span><span>' + esc(c.location) + '</span></div>' : '') +
      '</div></div></div>';
  }
  /* 周课表布局参数 */
  var SH = 58, COLW = 102, TCOLW = 66;
  var CW_MAIN = 102, CW_WKND = 102;

  function readGridMetrics() {
    var rs = getComputedStyle(document.documentElement);
    var sh = parseFloat(rs.getPropertyValue('--sh'));
    var cw = parseFloat(rs.getPropertyValue('--colw'));
    if (isFinite(sh) && sh > 0) SH = sh;
    if (isFinite(cw) && cw > 0) COLW = cw;
  }
  /* 按手机屏幕把周课表铺满一屏：行高尽可能大以容纳课程名+地点，且不溢出 */
  function fitGridMetrics(show7) {
    var nPer = Math.max(1, S.periods.length || 10);
    var innerH = window.innerHeight || 700;
    var innerW = window.innerWidth || 380;
    var topbarEl = $('topbar');
    var chromeTop = topbarEl ? topbarEl.offsetHeight + 4 : 64;     // 顶栏(含状态栏安全区)
    var tabEl = document.querySelector('.tabbar');
    var chromeBottom = tabEl ? tabEl.offsetHeight + 2 : 76;         // 底栏
    var headEl = document.querySelector('.week-head');
    var headH = (headEl && headEl.offsetHeight) ? headEl.offsetHeight + 6 : 52;
    var legEl = $('legend');
    var legH = (legEl && legEl.offsetHeight) ? legEl.offsetHeight + 6 : 28;
    var padV = 22;                                // 页面上下留白
    var dayHeadH = 30, wrapPadV = 16;
    var availGrid = innerH - chromeTop - chromeBottom - headH - legH - padV - dayHeadH - wrapPadV;
    // 行高取最大可用（下限保证看得清字），10节尽量铺满
    var sh = Math.max(42, Math.min(76, Math.floor(availGrid / nPer)));
    var tcol = S.showTimes === false ? 24 : 56;
    var padW = 16, wrapPad = 8;
    var usable = innerW - padW - wrapPad - tcol;
    if (show7) { CW_MAIN = usable / (5 + 2 * 0.55); CW_WKND = CW_MAIN * 0.55; }
    else { CW_MAIN = usable / 5; CW_WKND = CW_MAIN; }
    SH = sh; COLW = Math.floor(CW_MAIN); TCOLW = tcol;
    var root = document.documentElement.style;
    root.setProperty('--sh', sh + 'px');
    root.setProperty('--colw', COLW + 'px');
    root.setProperty('--tcolw', tcol + 'px');
  }

  function weekStartISO(weekNum) {
    return C.addDays(semesterStart(), (weekNum - 1) * 7);
  }

  function renderWeek() {
    var wk = selectedWeek();
    curWeek = wk;
    var monday = C.parseISO(weekStartISO(wk));
    var show7 = !!SET.showWeekend;      // 是否显示周六周日（默认开，防以后周末有课）
    fitGridMetrics(show7);              // 自适应：一屏放下所有节次
    var days = [];
    for (var i = 1; i <= (show7 ? 7 : 5); i++) {
      days.push({ wd: i, iso: C.toISO(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i - 1)) });
    }

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
      head += '<div class="day-cell' + (isToday ? ' today' : '') + '" style="width:' + Math.floor(d.wd >= 6 ? CW_WKND : CW_MAIN) + 'px">' +
        '<span class="weekday">' + (d.wd === 7 ? '周日' : '周' + '一二三四五六'.charAt(d.wd - 1)) + '</span></div>';
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
      var dayW = dd.wd >= 6 ? CW_WKND : CW_MAIN;
      var active = dayCourses(dd.wd, wk).map(function (c) { return { c: c, active: true, start: c.start, end: c.end }; });
      var cusItems = customsOnDay(dd.wd, wk).map(function (x) { var pc = toPseudoCustom(x); return { c: pc, active: true, start: pc.start, end: pc.end }; });
      var clusters = layoutDay(active.concat(cusItems));   // 课程 + 我的自定义
      var blocks = clusters.map(function (cl) {
        return cl.items.map(function (it) { return blockHTML(it.c, true, it.col, cl.cols, dayW); }).join('');
      }).join('');
      var nowLine = '';
      if (isToday2 && todayWk === wk) nowLine = nowLineHTML();
      cols += '<div class="daycol' + (isToday2 ? ' today' : '') + '" style="height:' + gridH + 'px;width:' + Math.floor(dayW) + 'px">' +
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

  function blockHTML(c, activeThisWeek, colIdx, colCount, dayW) {
    var col = courseColor(c);
    var top = (c.start - 1) * SH;
    var height = (c.end - c.start + 1) * SH - 5;
    colCount = colCount || 1;
    colIdx = colIdx || 0;
    var colW = dayW || COLW;
    var blockW = colW / colCount;
    var left = colIdx * blockW + 2;
    var width = blockW - 4;
    var posStyle = 'top:' + top + 'px;height:' + height + 'px;left:' + left + 'px;width:' + width + 'px;';
    var isCus = !!c.isCustom;
    var dName = isCus ? c.name : (SHORT_NAMES[c.name] || c.name);
    var tag = (!isCus && c.tag) ? '<span class="badge lab">' + esc(c.tag) + '</span>' : '';
    var rmk = (c.weekRemark && c.weekRemark[curWeek]) ? '<span class="cb-remark">⚠' + esc(c.weekRemark[curWeek]) + '</span>' : '';
    var inner = '<span class="cb-name"><span class="nm">' + (isCus ? '☆ ' : '') + esc(dName) + '</span>' + tag + rmk + '</span>';
    if (c.location) inner += '<span class="' + (isCus ? 'cb-note' : 'cb-loc') + '">' + (isCus ? '' : '📍') + esc(c.location) + '</span>';
    var delAttr = isCus ? ' data-del="' + esc(String(c.id).replace(/^cus-/, '')) + '"' : '';
    return '<div class="course-block' + (isCus ? ' custom' : '') + '"' + delAttr +
      ' style="' + posStyle + (isCus ? '' : 'background:' + col.bg + ';border-left-color:' + col.ac) + '">' +
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
    renderCustomList();
  }

  /* ============================================================
   * 导航与绑定
   * ============================================================ */
  function switchView(v) {
    if (v !== 'week' && window.__closeCustomSheet) window.__closeCustomSheet();
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

  /* ========== 我的自定义活动 ========== */
  function renderCustomList() {
    var box = $('customList');
    if (!box) return;
    if (!CUSTOMS.length) {
      box.innerHTML = '<div class="empty">还没有自定义活动。在上方添加，如“第5周周三第3-4节 踢足球”。</div>';
      return;
    }
    CUSTOMS = CUSTOMS.slice().sort(function (a, b) { return a.day - b.day || a.start - b.start; });
    box.innerHTML = CUSTOMS.map(function (x) {
      var wkDesc = (x.weeks && String(x.weeks).trim()) ? (x.weeks.indexOf('1-') === 0 ? '全周' : x.weeks + '周') : '全周';
      return '<div class="custom-list-item">' +
        '<div class="info"><div class="t">☆ ' + esc(x.title) + '</div>' +
        '<div class="s">' + dayNameWD(x.day) + ' 第' + x.start + (x.end > x.start ? '-' + x.end : '') + '节 · ' + wkDesc +
        (x.note ? ' · ' + esc(x.note) : '') + '</div></div>' +
        '<button class="del" data-id="' + esc(x.id) + '">删除</button></div>';
    }).join('');
  }
  function addCustom() {
    var title = $('cusTitle').value.trim();
    if (!title) { alert('请填写活动名称'); return; }
    var s = +$('cusStart').value, e = +$('cusEnd').value;
    if (e < s) { alert('结束节次不能早于开始节次'); return; }
    var weeks = $('cusWeeks').value.trim();
    if (weeks) {
      try { C.parseWeekSpec(weeks); } catch (err) { alert('周次格式无法识别，例如：10、5-8、单周、双周'); return; }
    }
    CUSTOMS.push({
      id: String(Date.now()) + '-' + Math.floor(Math.random() * 1000),
      title: title,
      day: +$('cusDay').value,
      start: s, end: e,
      weeks: weeks,
      note: $('cusNote').value.trim()
    });
    saveCustoms(CUSTOMS);
    $('cusTitle').value = ''; $('cusNote').value = ''; $('cusWeeks').value = '';
    renderCustomList();
    if (view === 'today') renderToday();
    if (view === 'week') renderWeek();
  }
  function removeCustom(id) {
    CUSTOMS = CUSTOMS.filter(function (x) { return String(x.id) !== String(id); });
    saveCustoms(CUSTOMS);
    renderCustomList();
    if (view === 'today') renderToday();
    if (view === 'week') renderWeek();
  }
  function bindCustomUI() {
    var btn = $('btnAddCustom');
    if (btn) btn.addEventListener('click', addCustom);
    var list = $('customList');
    if (list) list.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.className === 'del') removeCustom(t.getAttribute('data-id'));
    });
    // 结束节次默认跟随开始节次
    var cs = $('cusStart'), ce = $('cusEnd');
    if (cs && ce) cs.addEventListener('change', function () { if (+ce.value < +cs.value) ce.value = cs.value; });
    // 点击课表中的⭐自定义块/卡片 → 确认删除
    function askDelete(ev) {
      var el = ev.target;
      while (el && el !== document && !el.getAttribute) el = el.parentNode;
      var node = ev.target && ev.target.closest ? ev.target.closest('[data-del]') : null;
      if (!node) return;
      ev.stopPropagation();
      var okDel = (typeof window.confirm === 'function') ? window.confirm('删除这个自定义活动？') : true;
      if (okDel) removeCustom(node.getAttribute('data-del'));
    }
    var gw = $('gridWrap'); if (gw) gw.addEventListener('click', askDelete);
    var tl = $('todayList'); if (tl) tl.addEventListener('click', askDelete);
    // 悬浮＋号 → 打开/关闭面板
    var sheet = $('customSheet'), back = $('sheetBackdrop'), close = $('btnCloseSheet');
    function openSheet() { if (sheet) { sheet.classList.remove('hidden'); renderCustomList(); } }
    function closeSheet() { if (sheet) sheet.classList.add('hidden'); }
    if ($('fabCustom')) $('fabCustom').addEventListener('click', openSheet);
    if (back) back.addEventListener('click', closeSheet);
    if (close) close.addEventListener('click', closeSheet);
    window.__closeCustomSheet = closeSheet;
  }
  bindCustomUI();

  bind();
  renderAll();
})();
