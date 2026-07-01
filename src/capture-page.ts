/**
 * 手机端拍照网页。由本地服务器在 GET / 时返回。
 * 注意：内嵌 JS 全程使用字符串拼接，不用模板字面量，避免与外层 TS 模板字符串冲突。
 * mode: "insert"=插入当前笔记光标处；"newNote"=新建独立笔记。
 */
export function renderCapturePage(opts: {
  token: string;
  maxWidth: number;
  quality: number;
  mode: "insert" | "newNote";
}): string {
  const isInsert = opts.mode === "insert";
  const initialStatus = isInsert
    ? "已就绪。把书本对准摄像头，可连续拍多页；拍完点「识别并插入」，内容会写入电脑端【当前笔记】的当前光标处。"
    : "准备就绪。把书本对准摄像头，可连续拍多页。";
  const sendLabel = isInsert ? "识别并插入" : "生成笔记";
  // token 是 hex（crypto.randomBytes），可安全内联
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>scan2MD</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1115;color:#e8e8e8;padding:16px;max-width:680px;margin-left:auto;margin-right:auto}
  h1{font-size:20px;margin:8px 0 4px}
  .status{font-size:14px;color:#9aa0a6;margin:6px 0 12px;min-height:20px;word-break:break-all}
  .title{width:100%;padding:10px 12px;font-size:16px;border-radius:8px;border:1px solid #3a3f47;background:#1b1e24;color:#e8e8e8;margin-bottom:12px}
  #camWrap,#fileWrap{margin-bottom:12px}
  video{width:100%;border-radius:10px;background:#000;display:block}
  .thumb{position:relative;display:inline-block;margin:6px 6px 0 0}
  .thumb img{width:84px;height:84px;object-fit:cover;border-radius:8px}
  .thumb .del{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:0;background:#e53935;color:#fff;font-size:14px;line-height:20px;padding:0}
  button{cursor:pointer;border:0;border-radius:10px;font-size:16px;padding:12px 16px}
  .big{width:100%;font-size:18px;padding:14px}
  #cap{background:#3b82f6;color:#fff;margin-top:8px}
  .alt{display:block;background:#1f2937;color:#e8e8e8;text-align:center}
  .primary{background:#22c55e;color:#06210f}
  .ghost{background:#1b1e24;color:#9aa0a6;border:1px solid #3a3f47;margin-top:8px;width:100%}
  .actions{margin-top:14px}
  #thumbs{min-height:10px}
  input[type=file]{display:none}
</style>
</head>
<body>
<h1>scan2MD · 拍照转笔记</h1>
<div id="status" class="status">${initialStatus}</div>
<input id="title" class="title" type="text" placeholder="笔记标题（可选，留空用模板）"${
    isInsert ? ' style="display:none"' : ""
  }>
<div id="camWrap">
  <video id="v" autoplay playsinline muted></video>
  <button id="cap" class="big">📸 拍照</button>
</div>
<div id="fileWrap">
  <label class="big alt">📷 从相册 / 拍照选择
    <input id="file" type="file" accept="image/*" capture="environment">
  </label>
</div>
<div id="thumbs"></div>
<div class="actions">
  <button id="send" class="primary big">${sendLabel}</button>
  <button id="clear" class="ghost">清空已拍</button>
</div>
<script>
var TOKEN = "${opts.token}";
var MAXW = ${opts.maxWidth};
var Q = ${opts.quality};
var MODE = "${opts.mode}";
var SEND_LABEL = "${sendLabel}";
var queue = [];
var video = null;
var stream = null;

function $(id){ return document.getElementById(id); }

function setStatus(msg){ $("status").textContent = msg; }

window.addEventListener("DOMContentLoaded", function(){
  video = $("v");
  startCam();
  $("cap").onclick = capture;
  $("file").onchange = function(){ onFile(this); };
  $("send").onclick = upload;
  $("clear").onclick = function(){ queue = []; renderThumbs(); setStatus("已清空。"); };
});

async function startCam(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    setStatus("当前浏览器不支持摄像头，请用下方按钮选择图片。");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    await video.play();
    setStatus("摄像头已就绪，可拍照。");
  } catch (e) {
    setStatus("无法访问摄像头（" + (e && e.message ? e.message : e) + "）。请用下方按钮选择图片，或在浏览器里允许此来源使用摄像头。");
  }
}

function capture(){
  if (!video || !video.videoWidth){ setStatus("摄像头未就绪，请改用下方按钮选图。"); return; }
  var w = video.videoWidth, h = video.videoHeight;
  if (w > MAXW){ h = Math.round(h * MAXW / w); w = MAXW; }
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(video, 0, 0, w, h);
  push(c.toDataURL("image/jpeg", Q));
}

function onFile(input){
  var f = input.files && input.files[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function(){ push(r.result); };
  r.readAsDataURL(f);
  input.value = "";
}

function push(dataUrl){
  var b64 = String(dataUrl).split(",")[1];
  queue.push({ b64: b64, dataUrl: dataUrl });
  renderThumbs();
  setStatus("已加入 " + queue.length + " 张，可继续拍或点「" + SEND_LABEL + "」。");
}

function renderThumbs(){
  var box = $("thumbs");
  box.innerHTML = "";
  for (var i = 0; i < queue.length; i++){
    (function(idx){
      var wrap = document.createElement("div");
      wrap.className = "thumb";
      var img = document.createElement("img");
      img.src = queue[idx].dataUrl;
      var del = document.createElement("button");
      del.className = "del";
      del.textContent = "×";
      del.onclick = function(){ queue.splice(idx, 1); renderThumbs(); };
      wrap.appendChild(img);
      wrap.appendChild(del);
      box.appendChild(wrap);
    })(i);
  }
}

async function upload(){
  if (!queue.length){ setStatus("请先拍摄或选择至少一张图片。"); return; }
  var title = $("title").value.trim();
  var btn = $("send");
  btn.disabled = true;
  btn.textContent = "识别中…";
  setStatus("正在上传 " + queue.length + " 张图片并调用模型识别…");
  try {
    var images = [];
    for (var i = 0; i < queue.length; i++) images.push(queue[i].b64);
    var resp = await fetch("/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json", "x-scan-token": TOKEN },
      body: JSON.stringify({ title: title, images: images })
    });
    var data = null;
    try { data = await resp.json(); } catch (e) {}
    if (resp.ok && data && data.ok){
      if (data.mode === "insert"){
        setStatus("✅ 已插入到当前笔记的光标处");
      } else {
        setStatus("✅ 已保存：" + (data.path || "笔记"));
      }
      queue = [];
      renderThumbs();
      $("title").value = "";
    } else {
      setStatus("❌ " + ((data && data.error) || ("HTTP " + resp.status)));
    }
  } catch (e) {
    setStatus("❌ 网络错误：" + (e && e.message ? e.message : e));
  } finally {
    btn.disabled = false;
    btn.textContent = SEND_LABEL;
  }
}
</script>
</body>
</html>`;
}
