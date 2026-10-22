/* 塞壬的小把戏 —— 网页版专用：添加到手机桌面
 *
 * web/ 整个目录只给网页版用。tools/pack.mjs 打小红书包时会去掉这个目录，
 * 连同 index.html 里 <!-- web-only --> 那一段（小红书容器禁止 storage.persist，也不认 manifest）。
 *
 * 从桌面图标打开时，请浏览器把存档标成「持久」：手机空间不够时，浏览器就不会先清掉它。
 * 安卓 Chrome 对装到桌面的网站一般直接同意；iPhone 从桌面打开本来就不受 Safari 的 7 天清理规则影响。
 * 只在桌面打开时请求：普通网页里申请，有的浏览器会弹框问玩家。
 * 不用 Service Worker：小红书禁用，而且它的缓存会让玩家卡在旧版本。
 */
(function (global) {
  'use strict';
  var nav = global.navigator;
  var standalone = (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true;
  if (!standalone || !nav.storage || !nav.storage.persist || !nav.storage.persisted) return;
  nav.storage.persisted()
    .then(function (done) { if (!done) return nav.storage.persist(); })
    .catch(function () {});
})(window);
