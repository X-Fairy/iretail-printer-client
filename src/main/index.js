import { app, BrowserWindow, ipcMain, dialog} from 'electron'
import electron from 'electron'
import cp from 'child_process'
import StreamDownload from './utils/StreamDownload'
import getPDFurl from './utils/getPDFurl'
import getPDFPath from './utils/getPDFPath'
import path from 'path'
import fs from 'fs'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

//用一个 Tray 来表示一个图标,这个图标处于正在运行的系统的通知区 ，通常被添加到一个 context menu 上.
const Menu = electron.Menu;
const Tray = electron.Tray;

//托盘对象
var appTray = null;

let orderForm = {}
let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 512,
    width: 720,
    skipTaskbar: true,
    icon: __static+'/icons/icon.ico' // sets window icon
  })
  // 系统托盘菜单
  let trayMenuTemplate = [
    {
      label: '打开',
      click: function () {
        mainWindow.show();
      }
    },
    {
      label: '退出',
      click: function () {
        dialog.showMessageBox({
          type: 'info',
          title: '关闭',
          message: '关闭程序将导致打印功能不可用，是否确认退出？',
          buttons: ['最小化','直接退出']
        }, res => {
          if (res === 0) {
            if(mainWindow.isMinimized()){
              mainWindow = null;
            }else{
              mainWindow.minimize();
            }
          } else {
            mainWindow = null;
            //app.quit();	//不要用quit();试了会弹两次
            app.exit();		//exit()直接关闭客户端，不会执行quit();
          }
        })
      }
    }
  ]
  //系统托盘图标
  let trayIcon = __static+'/icons/icon.png'
  appTray = new Tray(trayIcon)
  //图标的上下文菜单
  const contextMenu = Menu.buildFromTemplate(trayMenuTemplate)
  //设置此托盘图标的悬停提示内容
  appTray.setToolTip('顾家移动打印客户端')
  //设置此图标的上下文菜单
  appTray.setContextMenu(contextMenu)
  //单击右下角小图标显示应用
  appTray.on('click',function(){
    mainWindow.show();
  })


  // mainWindow.webContents.closeDevTools()
  mainWindow.loadURL(winURL)

  mainWindow.on('close', (e) => {
    e.preventDefault();		//阻止默认行为，一定要有
    mainWindow.hide()
		if(mainWindow.isMinimized()){
			mainWindow = null;
		}else{
			e.preventDefault();
			mainWindow.minimize();
		}
  })

  ipcMain.on('print-start', (event, res) => {
    orderForm = getPDFData(res)
    downloadFile(orderForm.pdfUrl, orderForm.pdfPath, orderForm.fileName)
  })
}
// =========================================================
// 限制只可以打开一个应用,2.x的文档
const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    mainWindow.show()
  }
})

if (isSecondInstance) {
  app.quit()
}
app.on('ready', createWindow)

// 限制只可以打开一个应用, 4.x的文档
// const gotTheLock = app.requestSingleInstanceLock()
// if (!gotTheLock) {
//   app.quit()
// } else {
//   app.on('second-instance', (event, commandLine, workingDirectory) => {
//     // 当运行第二个实例时,将会聚焦到mainWindow这个窗口
//     if (mainWindow) {
//       if (mainWindow.isMinimized()) mainWindow.restore()
//       mainWindow.focus()
//       mainWindow.show()
//     }
//   })
//   // 创建 myWindow, 加载应用的其余部分, etc...
//   // app.on('ready', createWindow)
//   // })
// }


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

const exeName = path.basename(process.execPath)

app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: false,
  path: process.execPath,
  args: [
    '--processStart', `"${exeName}"`,
  ]
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */

 // 解析推送消息
function getPDFData(res) {
  let tmp = JSON.parse(res.content)
  tmp.pdfUrl = getPDFurl(tmp)
  tmp.pdfPath = getPDFPath(tmp)
  return tmp
}

// 下载文件
function downloadFile(fileUrl, filePath, fileName) {
  // console.log(fileUrl)
  // console.log(filePath)
  // console.log(fileName)
  let downloadMain = new StreamDownload()
  downloadMain.downloadFile(fileUrl, __static+'/order', fileName, downloadFileCallback)
}
// 下载成功回调
function downloadFileCallback(arg, fileName) {
  if (arg === "finished")
  {
      // 动作
      printing(fileName)
  }
}

function printing(fileName) {
  let pdfUrl = __static + '/order/' + fileName + '.pdf' 
  // console.log()
  cp.exec(
      'SumatraPDF.exe -print-to-default ' + pdfUrl, 
      {
        windowsHide: true,
        cwd: __static + '/SumatraPDF'
      }, (e) => {
        fs.unlink(pdfUrl, e => {}) // 打印完成后，删除pdf文件
        if (e) {
          throw e;
        }
      });
}
