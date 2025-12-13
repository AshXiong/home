
      // --- 核心工具函数 ---
      const $ = (id) => document.getElementById(id);
      const createEl = (tag, className) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        return el;
      };

      // --- 1. 高级指纹采集 ---

      // 音频指纹 (AudioContext Fingerprinting)
      // (保持不变)
      async function getAudioFingerprint() {
        try {
          const ctx = new (window.OfflineAudioContext ||
            window.webkitOfflineAudioContext)(1, 44100, 44100);
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(10000, ctx.currentTime);
          const compressor = ctx.createDynamicsCompressor();

          osc.connect(compressor);
          compressor.connect(ctx.destination);
          osc.start(0);

          const buffer = await ctx.startRendering();
          const data = buffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += Math.abs(data[i]);
          }
          return sum.toString().slice(0, 15) + " (音频栈哈希)";
        } catch (e) {
          return "Blocked/Not Supported";
        }
      }

      // Canvas 指纹 (更隐蔽的绘图)
      function getCanvasFingerprint() {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("Browser Leak", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("Browser Leak", 4, 17);
        return canvas.toDataURL().slice(-30) + "..."; // 仅展示一部分
      }

      // WebGL/GPU 深度信息 (新增：查询数百个参数生成完整报告)
      function getGPUDeepInfo() {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl)
          return { renderer: "不支持", vendor: "不支持", reportHash: "不支持" };

        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const vendor = debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
          : "未知";
        const renderer = debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : "未知";

        // WebGL Report: 查询数百个参数
        const params = [
          gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
          gl.MAX_CUBE_MAP_TEXTURE_SIZE,
          gl.MAX_RENDERBUFFER_SIZE,
          gl.MAX_TEXTURE_SIZE,
          gl.VERSION,
          gl.SHADING_LANGUAGE_VERSION,
          // 实际应用会查询数百个参数
        ];
        let reportString = params.join("|");

        // 简易哈希函数 (模拟)
        let hash = 0;
        for (let i = 0; i < reportString.length; i++) {
          const char = reportString.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash |= 0; // Convert to 32bit integer
        }

        return {
          vendor: vendor,
          renderer: renderer,
          reportHash: "WGL-" + Math.abs(hash).toString(16),
        };
      }

      // 字体指纹 (Font Enumeration)
      function getFontFingerprint() {
        const fontList = [
          "Arial",
          "Verdana",
          "Times New Roman",
          "Courier New",
          "Georgia",
          "Trebuchet MS",
          "Comic Sans MS",
          "Impact",
          "Lucida Sans Unicode",
          "Tahoma",
          "Consolas",
          "Monaco",
          "Source Code Pro",
          "PingFang SC",
          "Microsoft YaHei",
        ];
        let availableFonts = [];
        const testText = "mmmmmmmmmmlli"; // 用于测量宽度的测试字符串
        const testSize = "12px ";

        // 测量一个基准宽度（例如，使用默认的 sans-serif）
        const getWidth = (font) => {
          const span = document.createElement("span");
          span.style.cssText = `font-size: ${testSize}; font-family: ${font};`;
          span.textContent = testText;
          document.body.appendChild(span);
          const width = span.offsetWidth;
          document.body.removeChild(span);
          return width;
        };

        // 确保 DOM 存在
        if (!document.body) return "Error: DOM not ready";

        // 追踪者会用一个基准字体宽度来判断其他字体是否可用
        // 由于此代码运行在 DOMContentLoaded 后，应该能正常工作
        fontList.forEach((font) => {
          // 实际的字体指纹技术会更复杂，这里仅作演示
          // 假设如果宽度不同于基准（例如'monospace'），则该字体可能存在
          // 简单起见，我们仅列举并生成一个基于列表的哈希
          if (document.fonts.check(`${testSize}${font}`)) {
            availableFonts.push(font.replace(/\s/g, ""));
          }
        });

        const fontString = availableFonts.sort().join("|");
        let hash = 0;
        for (let i = 0; i < fontString.length; i++) {
          const char = fontString.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash |= 0; // Convert to 32bit integer
        }

        return `FNT-${Math.abs(hash).toString(16)} (检测到 ${
          availableFonts.length
        } 字体)`;
      }

      // DOM/API 差异指纹 (新增：检测非标准属性)
      function getAPIDifferenceFingerprint() {
        const coreProperties = [
          "window",
          "document",
          "navigator",
          "console",
          "fetch",
          "Array",
        ];
        let nonStandardProps = [];

        for (let prop in window) {
          if (
            typeof window[prop] !== "function" &&
            !coreProperties.includes(prop) &&
            !prop.startsWith("webkit")
          ) {
            // 收集非标准属性名称
            nonStandardProps.push(prop);
          }
        }

        const propString = nonStandardProps.sort().slice(0, 30).join("|"); // 仅取前30个用于演示
        return `APIDiff: ${propString.slice(0, 50)}...`;
      }

      // WebRTC 泄露检测 (局域网 IP)
      async function getLocalIPs() {
        return new Promise((resolve) => {
          const ips = [];
          const pc = new RTCPeerConnection({ iceServers: [] });
          pc.createDataChannel("");
          pc.createOffer()
            .then((o) => pc.setLocalDescription(o))
            .catch(() => {});
          pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) {
              pc.close();
              resolve(
                ips.length ? ips.join(", ") : "未检测到 (可能被浏览器屏蔽)"
              );
              return;
            }
            const parts = ice.candidate.candidate.split(" ");
            const ip = parts[4];
            if (ip && ip.indexOf(".") > 0 && ip !== "0.0.0.0") {
              if (!ips.includes(ip)) ips.push(ip);
            }
          };
        });
      }

      // --- 2. 行为生物识别 (Behavioral Biometrics) ---
      // 增强点: 记录按键时间戳
      const behaviorData = {
        mousePath: [],
        clicks: 0,
        keystrokes: 0,
        scrolls: 0,
        startTime: Date.now(),
        keyDownTime: {},
        keyHoldTimes: [],
        keyIntervals: [],
        lastKeyDown: 0,
      };

      function initBehaviorTracking() {
        const canvas = $("behavior-canvas");
        const ctx = canvas.getContext("2d");

        function resize() {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }
        window.onresize = resize;
        resize();

        // 鼠标追踪可视化 (保持不变)
        document.addEventListener("mousemove", (e) => {
          const x = e.clientX;
          const y = e.clientY;

          behaviorData.mousePath.push({ x, y, t: Date.now() });
          if (behaviorData.mousePath.length > 50)
            behaviorData.mousePath.shift();

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 51, 51, 0.5)";
          ctx.lineWidth = 2;

          if (behaviorData.mousePath.length > 0) {
            ctx.moveTo(
              behaviorData.mousePath[0].x,
              behaviorData.mousePath[0].y
            );
            for (let p of behaviorData.mousePath) {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();

          updateVal("mouse-pos", `${x}, ${y}`);
          updateVal("mouse-speed", calculateSpeed());
          updateVal("mouse-path-len", behaviorData.mousePath.length);
        });

        document.addEventListener("click", () => {
          behaviorData.clicks++;
          updateVal("click-count", behaviorData.clicks);
        });

        // 键盘按下事件
        document.addEventListener("keydown", (e) => {
          if (!e.repeat) {
            // 忽略按住不放的重复事件
            behaviorData.keystrokes++;
            const now = Date.now();

            // 计算按键间隔
            if (behaviorData.lastKeyDown !== 0) {
              const interval = now - behaviorData.lastKeyDown;
              behaviorData.keyIntervals.push(interval);
              updateVal(
                "key-interval-avg",
                calculateAverage(behaviorData.keyIntervals) + " ms"
              );
            }

            behaviorData.keyDownTime[e.code] = now; // 记录按下时间
            behaviorData.lastKeyDown = now;

            updateVal("key-count", behaviorData.keystrokes);
            updateVal("last-key", e.code);
          }
        });

        // 键盘抬起事件 (新增)
        document.addEventListener("keyup", (e) => {
          const upTime = Date.now();
          const downTime = behaviorData.keyDownTime[e.code];

          if (downTime) {
            const holdTime = upTime - downTime;
            behaviorData.keyHoldTimes.push(holdTime);
            delete behaviorData.keyDownTime[e.code]; // 清除记录

            updateVal(
              "key-hold-avg",
              calculateAverage(behaviorData.keyHoldTimes) + " ms"
            );
            updateVal("last-hold-time", holdTime + " ms");
          }
        });

        document.addEventListener("scroll", () => {
          behaviorData.scrolls++;
          updateVal("scroll-count", behaviorData.scrolls);
        });
      }

      function calculateSpeed() {
        if (behaviorData.mousePath.length < 2) return "0 px/ms";
        const last = behaviorData.mousePath[behaviorData.mousePath.length - 1];
        const prev = behaviorData.mousePath[behaviorData.mousePath.length - 2];
        const dist = Math.sqrt(
          Math.pow(last.x - prev.x, 2) + Math.pow(last.y - prev.y, 2)
        );
        const time = last.t - prev.t;
        return time > 0 ? (dist / time).toFixed(2) + " px/ms" : "0";
      }

      function calculateAverage(arr) {
        if (arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return (sum / arr.length).toFixed(1);
      }

      // --- 3. 渲染逻辑 ---

      function createCard(title, id, rows, isFullWidth = false) {
        const card = createEl("div", "card");
        if (isFullWidth) card.style.gridColumn = "1 / -1";

        const h2 = createEl("h2");
        h2.innerText = title;
        card.appendChild(h2);

        rows.forEach((row) => {
          const div = createEl("div", "data-row");
          const k = createEl("span", "key");
          k.innerText = row.label;
          const v = createEl("span", "val");
          v.id = row.id || `data-${Math.random().toString(36).substr(2, 9)}`;
          v.innerHTML = row.val || "检测中...";
          if (row.danger) v.classList.add("danger");

          div.appendChild(k);
          div.appendChild(v);
          card.appendChild(div);
        });

        $("dashboard").appendChild(card);
      }

      function updateVal(id, val) {
        const el = $(id);
        if (el) el.innerText = val;
      }

      // --- 主程序 ---
      async function main() {
        $("timestamp").innerText = new Date().toLocaleString();
        const gpuInfo = getGPUDeepInfo();
        const fontFP = getFontFingerprint();
        const apiFP = getAPIDifferenceFingerprint();

        // 1. 身份与指纹 (The Fingerprint)
        createCard("🆔 唯一性指纹 (Fingerprinting)", "fp-card", [
          { label: "Canvas 哈希", val: getCanvasFingerprint(), danger: true },
          { label: "音频上下文哈希", id: "audio-fp", val: "计算中..." },
          { label: "字体指纹 (新增)", val: fontFP, danger: true }, // 新增
          { label: "浏览器 API 差异", val: apiFP }, // 新增
          { label: "User Agent", val: navigator.userAgent },
          {
            label: "硬件并发数 (CPU)",
            val: navigator.hardwareConcurrency + " 核",
          },
          {
            label: "屏幕分辨率",
            val: `${screen.width}x${screen.height} (色深:${screen.colorDepth}bit)`,
          },
          {
            label: "时区",
            val: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          { label: "系统语言", val: navigator.languages.join(", ") },
        ]);

        // 2. 网络暴露 (Network Leaks)

        createCard("🌐 网络连接暴露", "net-card", [
          { label: "公网 IP", id: "public-ip", val: "查询中..." },
          {
            label: "地理位置 (城市/国家)",
            id: "ip-location",
            val: "查询中...",
          }, // 新增
          { label: "互联网服务商 (ISP)", id: "ip-isp", val: "查询中..." }, // 新增
          {
            label: "WebRTC 局域网 IP",
            id: "local-ip",
            val: "探测中...",
            danger: true,
          },
          {
            label: "是否使用代理/VPN",
            id: "proxy-check",
            val: "分析中...",
          }, // 模拟分析
          // ... (其他网络信息不变)
        ]);

        // 3. 硬件透视 (Hardware X-Ray)
        createCard("⚙️ 硬件透视", "hw-card", [
          { label: "GPU 供应商", val: gpuInfo.vendor },
          { label: "GPU 渲染器", val: gpuInfo.renderer, danger: true },
          {
            label: "WebGL 能力报告哈希 (新增)",
            val: gpuInfo.reportHash,
            danger: true,
          }, // 新增
          {
            label: "设备内存 (RAM)",
            val: navigator.deviceMemory
              ? `~${navigator.deviceMemory} GB`
              : "未知",
          },
          { label: "电池状态", id: "battery-stat", val: "获取中..." },
        ]);

        // 4. 行为生物识别 (实时)
        createCard(
          "🖱️ 实时行为生物识别",
          "bio-card",
          [
            { label: "当前鼠标坐标", id: "mouse-pos", val: "0, 0" },
            { label: "移动速度 (反应力)", id: "mouse-speed", val: "0 px/ms" },
            { label: "鼠标路径长度 (50点)", id: "mouse-path-len", val: "0" }, // 新增
            { label: "点击次数", id: "click-count", val: "0" },
            { label: "按键次数", id: "key-count", val: "0" },
            { label: "最近按键", id: "last-key", val: "None" },
            {
              label: "平均按键保持时间 (新增)",
              id: "key-hold-avg",
              val: "N/A",
            }, // 新增
            {
              label: "平均按键间隔 (新增)",
              id: "key-interval-avg",
              val: "N/A",
            }, // 新增
            { label: "滚动距离", id: "scroll-count", val: "0" },
          ],
          true
        );

        // 异步数据填充

        // 音频指纹
        getAudioFingerprint().then((fp) => updateVal("audio-fp", fp));

        // IP 地址和地理位置解析
        // 使用 ipinfo.io, 这是一个流行的 GeoIP API，它返回 IP、城市、国家等信息。
        fetch("https://ipinfo.io/json", {
          signal: AbortSignal.timeout(5000), // 添加 5 秒超时
        })
          .then((r) => {
            if (!r.ok) {
              throw new Error(`HTTP Error: ${r.status}`);
            }
            return r.json();
          })
          .then((d) => {
            // 更新公网 IP
            updateVal("public-ip", d.ip, "safe");

            // 更新地理位置信息 (新增逻辑)
            const location = `${d.city || "未知城市"}, ${
              d.country || "未知国家"
            }`;
            updateVal("ip-location", location);
            updateVal("ip-isp", d.org || "未知"); // 组织信息即 ISP

            // 模拟分析代理/VPN (需要时区对比)
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const geoTime = d.timezone; // API 返回的 IP 时区

            let proxyStatus = "未检测到异常";
            if (geoTime && geoTime !== timeZone) {
              proxyStatus = `⚠️ 时区不匹配! (IP: ${geoTime} vs. 浏览器: ${timeZone})`;
            } else if (!d.city) {
              proxyStatus = "高风险 (无法解析IP城市)";
            } else {
              proxyStatus = "低风险 (时区匹配)";
            }

            // 更新代理检查结果
            updateVal("proxy-check", proxyStatus);
          })
          .catch((e) => {
            let errorMsg = "请求失败";
            if (e.name === "AbortError") {
              errorMsg = "超时 (Timeout)";
            } else if (e.message.includes("HTTP Error")) {
              errorMsg = e.message;
            } else if (e.toString().includes("TypeError")) {
              errorMsg = "网络或CORS被严格拦截";
            }

            updateVal("public-ip", `获取失败 (${errorMsg})`, "danger");
            updateVal("ip-location", "获取失败");
            updateVal("ip-isp", "获取失败");
            updateVal("proxy-check", "无法判断 (公共IP获取失败)");
          });

        // 电池
        if (navigator.getBattery) {
          navigator.getBattery().then((b) => {
            const status = `${(b.level * 100).toFixed(0)}% ${
              b.charging ? "(充电中)" : "(放电中)"
            }`;
            updateVal("battery-stat", status);
          });
        } else {
          updateVal("battery-stat", "API 不支持");
        }

        // 启动行为追踪
        initBehaviorTracking();
      }

      document.addEventListener("DOMContentLoaded", main);
    