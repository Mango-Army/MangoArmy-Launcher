import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Play, User, Layers, HardDrive, Cpu, X, Minus, Square, Key, LogOut, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { getVanillaVersions, getPaperVersions, getFabricVersions, MCVersion } from './lib/minecraft'

// Electron Window Interface Declaration
declare global {
    interface Window {
        electron: {
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            on: (channel: string, func: (...args: any[]) => void) => (() => void);
            send: (channel: string, data: any) => void;
        }
    }
}

interface Profile {
    id: string;
    name: string;
    version: string;
    engine: 'vanilla' | 'fabric' | 'paper';
}

interface Notification {
    id: number;
    type: 'error' | 'success' | 'info';
    message: string;
}

function App() {
    const [offlineUsername, setOfflineUsername] = useState('')
    const [premiumUser, setPremiumUser] = useState<{ name: string; id: string } | null>(null)
    const [premiumAuth, setPremiumAuth] = useState<any>(null)
    const [accountType, setAccountType] = useState<'offline' | 'microsoft'>('offline')
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [profiles, setProfiles] = useState<Profile[]>(() => {
        const saved = localStorage.getItem('mc_profiles')
        return saved ? JSON.parse(saved) : [{ id: '1', name: 'POR DEFECTO', version: '1.20.4', engine: 'vanilla' }]
    })
    const [activeProfileId, setActiveProfileId] = useState<string>(profiles[0].id)
    const [theme, setTheme] = useState<'classic' | 'reclaimer' | 'covenant'>('classic')
    const [installedVersions, setInstalledVersions] = useState<string[]>([])

    const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0]

    useEffect(() => {
        localStorage.setItem('mc_profiles', JSON.stringify(profiles))
    }, [profiles])

    useEffect(() => {
        const root = document.documentElement;
        const colors = {
            classic: { green: '#4f6228', blue: '#00f2ff' },
            reclaimer: { green: '#1e293b', blue: '#38bdf8' },
            covenant: { green: '#4c1d95', blue: '#d8b4fe' }
        };
        const current = colors[theme];
        root.style.setProperty('--halo-green', current.green);
        root.style.setProperty('--halo-blue', current.blue);
    }, [theme])

    const [versions, setVersions] = useState<MCVersion[]>([])
    const [paperVersions, setPaperVersions] = useState<string[]>([])
    const [availableEngines, setAvailableEngines] = useState<string[]>(['vanilla'])
    const [isLaunching, setIsLaunching] = useState(false)
    const [launchProgress, setLaunchProgress] = useState(0)
    const [showDeviceCodeModal, setShowDeviceCodeModal] = useState(false)
    const [deviceCode, setDeviceCode] = useState<any>(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [launchStatus, setLaunchStatus] = useState('')
    const [launchDetail, setLaunchDetail] = useState('')
    const [installPath, setInstallPath] = useState('Checking...')
    const [isMaximized, setIsMaximized] = useState(false)
    const [updateAvailable, setUpdateAvailable] = useState(false)
    const [updateVersion, setUpdateVersion] = useState('')
    const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false)
    const [updateDownloadProgress, setUpdateDownloadProgress] = useState(0)
    const [updateReady, setUpdateReady] = useState(false)

    // Sistema de notificaciones
    const showNotification = (type: 'error' | 'success' | 'info', message: string) => {
        const id = Date.now() + Math.random();
        setNotifications(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const loadInstalledVersions = async () => {
        try {
            const local = await window.electron.invoke('get_installed_versions', {}) as string[];
            console.log('Versiones instaladas:', local);
            setInstalledVersions(local);

            // AUTO-SYNC: Add installed versions to main profile list automatically
            if (local && local.length > 0) {
                setProfiles(prev => {
                    const updated = [...prev];
                    let changed = false;
                    local.forEach((v: string) => {
                        const exists = updated.find(p => p.version === v);
                        if (!exists) {
                            updated.push({
                                id: 'local-' + v,
                                name: v.toUpperCase(),
                                version: v,
                                engine: 'vanilla'
                            });
                            changed = true;
                        }
                    });
                    return changed ? updated : prev;
                });
            }
        } catch (e) {
            console.error('Failed to load local versions:', e);
        }
    }

    useEffect(() => {
        const unlistenState = window.electron.on('window-state', (event: any) => setIsMaximized(event === 'maximized'))

        const initDir = async () => {
            const dir = await window.electron.invoke('get_app_data_dir') as string;
            setInstallPath(dir + '/minecraft');
        }
        initDir();

        const checkSaved = async () => {
            try {
                const res = await window.electron.invoke('check_saved_login', {}) as any;
                if (res) {
                    setPremiumAuth(res);
                    const name = res.profile?.name || res.name;
                    const id = res.profile?.id || res.id || res.uuid || '';
                    if (name) {
                        setPremiumUser({ name, id });
                        setAccountType('microsoft');
                        setLaunchStatus('Sesión restaurada: ' + name);
                    }
                }
            } catch (e) { }
        };
        checkSaved();

        const unlistenProgress = window.electron.on('launch-progress', (data: any) => {
            if (data.type === 'progress') {
                setLaunchProgress(Math.round(data.percent));
                const catMap: Record<string, string> = { 'assets': 'RECURSOS', 'natives': 'NATIVOS', 'classes': 'CLASES' };
                const cat = catMap[data.category] || data.category || 'DATOS';
                setLaunchStatus(`DESCARGANDO ${cat.toUpperCase()}`);
                // Don't overwrite detail with task/total unless we want that specific info
                // We'll use the log for "Detail" primarily, or fallback to counts
            } else if (data.type === 'log') {
                const line = data.data;
                // Filtrar lo interesante
                if (line.includes('Download')) {
                    const file = line.split('/').pop() || line;
                    setLaunchDetail(file);
                } else if (line.includes('Unpacking')) {
                    setLaunchDetail('Descomprimiendo: ' + line.split(' ').pop());
                } else {
                    // Keep showing last interesting line or just the log
                    // Truncate to avoid massive layout shifts
                    if (line.length < 100) setLaunchDetail(line);
                }
            }
        })

        const unlistenError = window.electron.on('launch-error', (err: any) => {
            setIsLaunching(false)
            setLaunchStatus('Error al iniciar')
            showNotification('error', err?.message || 'Error desconocido')
        })

        const unlistenClosed = window.electron.on('game-closed', () => {
            setIsLaunching(false)
            setLaunchProgress(0)
            setLaunchStatus('')
            setLaunchDetail('')
            loadInstalledVersions();
        })

        // Update event listeners
        const unlistenUpdateAvailable = window.electron.on('update-available', (data: any) => {
            setUpdateAvailable(true)
            setUpdateVersion(data.version)
            showNotification('info', `Nueva versión ${data.version} disponible!`)
        })

        const unlistenDownloadProgress = window.electron.on('download-progress', (data: any) => {
            setUpdateDownloadProgress(Math.round(data.percent))
        })

        const unlistenUpdateDownloaded = window.electron.on('update-downloaded', (data: any) => {
            setIsDownloadingUpdate(false)
            setUpdateReady(true)
            showNotification('success', `Actualización ${data.version} lista para instalar!`)
        })

        loadInstalledVersions();

        return () => {
            unlistenState && unlistenState();
            unlistenProgress && unlistenProgress();
            unlistenError && unlistenError();
            unlistenClosed && unlistenClosed();
            unlistenUpdateAvailable && unlistenUpdateAvailable();
            unlistenDownloadProgress && unlistenDownloadProgress();
            unlistenUpdateDownloaded && unlistenUpdateDownloaded();
        }
    }, [])

    useEffect(() => {
        async function loadData() {
            const v = await getVanillaVersions()
            setVersions(v.filter(x => x.type === 'release').slice(0, 100))
            setPaperVersions(await getPaperVersions())
        }
        loadData()
    }, [])

    useEffect(() => {
        async function checkEngines() {
            const engines = ['vanilla']
            const [fabric, paper] = await Promise.all([
                import('./lib/minecraft').then(m => m.checkFabricExists(activeProfile.version)),
                import('./lib/minecraft').then(m => m.checkPaperExists(activeProfile.version))
            ])
            if (fabric) engines.push('fabric')
            if (paper) engines.push('paper')
            setAvailableEngines(engines)
            if (!engines.includes(activeProfile.engine)) {
                updateProfile(activeProfile.id, { engine: 'vanilla' })
            }
        }
        checkEngines()
    }, [activeProfile.version])

    const updateProfile = (id: string, updates: Partial<Profile>) => {
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    }

    const handleLaunch = async () => {
        if (accountType === 'microsoft' && !premiumUser) {
            showNotification('error', 'Primero debes verificar tu cuenta de Microsoft.')
            return
        }
        setIsLaunching(true)
        const isInstalled = installedVersions.includes(activeProfile.version);
        if (isInstalled) {
            setLaunchStatus('VERIFICANDO INTEGRIDAD...')
            setLaunchProgress(100)
            setLaunchDetail('Validando archivos locales...')
        } else {
            setLaunchStatus('INICIANDO DESCARGA...')
            setLaunchProgress(0)
            setLaunchDetail('Preparando entorno...')
        }

        try {
            const res = await window.electron.invoke('launch_minecraft', {
                options: {
                    username: accountType === 'microsoft' ? premiumUser?.name : offlineUsername,
                    version: activeProfile.version,
                    type: activeProfile.engine === 'vanilla' ? 'release' : activeProfile.engine,
                    accountType,
                    userAuth: accountType === 'microsoft' ? premiumAuth : undefined
                }
            }) as any;
            if (!res.success) {
                setIsLaunching(false)
                setLaunchStatus('Error: ' + res.error)
            } else {
                setLaunchStatus('Lanzando juego...')
            }
        } catch (err: any) {
            const msg = typeof err === 'string' ? err : err?.message || err?.toString?.() || 'desconocido';
            setIsLaunching(false)
            setLaunchStatus('Error crítico: ' + msg)
            showNotification('error', 'Error al iniciar: ' + msg);
        }
    }

    const handleMicrosoftLogin = async () => {
        try {
            setLaunchStatus('Iniciando autenticación Microsoft...')
            const res = await window.electron.invoke('microsoft_login', {}) as any;

            // NOTE: For simple simulation we assume success or handle the full flow in main
            // If the main process returns a Token immediately (depends on implementation), use it
            if (res.error) {
                showNotification('error', res.error);
                setLaunchStatus('Error auth');
                return;
            }

            // Simplification: In a real app we might need device code flow if not caching
            // Assuming res is user object for now based on main.js implementation attempt
            if (res.name && res.uuid) {
                setPremiumAuth(res);
                setPremiumUser({ name: res.name, id: res.uuid });
                setAccountType('microsoft');
                setLaunchStatus('Autenticado: ' + res.name);
                showNotification('success', 'Sesión iniciada con Microsoft');
            }

        } catch (err: any) {
            const msg = typeof err === 'string' ? err : err?.message || err?.toString?.() || 'desconocido';
            setLaunchStatus('Error de autenticación');
            showNotification('error', msg);
        }
    }

    const handleLogout = async () => {
        try {
            await window.electron.invoke('logout', {});
            setPremiumUser(null);
            setPremiumAuth(null);
            setAccountType('offline');
            setLaunchStatus('Sesión cerrada');
            showNotification('success', 'Has cerrado sesión correctamente');
        } catch (e) { }
    }

    const [showNewProfileModal, setShowNewProfileModal] = useState(false)
    const [newProfileName, setNewProfileName] = useState('')

    const addProfile = () => {
        setShowNewProfileModal(true)
        setNewProfileName('')
    }

    const confirmAddProfile = () => {
        if (!newProfileName.trim()) return
        const newProfile: Profile = {
            id: Date.now().toString(),
            name: newProfileName.toUpperCase(),
            version: activeProfile.version,
            engine: activeProfile.engine
        }
        setProfiles([...profiles, newProfile])
        setActiveProfileId(newProfile.id)
        setShowNewProfileModal(false)
        showNotification('success', 'Perfil creado correctamente')
    }

    const deleteProfile = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (profiles.length === 1) return
        const filtered = profiles.filter(p => p.id !== id)
        setProfiles(filtered)
        if (activeProfileId === id) setActiveProfileId(filtered[0].id)
    }

    const closeApp = () => window.electron.invoke('close_window')
    const minimizeApp = () => window.electron.invoke('minimize_window')
    const maximizeApp = () => window.electron.invoke('maximize_window')

    const handleDownloadUpdate = async () => {
        setIsDownloadingUpdate(true)
        await window.electron.invoke('download-update')
    }

    const handleInstallUpdate = () => {
        window.electron.invoke('install-update')
    }

    return (
        <div className="halo-container relative overflow-hidden bg-[#020617] h-screen w-screen">
            <div className="scanline" />
            <div className="absolute inset-0 bg-cover bg-center z-0 opacity-30 scale-110" style={{ backgroundImage: 'url(./halo_bg.png)' }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 z-0" />

            {/* Header with Drag Region */}
            <header className="halo-header z-20 border-b border-white/10 backdrop-blur-xl bg-black/40 h-12 flex" style={{ WebkitAppRegion: 'drag' } as any}>
                <div className="flex items-center gap-4 flex-1">
                    <span className="text-[12px] font-black tracking-[0.4em] text-cyan-400 uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] px-4">MANGO ARMY LAUNCHER 1.0.0</span>
                </div>
                <div className="flex items-center h-full">
                    <button onClick={minimizeApp} className="w-12 h-full hover:bg-white/10 transition-colors flex items-center justify-center group" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <div className="w-3 h-[2px] bg-white/70 group-hover:bg-white transition-colors" />
                    </button>
                    <button onClick={maximizeApp} className="w-12 h-full hover:bg-white/10 transition-colors flex items-center justify-center group" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <div className="w-3 h-3 border-[2px] border-white/70 group-hover:border-white transition-colors" />
                    </button>
                    <button onClick={closeApp} className="w-12 h-full hover:bg-red-600 transition-colors flex items-center justify-center group" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <X size={18} className="text-white/70 group-hover:text-white transition-colors" strokeWidth={2.5} />
                    </button>
                </div>
            </header>

            <main className="flex-1 flex z-10 p-8 gap-8 overflow-hidden h-[calc(100vh-3rem)]">
                <section className="w-96 flex flex-col gap-6 h-full">
                    <div className="flex items-center justify-between px-2">
                        <div className="text-[13px] text-cyan-400 font-black tracking-[0.4em] uppercase">Perfiles</div>
                        <div className="h-[2px] flex-1 bg-gradient-to-r from-cyan-500/40 to-transparent ml-6" />
                    </div>

                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-3 custom-scrollbar">
                        {profiles.map(p => (
                            <div key={p.id} onClick={() => setActiveProfileId(p.id)}
                                className={`group relative p-6 cursor-pointer transition-all border-l-[6px] rounded-r-xl ${activeProfileId === p.id ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.1)]' : 'border-white/5 bg-black/40 hover:bg-white/5'}`}>
                                <div className="flex justify-between items-start">
                                    <div className={`text-sm font-black uppercase tracking-widest ${activeProfileId === p.id ? 'text-cyan-400' : 'text-white/60'}`}>{p.name}</div>
                                    {profiles.length > 1 && (
                                        <button onClick={e => deleteProfile(p.id, e)} className="opacity-0 group-hover:opacity-100 text-red-500/60 hover:text-red-500 transition-colors">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="text-[10px] text-white/40 font-black uppercase mt-2 tracking-widest">
                                    VERSIÓN: <span className="text-white/80">{p.version}</span> // MOTOR: <span className="text-white/80">{p.engine.toUpperCase()}</span>
                                </div>
                                {activeProfileId === p.id && (
                                    <motion.div layoutId="active-marker" className="absolute -left-[6px] top-0 bottom-0 w-[6px] bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                                )}
                            </div>
                        ))}
                    </div>

                    <button onClick={addProfile} className="py-6 border-2 border-dashed border-cyan-500/20 rounded-xl text-[12px] font-black uppercase text-cyan-400/40 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/5 tracking-[0.4em] transition-all group">
                        <span className="group-hover:scale-110 inline-block transition-transform">+ Nuevo Perfil</span>
                    </button>

                    <div className="mt-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                            <div className="text-[12px] text-cyan-400/60 font-black tracking-[0.3em] uppercase">Versiones Instaladas</div>
                            <div className="h-[2px] flex-1 bg-gradient-to-r from-cyan-500/30 to-transparent ml-4" />
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {installedVersions.length === 0 && (
                                <div className="w-full text-center py-4 text-white/30 text-sm">
                                    No hay versiones instaladas
                                </div>
                            )}
                            {installedVersions.map(v => (
                                <button
                                    key={v}
                                    onClick={() => {
                                        const exists = profiles.find(p => p.version === v);
                                        if (exists) {
                                            setActiveProfileId(exists.id);
                                        }
                                    }}
                                    className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all ${activeProfile.version === v ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-white/5 border-white/10 text-white/60 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-white/10'}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="flex-1 flex flex-col gap-8 justify-between h-full">
                    <div className="flex-1 flex flex-col items-center justify-center gap-12">
                        <div className="relative group animate-float">
                            <div className="absolute inset-0 blur-[100px] bg-cyan-400/15 rounded-full animate-pulse" />
                            <img src="./spartan_logo_transparent.png" alt="Spartan" className="w-72 h-72 object-contain relative z-10 drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                                onError={(e) => {
                                    e.currentTarget.src = "https://i.imgur.com/uVzI9mH.png"; // Fallback Spartan icon if local fails
                                }}
                            />
                        </div>

                        <div className="text-center relative">
                            <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">MANGO ARMY</h1>
                            <div className="text-cyan-400 text-[11px] tracking-[0.6em] font-black uppercase mt-3 flex items-center justify-center gap-6">
                                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-cyan-400/50" />
                                LAUNCHER
                                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-cyan-400/50" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 w-full max-w-lg bg-black/40 p-8 rounded-3xl border border-white/5 backdrop-blur-md">
                            <div className="flex flex-col gap-3">
                                <label className="text-[11px] text-white/40 font-black uppercase tracking-widest pl-1">Versión</label>
                                <select className="halo-input bg-black/60 border-cyan-500/20 text-sm py-4"
                                    value={activeProfile.version}
                                    onChange={e => updateProfile(activeProfile.id, { version: e.target.value })}>
                                    {versions.map(v => <option key={v.id} value={v.id}>VERSIÓN {v.id}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="text-[11px] text-white/40 font-black uppercase tracking-widest pl-1">Motor</label>
                                <select className="halo-input bg-black/60 border-cyan-500/20 text-sm py-4"
                                    value={activeProfile.engine}
                                    onChange={e => updateProfile(activeProfile.id, { engine: e.target.value as any })}>
                                    {availableEngines.map(eng => <option key={eng} value={eng}>{eng.toUpperCase()}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="h-48 flex flex-col items-center justify-center gap-8 bg-gradient-to-t from-black/40 to-transparent p-6">
                        {isLaunching && (
                            <div className="w-full max-w-2xl space-y-4">
                                <div className="flex justify-between items-end text-xs font-bold tracking-wider">
                                    <span className="text-cyan-400 uppercase drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">
                                        {launchStatus || 'Preparando...'}
                                    </span>
                                    <span className="text-cyan-300 font-mono text-sm">{launchProgress}%</span>
                                </div>
                                <div className="relative h-6 bg-black/60 rounded overflow-hidden border border-cyan-500/30 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                                    {/* Background Grid */}
                                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_98%,rgba(6,182,212,0.1)_2%)] bg-[length:20px_100%] z-0" />

                                    {/* Filling Bar */}
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.6)] relative z-10"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${launchProgress}%` }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0)_40%,rgba(255,255,255,0.4)_50%,rgba(255,255,255,0)_60%)] bg-[length:50px_50px] animate-shimmer" />
                                    </motion.div>
                                </div>
                                <div className="flex justify-between items-start h-8">
                                    <div className="text-[10px] text-cyan-500/60 font-mono uppercase tracking-tight truncate w-3/4 flex items-center gap-2">
                                        {launchDetail && <span className="w-2 h-2 bg-cyan-500/40 rounded-full animate-pulse" />}
                                        {launchDetail || 'Esperando tareas...'}
                                    </div>
                                    <div className="text-[10px] text-white/30 font-black uppercase">
                                        MANGO ARMY SYSTEM
                                    </div>
                                </div>
                            </div>
                        )}
                        <button onClick={handleLaunch} disabled={isLaunching} className={`group relative py-8 px-32 skew-x-[-15deg] transition-all ${isLaunching ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}>
                            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl group-hover:bg-cyan-500/40 transition-all" />
                            <div className="relative border-4 border-cyan-400/50 bg-cyan-500/10 transition-all group-hover:bg-cyan-500/20 shadow-[0_0_40px_rgba(6,182,212,0.1)]">
                                <div className="absolute -left-1 -top-1 w-6 h-6 border-l-4 border-t-4 border-cyan-400" />
                                <div className="absolute -right-1 -bottom-1 w-6 h-6 border-r-4 border-b-4 border-cyan-400" />
                                <span className="text-3xl font-black text-cyan-400 tracking-[0.5em] skew-x-[15deg] block uppercase drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                                    {isLaunching ? 'CARGANDO' : (installedVersions.includes(activeProfile.version) ? 'JUGAR' : 'INSTALAR')}
                                </span>
                            </div>
                        </button>
                    </div>
                </section>

                <section className="w-96 flex flex-col gap-6 h-full">
                    <div className="bg-black/60 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="text-[12px] text-white/30 font-black uppercase tracking-[0.3em] mb-6">Control de Cuenta</div>
                        <div className="grid grid-cols-2 gap-3 bg-white/5 p-2 rounded-2xl border border-white/5 mb-8">
                            {(['offline', 'microsoft'] as const).map(type => (
                                <button key={type} onClick={() => setAccountType(type)}
                                    className={`py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${accountType === type ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'text-white/30 hover:text-white/60'}`}>
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-6 p-6 bg-white/[0.03] rounded-3xl border border-white/5 hover:border-cyan-500/30 transition-all">
                            <div className={`relative w-24 h-24 rounded-2xl border-4 overflow-hidden transition-all shadow-lg ${accountType === 'microsoft' && premiumUser ? 'border-cyan-400' : 'border-white/10'}`}>
                                <img src={`https://mc-heads.net/avatar/${(accountType === 'microsoft' ? premiumUser?.name : offlineUsername) || 'Steve'}/128`} className="w-full h-full object-cover pixelated" />
                                {accountType === 'microsoft' && premiumUser && <div className="absolute top-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-black shadow-[0_0_8px_rgba(34,197,94,0.6)]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-cyan-400/60 font-black uppercase tracking-widest mb-2">{accountType === 'microsoft' ? 'CUENTA VERIFICADA' : 'PERFIL LOCAL'}</div>
                                {accountType === 'offline' ? (
                                    <input value={offlineUsername} onChange={e => setOfflineUsername(e.target.value)}
                                        className="bg-transparent border-none text-2xl font-black text-white w-full outline-none p-0 selection:bg-cyan-500/30 placeholder:text-white/30"
                                        placeholder="Tu nombre..." />
                                ) : (
                                    <div className="text-2xl font-black text-white truncate drop-shadow-md">{premiumUser ? premiumUser.name : 'INVITADO'}</div>
                                )}
                                <div className="h-[3px] w-full bg-gradient-to-r from-cyan-500/40 to-transparent mt-3" />
                            </div>
                        </div>

                        {accountType === 'microsoft' && !premiumUser && (
                            <button onClick={handleMicrosoftLogin} className="w-full mt-8 py-5 bg-cyan-500 text-black font-black uppercase text-xs tracking-[0.3em] rounded-2xl hover:bg-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.2)] transition-all active:scale-95">
                                INICIAR SESIÓN
                            </button>
                        )}

                        {accountType === 'microsoft' && premiumUser && (
                            <button onClick={handleLogout} className="w-full mt-8 py-3 border-2 border-red-500/30 text-red-500/60 font-black uppercase text-[10px] tracking-[0.3em] rounded-xl hover:bg-red-500/10 transition-all">
                                CERRAR SESIÓN
                            </button>
                        )}
                    </div>

                    <div className="flex-1 bg-black/40 border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col gap-8">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-6 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,1)]" />
                            <span className="text-[13px] text-white/70 font-black tracking-[0.3em] uppercase">ESTADO DEL SISTEMA</span>
                        </div>
                        <div className="space-y-6">
                            {[
                                { name: 'SERVIDORES MOJANG', status: 'OK' },
                                { name: 'API MINECRAFT', status: 'OK' },
                                { name: 'FABRIC / FORGE', status: 'OK' }
                            ].map(svc => (
                                <div key={svc.name} className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                        <span className="text-white/30">{svc.name}</span>
                                        <span className="text-green-500 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            {svc.status}
                                        </span>
                                    </div>
                                    <div className="h-[3px] bg-white/5 w-full rounded-full overflow-hidden">
                                        <div className="h-full w-full bg-cyan-500/20 animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-auto pt-8 border-t border-white/10">
                            <div className="flex items-center gap-4 text-white/40">
                                <HardDrive size={18} className="text-cyan-400/60" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Carpeta de Instalación</span>
                                    <span className="text-[11px] font-bold text-white/60 truncate w-56">{installPath.split('/').pop()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Modal para nuevo perfil */}
            <AnimatePresence>
                {showNewProfileModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowNewProfileModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-black text-cyan-400 mb-6 tracking-widest">NUEVO PERFIL</h2>

                            <div className="mb-6">
                                <label className="text-white/40 text-xs uppercase tracking-widest mb-2 block">Nombre del perfil</label>
                                <input
                                    type="text"
                                    value={newProfileName}
                                    onChange={e => setNewProfileName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && confirmAddProfile()}
                                    className="w-full bg-black/50 border border-cyan-500/20 rounded-lg px-4 py-3 text-white font-bold focus:outline-none focus:border-cyan-500/50"
                                    placeholder="Mi perfil..."
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={confirmAddProfile}
                                    disabled={!newProfileName.trim()}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/30 disabled:cursor-not-allowed text-white font-black uppercase text-sm px-4 py-3 rounded-lg transition-all"
                                >
                                    Crear
                                </button>
                                <button
                                    onClick={() => setShowNewProfileModal(false)}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white/80 font-black uppercase text-sm px-4 py-3 rounded-lg transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sistema de notificaciones */}
            <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {notifications.map(notif => (
                        <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, x: -100, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -100, scale: 0.9 }}
                            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg max-w-sm ${notif.type === 'error' ? 'bg-red-950/90 border-red-500/30 text-red-200' :
                                notif.type === 'success' ? 'bg-green-950/90 border-green-500/30 text-green-200' :
                                    'bg-cyan-950/90 border-cyan-500/30 text-cyan-200'
                                }`}
                        >
                            {notif.type === 'error' && <AlertCircle size={18} className="text-red-400 flex-shrink-0" />}
                            {notif.type === 'success' && <CheckCircle size={18} className="text-green-400 flex-shrink-0" />}
                            {notif.type === 'info' && <Info size={18} className="text-cyan-400 flex-shrink-0" />}
                            <span className="text-sm font-medium">{notif.message}</span>
                            <button
                                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                                className="ml-2 text-white/40 hover:text-white/80 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Modal de actualización */}
            <AnimatePresence>
                {(updateAvailable || updateReady) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-500/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                    <Info size={24} className="text-cyan-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-cyan-400 tracking-widest">ACTUALIZACIÓN</h2>
                                    <p className="text-white/40 text-sm">Versión {updateVersion}</p>
                                </div>
                            </div>

                            {updateReady ? (
                                <>
                                    <p className="text-white/70 mb-6">
                                        La actualización está lista. El launcher se reiniciará para instalarla.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleInstallUpdate}
                                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase text-sm px-4 py-3 rounded-lg transition-all"
                                        >
                                            Instalar ahora
                                        </button>
                                        <button
                                            onClick={() => setUpdateReady(false)}
                                            className="flex-1 bg-white/10 hover:bg-white/20 text-white/80 font-black uppercase text-sm px-4 py-3 rounded-lg transition-all"
                                        >
                                            Más tarde
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-white/70 mb-6">
                                        Hay una nueva versión disponible. ¿Deseas descargarla ahora?
                                    </p>

                                    {isDownloadingUpdate && (
                                        <div className="mb-6">
                                            <div className="flex justify-between text-xs text-cyan-400 mb-2">
                                                <span>Descargando...</span>
                                                <span>{updateDownloadProgress}%</span>
                                            </div>
                                            <div className="h-2 bg-black/60 rounded overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${updateDownloadProgress}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleDownloadUpdate}
                                            disabled={isDownloadingUpdate}
                                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/30 disabled:cursor-not-allowed text-white font-black uppercase text-sm px-4 py-3 rounded-lg transition-all"
                                        >
                                            {isDownloadingUpdate ? 'Descargando...' : 'Descargar'}
                                        </button>
                                        <button
                                            onClick={() => setUpdateAvailable(false)}
                                            disabled={isDownloadingUpdate}
                                            className="flex-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white/80 font-black uppercase text-sm px-4 py-3 rounded-lg transition-all"
                                        >
                                            Ahora no
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default App
