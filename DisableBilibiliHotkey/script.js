// ==UserScript==
// @name         DisableBilibiliHotkey
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  禁用Bilibili视频播放的默认快捷键，防止误使用或其他插件冲突
// @author       marvelous
// @match        https://*.bilibili.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // 默认配置
    const DEFAULT_KEYS = {
        'g': false,
        'q': false,
        'w': false,
        'e': false,
        'r': false,
        'f': false,
        'd': false,
        'm': false,
        'arrows': false,
        'volume': false,
        'wheel': false,
        'brackets': false
    };

    // 当前拦截的按键配置
    let blockedKeys = {};

    // 添加全屏状态跟踪
    let isFullscreen = false;
    let playerContainer = null;
    let playerObserver = null;

    // 滚轮监听器引用
    let wheelListener = null;

    // 存储key（用于GM_getValue/GM_setValue）
    const STORAGE_KEY = 'blockedKeys';

    // 初始化
    (async function init() {
        await loadBlockedKeys();
        setupKeyboardInterception();
        initWheelInterception();
        setupFullscreenDetection();
        // 等待DOM准备好再创建UI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupUI);
        } else {
            setupUI();
        }
        console.log('BilibiliHotkeyManager: 脚本已加载');
    })();

    // 从存储加载配置
    async function loadBlockedKeys() {
        try {
            const stored = GM_getValue(STORAGE_KEY, null);
            blockedKeys = stored ? JSON.parse(stored) : { ...DEFAULT_KEYS };
        } catch (error) {
            console.error('BilibiliHotkeyManager: 载入配置失败', error);
            blockedKeys = { ...DEFAULT_KEYS };
        }
    }

    // 保存配置到存储
    async function saveBlockedKeys() {
        try {
            GM_setValue(STORAGE_KEY, JSON.stringify(blockedKeys));
        } catch (error) {
            console.error('BilibiliHotkeyManager: 保存配置失败', error);
        }
    }

    // 设置键盘事件拦截
    function setupKeyboardInterception() {
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('keypress', handleKeyPress, true);
        document.addEventListener('keyup', handleKeyUp, true);
    }

    // 处理keydown事件
    function handleKeyDown(event) {
        if (shouldBlockKey(event)) {
            event.stopPropagation();
            event.preventDefault();
            console.log(`BilibiliHotkeyManager: 已拦截快捷键 ${event.key}`);
        }
    }

    // 处理keypress事件
    function handleKeyPress(event) {
        if (shouldBlockKey(event)) {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    // 处理keyup事件
    function handleKeyUp(event) {
        if (shouldBlockKey(event)) {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    // 判断是否应该拦截按键
    function shouldBlockKey(event) {
        const key = event.key.toLowerCase();
        let keyType = null;

        // 对键检测
        if ((key === 'arrowleft' || key === 'arrowright') && blockedKeys['arrows']) {
            keyType = 'arrows';
        } else if ((key === 'arrowup' || key === 'arrowdown') && blockedKeys['volume']) {
            keyType = 'volume';
        } else if ((key === '[' || key === ']') && blockedKeys['brackets']) {
            keyType = 'brackets';
        } else if (blockedKeys.hasOwnProperty(key)) {
            keyType = key;
        }

        if (!keyType) {
            return false;
        }

        if (!blockedKeys[keyType]) {
            return false;
        }

        // 排除在输入框中
        const target = event.target;
        if (target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.contentEditable === 'true'
        )) {
            return false;
        }

        // 排除组合键
        if (event.ctrlKey || event.altKey || event.metaKey) {
            return false;
        }

        return true;
    }

    // 设置全屏状态检测
    function setupFullscreenDetection() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', findPlayerContainer);
        } else {
            findPlayerContainer();
        }
    }

    // 查找播放器容器
    function findPlayerContainer() {
        playerContainer = document.querySelector('.bpx-player-container');
        if (playerContainer) {
            updateFullscreenState();

            playerObserver = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-screen') {
                        updateFullscreenState();
                    }
                });
            });

            playerObserver.observe(playerContainer, {
                attributes: true,
                attributeFilter: ['data-screen']
            });
        } else {
            setTimeout(findPlayerContainer, 1000);
        }
    }

    // 更新全屏状态
    function updateFullscreenState() {
        if (playerContainer) {
            const screenMode = playerContainer.getAttribute('data-screen');
            const newFullscreenState = screenMode === 'web' || screenMode === 'full';

            if (isFullscreen !== newFullscreenState) {
                isFullscreen = newFullscreenState;
                console.log(`BilibiliHotkeyManager: 全屏状态更新 - ${isFullscreen ? '是' : '否'} (${screenMode})`);
                updateWheelInterception();
            }
        }
    }

    // 设置滚轮事件拦截
    function initWheelInterception() {
        updateWheelInterception();
    }

    // 更新滚轮拦截状态
    function updateWheelInterception() {
        const needsInterception = blockedKeys['wheel'] && isFullscreen;

        if (needsInterception && !wheelListener) {
            wheelListener = handleWheel;
            document.addEventListener('wheel', wheelListener, {
                passive: false,
                capture: true
            });
            console.log('BilibiliHotkeyManager: 已启用滚轮拦截');
        } else if (!needsInterception && wheelListener) {
            document.removeEventListener('wheel', wheelListener, {
                passive: false,
                capture: true
            });
            wheelListener = null;
            console.log('BilibiliHotkeyManager: 已停用滚轮拦截');
        }
    }

    // 处理滚轮事件
    function handleWheel(event) {
        const target = event.target;
        if (target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.contentEditable === 'true'
        )) {
            return;
        }

        event.stopPropagation();
        event.preventDefault();
        console.log('BilibiliHotkeyManager: 已拦截全屏滚轮事件');
    }

    // 创建UI
    function setupUI() {
        // 确保body存在
        if (!document.body) {
            setTimeout(setupUI, 100);
            return;
        }

        // 添加TamperMonkey菜单命令
        try {
            GM_registerMenuCommand('⚙️ 管理', toggleSettingsPanel);
        } catch (e) {
            console.log('BilibiliHotkeyManager: 菜单命令注册失败');
        }

        // 创建设置面板
        createSettingsPanel();
    }


    // 创建设置面板
    function createSettingsPanel() {
        // 如果已存在则移除
        const existingPanel = document.getElementById('bilibili-hotkey-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'bilibili-hotkey-panel';
        panel.innerHTML = `
            <div class="bhk-header">
                <span>Bilibili快捷键管理</span>
                <button class="bhk-close">×</button>
            </div>
            <div class="bhk-controls">
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="g" ${blockedKeys['g'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">G</span>
                    <span class="bhk-key-label">关注</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="q" ${blockedKeys['q'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">Q</span>
                    <span class="bhk-key-label">点赞</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="w" ${blockedKeys['w'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">W</span>
                    <span class="bhk-key-label">投币</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="e" ${blockedKeys['e'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">E</span>
                    <span class="bhk-key-label">收藏</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="r" ${blockedKeys['r'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">R</span>
                    <span class="bhk-key-label">三连</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="f" ${blockedKeys['f'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">F</span>
                    <span class="bhk-key-label">全屏</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="d" ${blockedKeys['d'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">D</span>
                    <span class="bhk-key-label">弹幕</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="m" ${blockedKeys['m'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">M</span>
                    <span class="bhk-key-label">静音</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="arrows" ${blockedKeys['arrows'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">←→</span>
                    <span class="bhk-key-label">快进</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="volume" ${blockedKeys['volume'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">↑↓</span>
                    <span class="bhk-key-label">音量</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="wheel" ${blockedKeys['wheel'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name-c">滚轮</span>
                    <span class="bhk-key-label">音量</span>
                </div>
                <div class="bhk-item">
                    <label class="bhk-switch">
                        <input type="checkbox" data-key="brackets" ${blockedKeys['brackets'] ? 'checked' : ''}>
                        <span class="bhk-slider"></span>
                    </label>
                    <span class="bhk-key-name">[]</span>
                    <span class="bhk-key-label">切集</span>
                </div>
            </div>
            <div class="bhk-actions">
                <button id="bhk-enable-all">全部禁用</button>
                <button id="bhk-disable-all">全部启用</button>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            #bilibili-hotkey-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 280px;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: none;
            }
            #bilibili-hotkey-panel.bhk-show {
                display: block;
            }
            .bhk-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid #eee;
                background: #f8f9fa;
                border-radius: 12px 12px 0 0;
            }
            .bhk-header span {
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }
            .bhk-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #666;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                line-height: 30px;
                text-align: center;
                border-radius: 50%;
                transition: background 0.2s;
            }
            .bhk-close:hover {
                background: #e0e0e0;
            }
            .bhk-controls {
                padding: 12px 16px;
                max-height: 400px;
                overflow-y: auto;
            }
            .bhk-item {
                display: grid;
                grid-template-columns: 44px 50px 1fr;
                align-items: center;
                gap: 12px;
                padding: 10px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            .bhk-item:last-child {
                border-bottom: none;
            }
            .bhk-key-name {
                font-weight: bold;
                color: #333;
                text-align: center;
                font-size: 15px;
                font-family: 'Consolas', 'Monaco', monospace;
            }
            .bhk-key-name-c {
                color: #333;
                text-align: center;
                font-size: 14px;
            }
            .bhk-key-label {
                color: #666;
                font-size: 14px;
            }
            .bhk-switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
            }
            .bhk-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .bhk-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #4caf50;
                transition: .3s;
                border-radius: 24px;
            }
            .bhk-slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }
            .bhk-switch input:checked + .bhk-slider {
                background-color: #9e9e9e;
            }
            .bhk-switch input:checked + .bhk-slider:before {
                transform: translateX(20px);
            }
            .bhk-actions {
                display: flex;
                gap: 10px;
                padding: 12px 16px;
                border-top: 1px solid #eee;
                background: #f8f9fa;
                border-radius: 0 0 12px 12px;
            }
            .bhk-actions button {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                background: white;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            }
            .bhk-actions button:hover {
                background: #f0f0f0;
            }
            #bhk-enable-all {
                border-color: #f44336;
                color: #f44336;
            }
            #bhk-disable-all {
                border-color: #4caf50;
                color: #4caf50;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // 绑定事件
        bindPanelEvents(panel);
    }

    // 绑定面板事件
    function bindPanelEvents(panel) {
        // 关闭按钮
        panel.querySelector('.bhk-close').addEventListener('click', () => {
            panel.classList.remove('bhk-show');
        });

        // 单个开关
        panel.querySelectorAll('[data-key]').forEach(checkbox => {
            checkbox.addEventListener('change', handleKeyToggle);
        });

        // 全部禁用
        panel.querySelector('#bhk-enable-all').addEventListener('click', () => {
            toggleAllKeys(true);
        });

        // 全部启用
        panel.querySelector('#bhk-disable-all').addEventListener('click', () => {
            toggleAllKeys(false);
        });

        // 点击面板外部关闭
        document.addEventListener('click', (e) => {
            if (panel.classList.contains('bhk-show') && !panel.contains(e.target)) {
                panel.classList.remove('bhk-show');
            }
        });
    }

    // 切换设置面板显示
    function toggleSettingsPanel() {
        const panel = document.getElementById('bilibili-hotkey-panel');
        if (panel) {
            panel.classList.toggle('bhk-show');
        }
    }

    // 处理单个按键开关
    async function handleKeyToggle(event) {
        const key = event.target.getAttribute('data-key');
        blockedKeys[key] = event.target.checked;
        await saveBlockedKeys();
        updateWheelInterception();
    }

    // 切换全部按键
    async function toggleAllKeys(enabled) {
        Object.keys(blockedKeys).forEach(key => {
            blockedKeys[key] = enabled;
        });
        await saveBlockedKeys();

        // 更新UI
        const panel = document.getElementById('bilibili-hotkey-panel');
        panel.querySelectorAll('[data-key]').forEach(checkbox => {
            checkbox.checked = enabled;
        });

        updateWheelInterception();
    }

    // 清理
    function cleanup() {
        if (playerObserver) {
            playerObserver.disconnect();
        }
        if (wheelListener) {
            document.removeEventListener('wheel', wheelListener, {
                passive: false,
                capture: true
            });
            wheelListener = null;
        }
    }

    // 页面卸载时清理
    window.addEventListener('beforeunload', cleanup);
})();
