/* ============================================================
 * 课表数据 —— 网安B24（2026-2027学年度第一学期，周一=2026-09-07）
 * ★ 来源：用户教务系统导出的 TimeTable.html（权威，含讲授/上机与分段）
 *   + 课程上机/课内实验安排（教师通知）
 * 仅标注节次，不显示上下课时间。
 * ============================================================ */
(function (global) {
  'use strict';
  var SCHEDULE = {
    title: '课表',
    termLabel: '2026-2027学年度第一学期',
    semesterStart: '2026-09-07',
    totalWeeks: 16,
    showTimes: false,   // 只显示节次，不显示上下课时间

    periods: [
      { no: 1, start: '08:00', end: '08:45' },
      { no: 2, start: '08:55', end: '09:40' },
      { no: 3, start: '10:00', end: '10:45' },
      { no: 4, start: '10:55', end: '11:40' },
      { no: 5, start: '13:30', end: '14:15' },
      { no: 6, start: '14:25', end: '15:10' },
      { no: 7, start: '15:30', end: '16:15' },
      { no: 8, start: '16:25', end: '17:10' },
      { no: 9, start: '18:30', end: '19:15' },
      { no: 10, start: '19:25', end: '20:10' }
    ],

    courses: [
      /* ---- 周一 ---- */
      { id: 'm1', name: '恶意代码分析与处理', teacher: '李永飞', location: '信息楼403', day: 1, start: 3, end: 4, weeks: { from: 2, to: 5, parity: 'all' }, tag: '上机', weekRemark: { 2: '不确定上不上' } },
      { id: 'm2', name: '习近平新时代中国特色社会主义思想概论', teacher: '张玉琛', location: '致远楼20404', day: 1, start: 5, end: 6, weeks: { from: 1, to: 16, parity: 'all' } },
      { id: 'm3', name: '信息论与编码', teacher: '范玉涛', location: '致远楼20706', day: 1, start: 7, end: 8, weeks: { from: 1, to: 7, parity: 'all' } },
      /* ---- 周二 ---- */
      { id: 't1', name: '恶意代码分析与处理', teacher: '李永飞', location: '明德楼(东院)30704', day: 2, start: 1, end: 2, weeks: { from: 1, to: 16, parity: 'all' } },
      { id: 't2', name: '网络安全', teacher: '王晓菊', location: '明德楼(东院)30405', day: 2, start: 3, end: 4, weeks: { from: 1, to: 16, parity: 'all' } },
      { id: 't3', name: '网络安全', teacher: '王晓菊', location: '信息楼-网络工程实验室', day: 2, start: 5, end: 6, weeks: { from: 8, to: 16, parity: 'all' }, tag: '上机', note: '课内实验' },
      { id: 't4', name: '应用密码学', teacher: '张艺博', location: '明德楼(东院)30106', day: 2, start: 7, end: 8, weeks: { from: 1, to: 16, parity: 'all' } },
      { id: 't5', name: '入侵检测技术', teacher: '姜延丰', location: '网络工程实验室', day: 2, start: 9, end: 10, weeks: { from: 4, to: 10, parity: 'all' }, tag: '上机', note: '第10周交报告，前3周不上' },
      /* ---- 周三 ---- */
      { id: 'w1', name: '入侵检测技术', teacher: '姜延丰', location: '博观楼10302', day: 3, start: 3, end: 4, weeks: { from: 1, to: 10, parity: 'all' } },
      /* ---- 周四 ---- */
      { id: 'h1', name: '网络安全', teacher: '王晓菊', location: '致远楼20403', day: 4, start: 1, end: 2, weeks: { from: 1, to: 6, parity: 'all' } },
      { id: 'h2', name: '网络安全', teacher: '王晓菊', location: '信息楼-网络工程实验室', day: 4, start: 7, end: 8, weeks: { list: [16] }, tag: '上机', note: '课内实验·仅第16周（第7-8节）' },
      { id: 'h3', name: '习近平新时代中国特色社会主义思想概论', teacher: '张玉琛', location: '致远楼20404', day: 4, start: 3, end: 4, weeks: { from: 1, to: 8, parity: 'all' } },
      { id: 'h4', name: '恶意代码分析与处理', teacher: '李永飞', location: '明德楼(东院)30704', day: 4, start: 5, end: 6, weeks: { from: 1, to: 4, parity: 'all' } },
      { id: 'h5', name: '恶意代码分析与处理', teacher: '李永飞', location: '信息楼403', day: 4, start: 5, end: 6, weeks: { from: 5, to: 13, parity: 'all' }, tag: '上机' },
      { id: 'h6', name: '应用密码学', teacher: '张艺博', location: '网络工程(东)实验室', day: 4, start: 7, end: 8, weeks: { from: 7, to: 14, parity: 'all' }, tag: '上机', note: '网安B24-122(63人)' },
      /* ---- 周五 ---- */
      { id: 'f1', name: 'Linux操作系统', teacher: '杜杏菁', location: '博观楼10805', day: 5, start: 1, end: 2, weeks: { from: 1, to: 10, parity: 'all' } },
      { id: 'f2', name: '信息论与编码', teacher: '范玉涛', location: '致远楼20706', day: 5, start: 3, end: 4, weeks: { from: 1, to: 16, parity: 'all' } },
      { id: 'f3', name: '应用密码学', teacher: '张艺博', location: '明德楼(东院)30106', day: 5, start: 5, end: 6, weeks: { from: 1, to: 4, parity: 'all' } }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SCHEDULE;
  if (typeof window !== 'undefined') window.SCHEDULE = SCHEDULE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
