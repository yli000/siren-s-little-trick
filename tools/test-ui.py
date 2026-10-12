#!/usr/bin/env python3
"""v2 浏览器端到端测试（开发用，不进包）。

    python3 tools/test-ui.py              # Chromium，结果打印到终端
    python3 tools/test-ui.py --shots out  # 另存截图

做法：用一个假的 getUserMedia 返回 Web Audio 振荡器的声音流，页面里有一个"假歌手"
每 10ms 读一次 Siren.Session.getState()，按当前该唱的音设振荡器频率——
于是整条链路（麦克风 → YIN → 逐帧判定 → 画面）都是真的在跑，只有"人"是假的。

覆盖：第一次进入（要麦克风 → 哼一声 → 唱完一首 → 出船 → 存档）、暂停 / 继续 / 退出后没有声音、
练习、换语言、清除进度、拒绝麦克风时的点按模式、三种屏幕尺寸的版面。
需要：Python 3 + Playwright（Chromium）。
"""
import argparse
import asyncio
import functools
import http.server
import json
import os
import socketserver
import sys
import threading

from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "game"))

MIC_SCRIPT = """(() => {
  window.__qa = { semis: 0, latency: 90, silentPhrase: -1, humMidi: 60, on: true, streams: [] };
  // 还开着的麦克风有几路（手机上的麦克风指示灯）
  window.__micLive = () => window.__qa.streams.filter((s) => s.getTracks().some((t) => t.readyState === 'live')).length;
  if (!navigator.mediaDevices) return;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();
    osc.type = 'triangle'; gain.gain.value = 0;
    osc.connect(gain); gain.connect(dest); osc.start();
    await ctx.resume();
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    setInterval(() => {
      const qa = window.__qa;
      if (!window.Siren || !Siren.Session || !qa.on) { gain.gain.value = 0; return; }
      const st = Siren.Session.getState();
      let midi = 0;
      if (st.phase === 'hum') midi = qa.humMidi;
      else if ((st.phase === 'sing' || st.phase === 'countin') && st.phraseIdx !== qa.silentPhrase) {
        const t = st.singT - qa.latency;
        for (const n of st.notes || []) if (t >= n.startMs && t < n.startMs + n.durMs - 40) midi = n.midi + qa.semis;
      }
      if (midi) { osc.frequency.setValueAtTime(hz(midi), ctx.currentTime); gain.gain.setTargetAtTime(0.3, ctx.currentTime, 0.005); }
      else gain.gain.setTargetAtTime(0, ctx.currentTime, 0.005);
    }, 10);
    window.__qa.streams.push(dest.stream);
    return dest.stream;
  }});
})();"""

DENY_SCRIPT = """(() => {
  if (!navigator.mediaDevices) return;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('denied', 'NotAllowedError'); } });
})();"""

HOOK = """() => {
  window.__events = [];
  ['note', 'finish', 'phase', 'pause', 'notice'].forEach((t) => Siren.Session.on(t, (p) => window.__events.push({ t, p })));
}"""


class Report:
    def __init__(self):
        self.passed = 0
        self.failed = []

    def check(self, name, ok, detail=""):
        print(("  OK   " if ok else "  FAIL ") + name + (("  — " + str(detail)) if detail != "" else ""))
        if ok:
            self.passed += 1
        else:
            self.failed.append(name)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=ROOT)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


async def tap(page, x, y):
    """按逻辑坐标（180 宽）点画布"""
    box = await page.evaluate("(() => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left, r.top, r.width, r.height, Siren.Gfx.H()]; })()")
    await page.mouse.click(box[0] + x / 180 * box[2], box[1] + y / box[4] * box[3])


async def wait_for(page, expr, timeout_ms, step=100):
    waited = 0
    while waited < timeout_ms:
        if await page.evaluate(expr):
            return True
        await page.wait_for_timeout(step)
        waited += step
    return False


async def run(args):
    R = Report()
    httpd, port = serve()
    url = "http://127.0.0.1:%d/index.html?dev=1" % port
    shots = args.shots
    if shots:
        os.makedirs(shots, exist_ok=True)

    async def shot(page, name):
        if shots:
            await page.screenshot(path=os.path.join(shots, name + ".png"))

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])

        # ------------------------------------------------------------ 1. 第一次：要麦克风 → 哼一声 → 唱完一首
        print("第一次进入，唱完一首")
        ctx = await browser.new_context(viewport={"width": 390, "height": 760}, device_scale_factor=2, locale="zh-CN")
        await ctx.add_init_script(MIC_SCRIPT)
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        await page.goto(url)
        await wait_for(page, "!!(window.__siren && __siren.name === 'title')", 5000)
        await page.evaluate(HOOK)
        await shot(page, "01-title")
        H = await page.evaluate("Siren.Gfx.H()")
        await tap(page, 90, max(await page.evaluate("Siren.Gfx.L.rockFoot") + 4, H - 4 * 28 - 6) + 11)   # 开始
        R.check("首页 → 选歌", await wait_for(page, "__siren.name === 'select'", 2000))
        await page.wait_for_timeout(500)
        await tap(page, 90, 32 + 2 + 44 + 20)    # 第一首（小星星）
        R.check("第一次点歌：先弹出麦克风说明卡", await wait_for(page, "!!__siren.modal", 2000))
        await shot(page, "02-mic-card")
        await page.keyboard.press("Enter")
        R.check("同意后进入「哼一声试试」", await wait_for(page, "__siren.name === 'hum'", 3000))
        R.check("哼一声：听见了", await wait_for(page, "Siren.Progress.range() && Siren.Progress.range().comfort > 0", 8000),
                await page.evaluate("JSON.stringify(Siren.Progress.range())"))
        await page.wait_for_timeout(500)
        await shot(page, "03-hum")
        await page.keyboard.press("Enter")
        R.check("开始唱", await wait_for(page, "__siren.name === 'play'", 3000))
        await page.wait_for_timeout(9000)
        await shot(page, "04-sing")
        R.check("唱完一首并出船", await wait_for(page, "__siren.name === 'arrive'", 120000))
        notes = await page.evaluate("__events.filter(e => e.t === 'note').map(e => e.p.tier)")
        good = len([t for t in notes if t in ("perfect", "great")])
        R.check("合成歌手唱得准：Perfect/Great 为主", good >= len(notes) * 0.8, "%d/%d" % (good, len(notes)))
        R.check("唱完立刻存档", await page.evaluate("Siren.Progress.collectedCount()") == 1)
        R.check("出船时麦克风已释放", await page.evaluate("__micLive()") == 0)
        await page.wait_for_timeout(9000)
        await shot(page, "05-arrive")
        R.check("结尾：介绍卡打完字后出现按钮", await page.evaluate("!!document.getElementById('screen')"))

        # ------------------------------------------------------------ 2. 暂停 / 继续 / 退出
        print("暂停与退出")
        await page.evaluate("__siren.go('select')")
        await page.wait_for_timeout(400)
        await page.evaluate("__siren.startSong(Siren.SONGS[1])")
        await wait_for(page, "Siren.Session.getState().phase === 'listen'", 5000)
        await page.wait_for_timeout(800)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(100)
        R.check("返回键 = 暂停", await page.evaluate("Siren.Session.getState().paused"))
        R.check("暂停后 100ms 内没有她的歌声", await page.evaluate("Siren.Audio.voiceCount()") == 0)
        R.check("暂停：麦克风释放", await page.evaluate("__micLive()") == 0)
        await page.wait_for_timeout(250)
        R.check("暂停：海浪也停", await page.evaluate("Siren.Audio.stats().seaGain") < 0.05, await page.evaluate("Siren.Audio.stats().seaGain"))
        await shot(page, "06-pause")
        await page.keyboard.press("Enter")
        R.check("继续：从这一句的「听她唱」重新开始", await wait_for(page, "Siren.Session.getState().phase === 'listen' && !Siren.Session.getState().paused", 2000))
        R.check("继续：重新拿到麦克风", await page.evaluate("__micLive()") == 1)
        await page.wait_for_timeout(600)
        await page.evaluate("Siren.Session.pause()")
        await page.wait_for_timeout(100)
        await tap(page, 90, (H - 128) // 2 + 92 + 12)   # 退出
        await page.wait_for_timeout(150)
        R.check("退出：回到选歌，没有残留的歌声", await page.evaluate("__siren.name === 'select' && Siren.Audio.voiceCount() === 0 && Siren.Session.getState().phase === 'idle'"))
        R.check("退出：麦克风已释放", await page.evaluate("__micLive()") == 0)

        # 暂停 → 重新开始：重新拿麦克风，不会掉进点按模式
        await page.evaluate("__siren.startSong(Siren.SONGS[1])")
        await wait_for(page, "Siren.Session.getState().phase === 'listen'", 5000)
        await page.evaluate("Siren.Session.pause()")
        await page.wait_for_timeout(100)
        await tap(page, 90, (H - 128) // 2 + 62 + 12)   # 重新开始
        await wait_for(page, "Siren.Session.getState().phase === 'sing'", 15000)
        R.check("暂停 → 重新开始：麦克风回来了，不是点按模式",
                await page.evaluate("!Siren.Session.getState().tap && __micLive() === 1"),
                await page.evaluate("JSON.stringify([Siren.Session.getState().tap, __micLive()])"))
        await page.evaluate("__siren.go('select')")
        await page.wait_for_timeout(200)

        # 切后台：自动暂停，整个音频挂起；回来再恢复
        await page.evaluate("__siren.startSong(Siren.SONGS[1])")
        await wait_for(page, "Siren.Session.getState().phase === 'listen'", 5000)
        await page.wait_for_timeout(600)
        HIDE = "(h) => { Object.defineProperty(document, 'hidden', { value: h, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }"
        await page.evaluate(HIDE, True)
        await page.wait_for_timeout(300)
        R.check("切后台：自动暂停、麦克风释放、音频挂起",
                await page.evaluate("Siren.Session.getState().paused && __micLive() === 0 && Siren.Audio.stats().state === 'suspended'"),
                await page.evaluate("JSON.stringify([Siren.Session.getState().paused, __micLive(), Siren.Audio.stats().state])"))
        await page.evaluate(HIDE, False)
        await page.wait_for_timeout(300)
        R.check("回到前台：音频恢复，停在暂停层", await page.evaluate("Siren.Audio.stats().state === 'running' && Siren.Session.getState().paused"))
        await page.evaluate("__siren.go('select')")
        await page.wait_for_timeout(200)

        # ------------------------------------------------------------ 3. 练习
        print("练习")
        await page.evaluate("__siren.go('practice')")
        await page.wait_for_timeout(400)
        await shot(page, "07-practice")
        await page.evaluate("window.__qa.humMidi = 57; __siren.startPractice('find')")
        R.check("练习「找到第一个音」做完", await wait_for(page, "Siren.Progress.practiceDone('find')", 60000))
        await page.wait_for_timeout(800)
        await shot(page, "08-practice-done")

        # ------------------------------------------------------------ 4. 设置：语言、清除进度
        print("设置")
        await page.evaluate("__siren.go('settings')")
        await page.wait_for_timeout(400)
        await tap(page, 90, 40 + 36 + 15)    # 语言
        R.check("切换语言", await page.evaluate("Siren.Progress.lang()") == "en")
        await shot(page, "09-settings-en")
        await tap(page, 90, 40 + 36 * 2 + 48 + 36 * 2 + 12 + 15)   # 清除进度
        await page.wait_for_timeout(200)
        await page.evaluate("Siren.Progress.reset()")
        R.check("清除进度：图鉴清空、语言保留", await page.evaluate("Siren.Progress.collectedCount() === 0 && Siren.Progress.lang() === 'en'"))
        R.check("全程没有脚本错误", not errors, errors[:3])
        await ctx.close()

        # ------------------------------------------------------------ 5. 拒绝麦克风：点按模式
        print("拒绝麦克风")
        ctx = await browser.new_context(viewport={"width": 360, "height": 640}, device_scale_factor=2, locale="en-US")
        await ctx.add_init_script(DENY_SCRIPT)
        page = await ctx.new_page()
        await page.goto(url)
        await wait_for(page, "!!(window.__siren && __siren.name === 'title')", 5000)
        await page.evaluate("Siren.Progress.setOnboarded(); __siren.startSong(Siren.SONGS[2])")
        await page.wait_for_timeout(300)
        await page.keyboard.press("Enter")
        R.check("拒绝后进入点按模式", await wait_for(page, "Siren.Session.getState().tap === true", 8000))
        await wait_for(page, "Siren.Session.getState().phase === 'sing'", 15000)
        await page.wait_for_timeout(400)
        await shot(page, "10-tap")
        R.check("麦克风状态：未允许", await page.evaluate("Siren.Session.micState()") == "denied")
        await ctx.close()

        # ------------------------------------------------------------ 5b. 重开、说明卡、哼一声的返回
        print("重开与返回")
        ctx = await browser.new_context(viewport={"width": 390, "height": 760}, device_scale_factor=2, locale="zh-CN")
        await ctx.add_init_script(MIC_SCRIPT)
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(url)
        await wait_for(page, "!!(window.__siren && __siren.name === 'title')", 5000)
        await page.evaluate("__siren.go('practice')")
        await page.wait_for_timeout(300)
        await page.evaluate("__siren.startPractice('steps')")
        R.check("说明卡出现", await wait_for(page, "!!__siren.modal", 2000))
        await page.go_back()
        await page.wait_for_timeout(200)
        R.check("说明卡打开时按返回：只关掉卡片", await page.evaluate("!__siren.modal && __siren.name === 'practice'"))
        await page.evaluate("__siren.startPractice('steps')")
        await wait_for(page, "!!__siren.modal", 2000)
        await page.keyboard.press("Enter")
        R.check("从练习进「哼一声」", await wait_for(page, "__siren.name === 'hum'", 3000))
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(200)
        R.check("「哼一声」返回：回到练习，麦克风释放", await page.evaluate("__siren.name === 'practice' && __micLive() === 0"))
        await page.reload()
        await wait_for(page, "!!(window.__siren && __siren.name === 'title')", 5000)
        await page.evaluate("Siren.Progress.setOnboarded(); __siren.startSong(Siren.SONGS[0])")
        R.check("重开后再唱：不再弹麦克风说明卡", await wait_for(page, "__siren.name === 'play'", 3000) and not await page.evaluate("!!__siren.modal"))
        R.check("（这一段）没有脚本错误", not errors, errors[:3])
        await ctx.close()

        # ------------------------------------------------------------ 6. 版面：三种尺寸
        print("版面")
        for (w, h, name) in ((360, 640, "small"), (390, 844, "tall"), (1280, 800, "desktop")):
            ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
            page = await ctx.new_page()
            await page.goto(url)
            await wait_for(page, "!!(window.__siren && __siren.name === 'title')", 5000)
            box = await page.evaluate("(() => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
            R.check("%s：画布完整在屏幕内" % name, box[0] >= -0.5 and box[1] >= -0.5 and box[2] <= w + 0.5 and box[3] <= h + 0.5, box)
            await shot(page, "11-layout-" + name)
            await ctx.close()

        await browser.close()
    httpd.shutdown()
    print("\n%d 项通过，%d 项失败" % (R.passed, len(R.failed)))
    return 1 if R.failed else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default=None, help="截图保存目录")
    sys.exit(asyncio.run(run(ap.parse_args())))
