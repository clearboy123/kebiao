/* ============================================================
 * core.js —— 课表核心逻辑（纯函数，浏览器与 Node 通用）
 * 负责：日期/周次计算、单双周与起止周判断、当前节次推算等
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 星期：返回 1=周一 ... 7=周日（基于 Date） ---------- */
  function mondayBasedWeekday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return (d.getDay() + 6) % 7 + 1; // getDay(): 0=周日 → 换算为 1..7
  }

  function parseISO(iso) { // 'YYYY-MM-DD' → 本地 Date（零点）
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '').trim());
    if (!m) throw new Error('日期格式应为 YYYY-MM-DD: ' + iso);
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function toISO(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  function addDays(iso, n) {
    const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d);
  }

  /* 计算日期所属的学期周数：semesterStart 为第 1 周周一。
   * 开学当天及之前为 1 周；开学前返回 <=0 的值 */
  function weekNumberOf(isoDate, semesterStartISO) {
    const a = parseISO(isoDate);
    const b = parseISO(semesterStartISO);
    return Math.floor((a - b) / 86400000 / 7) + 1;
  }

  /* ---------- 周次说明解析（灵活支持多种写法） ----------
   * 支持：
   *   { from, to, parity: 'all'|'odd'|'even' }  结构化
   *   { list: [1,3,5,9] }                       指定周列表
   *   字符串: '1-16', '1-16周', '1-16单周', '1-16(双)', '3-18双',
   *           '1-3,5,7-10', '全周', '1-16周单', '2,4,6,8'
   * 返回统一对象 { type:'range'|'list', ... }，供 activeInWeek 判断 */
  function parseWeekSpec(spec) {
    if (spec == null) return { type: 'range', from: 1, to: 99, parity: 'all' };
    if (typeof spec === 'object') {
      if (Array.isArray(spec.list)) return { type: 'list', list: uniqueSorted(spec.list) };
      const p = (spec.parity || 'all').toLowerCase();
      return { type: 'range', from: +spec.from || 1, to: +spec.to || 99, parity: p };
    }
    const s = String(spec).trim();
    if (!s) return { type: 'range', from: 1, to: 99, parity: 'all' };
    let parity = 'all';
    if (/单/.test(s)) parity = 'odd';
    else if (/双/.test(s)) parity = 'even';
    const nums = s.replace(/[周单双()（）]/g, ''); // 去掉中文杂字
    if (nums === '') return { type: 'range', from: 1, to: 99, parity };
    const parts = nums.split(/[,，、;；\s]+/).filter(Boolean);
    const list = [];
    for (const part of parts) {
      const mm = /^(\d+)\s*[-–~]\s*(\d+)$/.exec(part);
      if (mm) {
        const a = +mm[1], b = +mm[2];
        for (let w = Math.min(a, b); w <= Math.max(a, b); w++) list.push(w);
      } else if (/^\d+$/.test(part)) {
        list.push(+part);
      }
    }
    if (!list.length) return { type: 'range', from: 1, to: 99, parity };
    // 若为完整连续段且跨一整段 1..N 则视为 range
    const uniq = uniqueSorted(list);
    if (uniq.length >= 3 && uniq[uniq.length - 1] - uniq[0] === uniq.length - 1) {
      return { type: 'range', from: uniq[0], to: uniq[uniq.length - 1], parity };
    }
    if (parity !== 'all') {
      // '1-16单周' 这类：整段按奇偶过滤
      return { type: 'range', from: Math.min.apply(null, uniq), to: Math.max.apply(null, uniq), parity };
    }
    return { type: 'list', list: uniq };
  }

  function uniqueSorted(arr) {
    return Array.from(new Set(arr)).sort((a, b) => a - b);
  }

  function descWeeks(weeks) {
    if (!weeks) return '';
    if (weeks.type === 'list') return weeks.list.join(',') + '周';
    const p = weeks.parity === 'odd' ? '单周' : weeks.parity === 'even' ? '双周' : '';
    return weeks.from + '-' + weeks.to + '周' + p;
  }

  /* 某课在某周是否上课 */
  function activeInWeek(course, weekNum) {
    if (!course || course.weeks == null) return true;
    const w = parseWeekSpec(course.weeks);
    if (w.type === 'list') return w.list.indexOf(weekNum) !== -1;
    if (weekNum < w.from || weekNum > w.to) return false;
    if (w.parity === 'odd') return weekNum % 2 === 1;
    if (w.parity === 'even') return weekNum % 2 === 0;
    return true;
  }

  /* ---------- 时间工具 ---------- */
  function hmToMin(t) { // '08:00' → 480
    const mm = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
    if (!mm) throw new Error('时间格式应为 HH:MM: ' + t);
    return +mm[1] * 60 + +mm[2];
  }
  function minToHM(m) {
    const h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* 根据当前时刻，返回进行中的节次信息：
   *   { index, period, startMin, endMin } 进行中
   *   { next: 下一节对象 } 若在课间/未开始
   *   null（当天没有课或已放学）由调用方判断 */
  function locatePeriod(periods, nowMin) {
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const s = hmToMin(p.start), e = hmToMin(p.end);
      if (nowMin >= s && nowMin < e) {
        return { type: 'ongoing', index: i, period: p, startMin: s, endMin: e };
      }
    }
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const s = hmToMin(p.start);
      if (nowMin < s) return { type: 'upcoming', index: i, period: p, startMin: s, endMin: hmToMin(p.end) };
    }
    return { type: 'after' };
  }

  /* 校验整份课表数据，返回 { ok, errors[] } */
  function validateSchedule(s) {
    const errors = [];
    if (!s) errors.push('schedule 为空');
    if (errors.length) return { ok: false, errors };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.semesterStart || '')) errors.push('semesterStart 必须为 YYYY-MM-DD');
    const ids = {};
    for (const c of s.courses || []) {
      if (!c.id) errors.push('存在缺少 id 的课程');
      else if (ids[c.id]) errors.push('id 重复: ' + c.id);
      ids[c.id] = 1;
      if (!c.name) errors.push('课程 ' + (c.id || '?') + ' 缺少 name');
      if (!(c.day >= 1 && c.day <= 7)) errors.push(c.name + ': day 应为 1-7');
      if (!(c.start >= 1 && c.end >= c.start)) errors.push(c.name + ': 节次区间不合法');
      try { parseWeekSpec(c.weeks); } catch (e) { errors.push(c.name + ': weeks 解析失败 ' + e.message); }
    }
    for (const p of s.periods || []) {
      try { hmToMin(p.start); hmToMin(p.end); } catch (e) { errors.push('节次 ' + (p.no || '?') + ' 时间格式错误'); }
      if (hmToMin(p.end) <= hmToMin(p.start)) errors.push('节次 ' + (p.no || '?') + ' 结束时间需晚于开始时间');
    }
    return { ok: !errors.length, errors };
  }

  const api = {
    parseISO, toISO, addDays, mondayBasedWeekday,
    weekNumberOf, parseWeekSpec, descWeeks, activeInWeek,
    hmToMin, minToHM, locatePeriod, validateSchedule, uniqueSorted
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.KBCore = api;
  global.KBCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
