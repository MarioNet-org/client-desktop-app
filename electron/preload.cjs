const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marioNet', {
  verification: (resend = false) => ipcRenderer.invoke('auth:verification', resend),
  signin: (credentials) => ipcRenderer.invoke('auth:signin', credentials),
  signup: (credentials) => ipcRenderer.invoke('auth:signup', credentials),
  getSession: () => ipcRenderer.invoke('auth:state'),
  signout: () => ipcRenderer.invoke('auth:signout'),
  listNodes: () => ipcRenderer.invoke('nodes:list'),
  listPresets: () => ipcRenderer.invoke('presets:list'),
  savePreset: (preset) => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (id) => ipcRenderer.invoke('presets:delete', id),
  onExpired: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('auth:expired', listener);
    return () => ipcRenderer.removeListener('auth:expired', listener);
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});

