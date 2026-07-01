import * as os from "os";

/**
 * 判断是否为 RFC1918 私有局域网地址（手机与电脑连同一 WiFi 时通常同处此网段）。
 */
function isPrivateLan(ip: string): boolean {
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/**
 * 取本机候选 IPv4 地址列表，用于拼接手机可访问的 URL。
 * - 排除 loopback（internal）与 APIPA（169.254.*）：后者是网卡没拿到 DHCP 时
 *   系统自配的链路本地地址，手机无法路由到——曾导致二维码里出现 169.254.*
 *   而手机扫码后白屏。
 * - RFC1918 私有局域网地址排在最前（手机与电脑同 WiFi 时即此网段），
 *   其次是其他非内部地址作为备选。
 */
export function getLocalIps(): string[] {
  const nets = os.networkInterfaces();
  const lan: string[] = [];
  const others: string[] = [];
  for (const name of Object.keys(nets)) {
    const list = nets[name];
    if (!list) continue;
    for (const net of list) {
      if (net.family !== "IPv4" || net.internal) continue;
      const ip = net.address;
      if (ip.startsWith("169.254.")) continue; // APIPA，手机连不上
      if (isPrivateLan(ip)) lan.push(ip);
      else others.push(ip);
    }
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ip of [...lan, ...others]) {
    if (!seen.has(ip)) {
      seen.add(ip);
      result.push(ip);
    }
  }
  return result;
}

/**
 * 取最佳候选 IP（兼容旧调用）。无可用地址时回退到 127.0.0.1。
 */
export function getLocalIp(): string {
  return getLocalIps()[0] || "127.0.0.1";
}
