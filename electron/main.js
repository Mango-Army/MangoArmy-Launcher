const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const { Client } = require('minecraft-launcher-core');
const { Auth } = require('msmc');
const fs = require('fs');
const os = require('os');

// Initialize Launcher
const launcher = new Client();
const msmc = new Auth("select_a_token");

// Main Window Reference
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 900,
        minHeight: 600,
        frame: false, // Frameless for custom UI
        transparent: true, // Transparent for rounded corners
        backgroundColor: '#00000000', // Fully transparent bg
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hidden',
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:1420');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
    }

    // Window State Events
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-state', 'maximized'));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', 'normal'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ==========================================
// IPC HANDLERS (Simulating the old Tauri commands)
// ==========================================

// Window Controls
ipcMain.handle('minimize_window', () => mainWindow?.minimize());
ipcMain.handle('maximize_window', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.handle('close_window', () => mainWindow?.close());

// System Info
ipcMain.handle('get_app_data_dir', () => {
    const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
    return appData;
});

ipcMain.handle('get_installed_versions', async () => {
    const mcPath = path.join(process.env.APPDATA || os.homedir(), '.mango_launcher', 'versions');
    if (!fs.existsSync(mcPath)) return [];

    try {
        const versions = fs.readdirSync(mcPath).filter(f => {
            return fs.statSync(path.join(mcPath, f)).isDirectory();
        });
        return versions;
    } catch (e) {
        console.error(e);
        return [];
    }
});

// Authentication
ipcMain.handle('microsoft_login', async () => {
    try {
        const xboxManager = await msmc.launch("electron");
        const token = await xboxManager.getMinecraft();
        return token.mclc(); // Returns object compatible with launcher-core
    } catch (e) {
        console.error(e);
        return { error: e.message };
    }
});

ipcMain.handle('logout', async () => {
    // Implement logout logic if needed (clearing tokens)
    return true;
});

ipcMain.handle('check_saved_login', async () => {
    // Logic to check saved tokens would go here
    return null;
});

// Helper to find Java
const { execSync } = require('child_process');
const getJavaPath = () => {
    try {
        const javaPath = execSync('where java').toString().split('\r\n')[0].trim();
        return javaPath;
    } catch (e) {
        return null;
    }
};

// Launch Minecraft
ipcMain.handle('launch_minecraft', async (event, { options }) => {
    console.log("Launching Minecraft with options:", options);

    // Detect Java
    const javaPath = getJavaPath();
    if (!javaPath) {
        return { success: false, error: "No se encontró Java instalado. Instala Java 17." };
    }
    console.log("Using Java at:", javaPath);

    // Prepare options for minecraft-launcher-core
    const launcherOptions = {
        clientPackage: null,
        authorization: options.userAuth || {
            access_token: "unsigned",
            client_token: "unsigned",
            uuid: require('crypto').randomUUID(),
            name: options.username || "Player",
            user_properties: "{}"
        },
        root: path.join(process.env.APPDATA || os.homedir(), '.mango_launcher'),
        version: {
            number: options.version,
            type: options.type
        },
        memory: {
            max: "4G",
            min: "2G"
        },
        javaPath: javaPath,
        overrides: {
            detached: false,
            maxSockets: 64
        }
    };

    // Forward events to renderer
    const onData = (data) => {
        const line = data.toString();
        mainWindow?.webContents.send('launch-progress', { type: 'log', data: line });
        console.log(`[MC]: ${line}`);
    };

    const onProgress = (data) => {
        const percent = (data.task / data.total) * 100;
        mainWindow?.webContents.send('launch-progress', {
            type: 'progress',
            percent,
            task: data.task,
            total: data.total,
            category: data.type
        });
    };

    const onClose = (code) => {
        console.log(`[MC] Process exited with code ${code}`);
        mainWindow?.webContents.send('game-closed', code);
        if (code !== 0) {
            mainWindow?.webContents.send('launch-error', { message: `Código de error ${code}. Verifica logs (Ctrl+Shift+I)` });
        }
    };

    launcher.on('data', onData);
    launcher.on('progress', onProgress);
    launcher.on('close', onClose);
    launcher.on('debug', onData);

    try {
        await launcher.launch(launcherOptions);
        return { success: true };
    } catch (e) {
        console.error("Launch error:", e);
        return { success: false, error: e.message };
    }
});

// Open External
ipcMain.handle('open_external', (event, url) => {
    shell.openExternal(url);
});
