// 1. 简单的解析器
function parseMarkdown(text) {
    if (!text) return "";
    return text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
}

// 2. 渲染单条消息
function renderMessage(item, chatWindow) {
    if (item.type === "divider") {
        const divider = document.createElement("div");
        divider.className = "divider";
        divider.innerHTML = `<span>${item.text || "分隔线"}</span>`;
        chatWindow.appendChild(divider);
        return;
    }

    const row = document.createElement("div");
    row.className = `message-row ${item.role === "清言" ? "qingyan" : "bear"}`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${item.role === "清言" ? "qingyan" : "bear"}`;

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "content-wrapper";

    const nickname = document.createElement("div");
    nickname.className = "nickname";
    nickname.innerText = item.role;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = parseMarkdown(item.text);

    contentWrapper.appendChild(nickname);
    contentWrapper.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(contentWrapper);

    chatWindow.appendChild(row);
}

let conversationData = [];
let currentIndex = 0;
let isWaitingForScroll = false;

// 检查是否滚动到底部
function isAtBottom(el) {
    // 允许 5px 的误差
    return el.scrollHeight - el.scrollTop <= el.clientHeight + 5;
}

async function showNextMessage() {
    const chatWindow = document.getElementById('chat-window');
    
    // 如果消息发完了，就停止
    if (currentIndex >= conversationData.length) return;

    const item = conversationData[currentIndex];
    
    // 渲染当前消息
    renderMessage(item, chatWindow);
    currentIndex++;

    // 模拟一段自然的等待时间 (打字机感)
    const delay = item.type === "divider" ? 400 : Math.min(Math.max(item.text.length * 40, 600), 1500);
    await new Promise(resolve => setTimeout(resolve, delay));

    // 核心逻辑：判断是否需要等待用户滑动
    // 如果当前已经在底部，自动显示下一条
    // 如果不在底部（说明内容已经填满且用户没往下划），则停下来
    if (isAtBottom(chatWindow)) {
        showNextMessage();
    } else {
        isWaitingForScroll = true; 
        // 可以在这里提示用户“向下滚动查看更多”
    }
}

async function initChat() {
    const chatWindow = document.getElementById('chat-window');
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    
    // 1. 获取 URL 中的 topic 参数
    // 比如访问 index.html?topic=xiong，topic 变量就是 "xiong"
    const urlParams = new URLSearchParams(window.location.search);
    const topic = urlParams.get('topic') || 'conversation'; // 默认加载 conversation.json

    try {
        // 2. 动态拼接文件名
        const response = await fetch(`./data/${topic}.json`);
        if (!response.ok) throw new Error(`在 data 目录中找不到 ${topic}.json`);
        const data = await response.json();
        
        // 3. 设置页面标题和数据
        if (data.config) {
            document.title = data.config.title;
            titleEl.innerText = data.config.title;
            subtitleEl.innerText = data.config.subtitle;
        }
        
        conversationData = data.content || data; // 兼容你之前的纯数组格式
        
        // 开始显示消息
        showNextMessage();

        // 监听滚动
        chatWindow.addEventListener('scroll', () => {
            if (isWaitingForScroll && isAtBottom(chatWindow)) {
                isWaitingForScroll = false;
                showNextMessage();
            }
        });
        
    } catch (error) {
        console.error("加载失败:", error);
        chatWindow.innerHTML = `<div style="color:red; padding:20px; text-align:center;">
            未找到对话内容 (${topic}.json)
        </div>`;
    }
}

document.addEventListener('DOMContentLoaded', initChat);