const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cadence', {
  call: (method, ...args) => ipcRenderer.invoke('api', method, ...args),
  on: (channel, cb) => { if (['changed', 'route'].includes(channel)) ipcRenderer.on(channel, (_e, ...a) => cb(...a)); },
});
