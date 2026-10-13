# 《塞壬的小把戏》· 离线 H5 小游戏（v2）

塞壬先唱一句，你跟着唱一句。一首歌唱完，海上就会开来一艘船，收进图鉴。
竖屏像素风，跑在小红书小工具容器里：完全离线、单页、包体 < 2MB。没有麦克风也能玩，轮到你时跟着节奏点按就行。

**v2 的改动和理由都在 [docs/04-v2-修改意见.md](docs/04-v2-修改意见.md)**——包括判定、练习、曲库 20 首、中英文、暂停、设置页（音效 / 语言 / 麦克风 / 更新日志 / 关于 / 清除进度）、以及从游戏视角做的审查。v1 的文档（01–03 和 `v1.1.0-*`、`前端*`、`联调*`、`素材清单`）保留作历史记录，凡与 04 冲突的以 04 为准。

## 跑起来

```bash
npm run serve          # 本地预览，打开终端显示的地址（麦克风需要 http://localhost 或 https）
npm run verify         # 静态自检 + 4 组测试 + 合规校验 + 官方审计
python3 tools/test-ui.py   # 浏览器端到端（Playwright + Chromium，合成麦克风）
npm run build          # 打包 → dist/haixiao-minitool.zip（自动排除 js/probe）
```

改了任何界面文字、曲名或船名后要重跑 `npm run assets:font`（位图字体只含用到的字）；改了像素图要重跑 `npm run assets`。

## 结构

```
game/
  index.html            唯一入口：一块 canvas，按固定顺序加载 data → core → ui
  style.css             居中、最近邻缩放
  assets/pixel/         atlas.png（塞壬、船、海岛、图标）+ font.png（Fusion Pixel 12px 位图）
  data/
    songs.js            20 首歌（简谱字符串，中英文名，常客船）
    ships.js            21 艘船（稀有度、中英文名与描述）
    i18n.js             界面文案（中 / 英）
    changelog.js        更新日志
    sprites.js font.js  由 art-source/pixel/build.py 生成的图集坐标与字形表
  js/
    core/               ★ 逻辑层：不碰 DOM（D0）
      store.js          持久层（miniTool 存储 → localStorage → 内存）
      pitch.js          YIN 音高检测
      music.js          简谱解析、音域、移调
      judge.js          逐帧判定：估延迟 L、估调 K、逐音准确度、四档 + quiet
      audio.js          合成音色（塞壬 / 提示音 / 音效总线 / 海浪）
      progress.js       图鉴、抽船（稀有度权重 + 保底）、音域、语言、音效开关
      practice.js       五组发声练习
      session.js        一首歌 / 一组练习 / 哼一声 的流程：intro → 听 → 数拍 → 唱 → 结果；暂停、重开、退出
      index.js          版本号与端能力
    ui/                 画面层：canvas 像素渲染
      gfx.js            画布、精灵、位图字、海天背景、塞壬与船
      widgets.js        统一按钮、卡片、顶栏、滚动、提示条、文案
      screens-menu.js   首页 / 选歌 / 图鉴 / 练习 / 设置
      screens-play.js   唱歌 / 哼一声 / 船来了
      main.js           切屏、麦克风引导、返回键、切后台暂停、主循环
    probe/              开发工具：麦克风探针页（不进上传包）
art-source/pixel/       像素图与字体的生成脚本、源图、字体授权（SIL OFL 1.1）
tools/
  selfcheck.mjs         加载顺序 / D0 边界 / 诊断话术零命中 / Chrome 61 语法基线
  test-pitch.mjs        YIN 精度与性能
  test-songs.mjs        曲库：可解析、音域、句长、常客船
  test-judge.mjs        判定：唱准 / 唱偏 / 移调 / 八度 / 延迟 / 颤音 / 不出声 / 点按
  test-session.mjs      流程：虚拟时钟跑整首、重唱、暂停、退出后无残留声音、练习、哼一声
  test-ui.py            浏览器端到端：首次流程、暂停 / 退出、练习、语言切换、清除进度、拒绝麦克风、三种屏幕尺寸
  pack.mjs              合规校验 + 打包
```

## 判定一句话版

每一帧都拿你的音高和塞壬的那一帧比：先按"什么时候在出声"估出你慢了多少（L），再估出你用的是哪个调（K，判一个音时只用别的音来定，所以一直哼一个音不会被当成唱对），然后逐音看有多少帧落在 50 音分以内。颤音、滑音、低八度、用自己的调唱都不扣分；不出声的音不算错，会让塞壬再唱一遍。玩家只看到每个音的档位（完美 / 很好 / 不错 / 再来），不显示分数，不说"低了 / 晚了"之类的话。细节见 04 §3。

## 必须真机验证的

离线环境只能验证逻辑和合成信号，以下要在手机 / 小红书容器里试：

| 项 | 怎么验 |
| --- | --- |
| 麦克风延迟与真人嗓音的判定手感 | 真人唱几首，看档位是否符合直觉 |
| 小红书容器的返回手势 / 侧滑 | 唱歌中侧滑，应弹出暂停而不是直接退出 |
| 切后台 / 来电 | 回来时应停在暂停层，没有残留声音 |
| iOS WebKit 的 AudioContext 解锁 | 首次点击后应有海浪声 |
| 低电平麦克风 | `js/probe/probe.html` 看电平与检出率 |

## 平台硬约束（`tools/pack.mjs` 逐条检查）

- 完全离线：禁 `fetch` / `XMLHttpRequest` / WebSocket，资源全部打包
- 脚本外置：禁内联 `<script>`、`onclick=`、`eval` / `new Function` / WASM；禁 Worker
- 单页：一个 `index.html` 在 zip 根目录；禁 iframe；总包 < 2MB（当前约 320KB）
- 语法基线 ES2017 / Chrome 61
- `core/` 不碰 DOM；界面文案不出现诊断话术（selfcheck 拦截）
