const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadApiUrl } = require('./auth.cjs');
const { PersistentAuth: AuthClient } = require('./persistent-auth.cjs');
const { SessionStore } = require('./session-store.cjs');
const { PresetStore } = require('./presets.cjs');
app.setAppUserModelId('com.marionet.client');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'dist', 'index.html');
const devUrl = app.isPackaged ? undefined : process.env.MARIONET_DEV_URL;
const configPath = app.isPackaged
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe')), 'marionet.env')
  : path.join(root, '.env');
if (devUrl && devUrl !== 'http://127.0.0.1:5173') throw new Error('Invalid development URL');
let window;
let auth;
let exiting = false;

function trusted(event) {
  return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame
    && event.senderFrame.url === (devUrl ? `${devUrl}/` : pathToFileURL(entry).href);
}

function createWindow() {
  window = new BrowserWindow({
    width: 1400, height: 850, minWidth: 920, minHeight: 640,
    title: 'MarioNet Client', frame: false, backgroundColor: '#171727', show: false,
    autoHideMenuBar: true,
    icon: path.join(root, 'build', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  if (devUrl) void window.loadURL(devUrl); else void window.loadFile(entry);
}

void app.whenReady().then(async () => {
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  try {
    auth = new AuthClient(loadApiUrl(configPath), {
      onExpired: () => { if (window && !window.isDestroyed()) window.webContents.send('auth:expired'); },
    });
  } catch {
    dialog.showErrorBox('MarioNet 설정 오류', '서버 주소를 확인해주세요. MARIONET_API_URL에는 HTTPS 주소 또는 로컬 HTTP 주소를 설정해야 합니다.');
    app.quit(); return;
  }
  auth.store = new SessionStore(path.join(app.getPath('userData'), 'sessions'), auth.origin, require('electron').safeStorage);
  try { await auth.restore(); } catch { dialog.showErrorBox('로그인 정보 오류', '저장된 로그인 정보를 읽지 못했어요. OS 계정과 저장소 권한을 확인해주세요.'); app.quit(); return; }
  ipcMain.handle('auth:verification', (event, resend) => trusted(event) && typeof resend === 'boolean' ? auth.verification(resend) : { ok: false, code: 'UNTRUSTED' });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('auth:signin', (event, input) => trusted(event) ? auth.signin(input) : { ok: false, code: 'UNTRUSTED' });
  ipcMain.handle('auth:signup', (event, input) => trusted(event) ? auth.signup(input) : { ok: false, code: 'UNTRUSTED' });
  ipcMain.handle('auth:state', event => trusted(event) ? auth.state() : null);
  ipcMain.handle('auth:signout', event => trusted(event) ? auth.signout() : { ok: false, code: 'UNTRUSTED' });
  ipcMain.handle('nodes:list', event => trusted(event) ? auth.listNodes() : { ok: false, code: 'UNTRUSTED' });
  const presets = new PresetStore(path.join(app.getPath('userData'), 'presets'));
  for (const operation of ['list', 'save', 'delete']) {
    ipcMain.handle(`presets:${operation}`, async (event, input) => {
      const current = auth.state();
      if (!trusted(event) || !current) return { ok: false, code: 'UNAUTHORIZED' };
      try {
        const entries = await presets[operation](current.user.id, input);
        if (auth.state()?.user.id !== current.user.id) return { ok: false, code: 'UNAUTHORIZED' };
        return { ok: true, presets: entries };
      } catch (error) {
        return { ok: false, code: ['INVALID_ICON', 'INVALID_PRESET', 'PRESET_LIMIT', 'PRESET_NOT_FOUND'].includes(error.message) ? error.message : 'STORAGE_ERROR' };
      }
    });
  }
  ipcMain.on('window:minimize', event => { if (trusted(event)) window.minimize(); });
  ipcMain.on('window:maximize', event => { if (trusted(event)) window.isMaximized() ? window.unmaximize() : window.maximize(); });
  ipcMain.on('window:close', event => { if (trusted(event)) window.close(); });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (exiting || !auth) return;
  event.preventDefault(); exiting = true;
  void auth.dispose().finally(() => app.quit());
});

