const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marioNet', {
  verification: (resend = false) => ipcRenderer.invoke('auth:verification', resend),
  signin: (credentials) => ipcRenderer.invoke('auth:signin', credentials),
  signup: (credentials) => ipcRenderer.invoke('auth:signup', credentials),
  getSession: () => ipcRenderer.invoke('auth:state'),
  signout: () => ipcRenderer.invoke('auth:signout'),
  listNodes: () => ipcRenderer.invoke('nodes:list'),
  requestConnection: nodeId => ipcRenderer.invoke('connections:request', nodeId),
  closeConnection: connectionId => ipcRenderer.invoke('connections:close', connectionId),
  sendWebRtcSignal: signal => ipcRenderer.invoke('webrtc:signal', signal),
  onConnectionUpdated: callback => { const listener = (_event, connection) => callback(connection); ipcRenderer.on('connection:updated', listener); return () => ipcRenderer.removeListener('connection:updated', listener); },
  onWebRtcSignal: callback => { const listener = (_event, signal) => callback(signal); ipcRenderer.on('webrtc:signal', listener); return () => ipcRenderer.removeListener('webrtc:signal', listener); },
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

