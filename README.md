# 📅 手机网页版课表（kebiao-app）

一个**纯静态、手机优先**的课表网页：发一个链接给同学，大家都能在自己的手机上随时查看
「今天上什么课」「现在第几节」「下周课表」，并自动识别**单双周/起止周**。
改课表只需编辑一个数据文件，无需重新部署服务器。

> ⚠️ 目前 courses 里是**演示数据**。收到真实课表（含上机课图片）后，
> 我会把演示数据替换成你的真实课程，并在替换后给你一份「数据核对表」确认。

---

## ✨ 功能

- **今天**：今日课程卡片、正在进行/下一节倒计时、明天预告
- **本周**：整周网格课表（横向滑动），红线指示"现在"，今天列高亮
- **周次**：自动按「第 1 周周一日期」算出今天是第几周；可手动切换周数查看
- **单双周/指定周**：自动过滤，本周不上的课以虚线圈出提示
- **上机/实验课**：与普通课合并显示，带专属角标（如"上机"）
- **设置**：调整开学日期、周数、是否显示周末；偏好保存在本机
- **手机友好**：可"添加到主屏幕"，像 App 一样独立打开

## 📁 目录结构

| 文件 | 作用 |
|---|---|
| `index.html` | 页面入口 |
| `css/style.css` | 样式 |
| `js/core.js` | 核心逻辑（周次/单双周/当前节次），纯函数、可单测 |
| `js/schedule-data.js` | ★ **你的课表数据**（课程、作息节次、开学日期） |
| `js/app.js` | 页面渲染与交互 |
| `test/core.test.cjs` | 逻辑回归测试（`npm test` / `node test/core.test.cjs`） |
| `manifest.webmanifest` + `icon-*.png` | 添加到主屏幕所需 |

## ✏️ 修改课表

只改 **`js/schedule-data.js`**，字段说明在文件头部注释里。要点：

- `semesterStart`：本学期第 1 周**周一**的日期（`YYYY-MM-DD`），用于自动算"第几周"
- `periods`：每天各节的时间，按第 1 节到最后一节顺序排列
- `courses`：每门课一条，含 `day`(1=周一…7=周日)、`start/end`(第几节到第几节)、
  `weeks`(周次：全周 / `{parity:'odd'}` 单周 / `{parity:'even'}` 双周 / `{list:[...]}` 指定周 /
  字符串如 `'3-18单周'`)、`tag`(如 '上机')、`location`(教室/机房)

改完想验证数据没写错：双击打开 `index.html` 预览，或跑 `node test/core.test.cjs`。

## ▶️ 本地预览

双击 `index.html` 即可（纯静态，无任何后端依赖）。
也可以在项目目录执行 `python -m http.server 8000` 后访问 `http://localhost:8000`。

## 🚀 部署到 GitHub Pages（免费、可分享给同学）

1. 打开 [github.com/new](https://github.com/new) 新建仓库，例如 `kebiao`（Public，不勾选 README）
2. 在本项目目录执行（把 `你的用户名` 换掉）：

   ```bash
   git init
   git add .
   git commit -m "课表 v1"
   git branch -M main
   git remote add origin https://github.com/你的用户名/kebiao.git
   git push -u origin main
   ```

3. 到仓库 **Settings → Pages**：Source 选 **Deploy from a branch**，分支选 **main**、目录选 **/(root)**，Save
4. 等 1~2 分钟，访问 `https://你的用户名.github.io/kebiao/` 即可
5. 把网址发到班群，同学们点开就能看；手机上在浏览器菜单选 **「添加到主屏幕」**，像 App 一样使用

> **注意**：改课表后，重新执行 `git add . && git commit -m "更新课表" && git push` 刷新页面即可，无需重新部署。

### 若国内访问 GitHub Pages 不稳定
可改用 **Cloudflare Pages**（绑定 GitHub 仓库后自动部署，国内相对更快）、Netlify、Vercel，
或国内 **Gitee Pages**。本应用是纯静态文件，拖到任意静态托管都能用。

## 🔜 路线图

- [ ] 替换为真实课表数据（含上机课合并）并出核对表
- [ ] 部署上线验证
- [ ] （可选）升级为微信小程序
