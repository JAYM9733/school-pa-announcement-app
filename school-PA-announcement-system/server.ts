import './src/init-env';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  Classroom,
  Announcement,
  ServerInfo,
  TransmitterLockConfig,
  BellScheduleConfig,
} from './src/types';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Data persistence folder and file
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'school_pa_db.json');

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Master Transmitter Lock Password Configuration
let transmitterLockConfig: TransmitterLockConfig = {
  lockPassword: '8888',
  updatedAt: Date.now(),
  updatedBy: 'Default Security Policy',
};

// Automated Bell Schedule Configuration
let bellScheduleConfig: BellScheduleConfig = {
  enabled: true,
  activeProfileName: 'Standard School Day',
  items: [
    { id: 'bell-1', name: 'Morning Warning Bell', time: '08:30', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'morning', enabled: true },
    { id: 'bell-2', name: 'Period 1 Begins', time: '08:35', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
    { id: 'bell-3', name: 'Period 2 Begins', time: '09:25', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
    { id: 'bell-4', name: 'Morning Recess / Break', time: '10:15', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'attention', enabled: true },
    { id: 'bell-5', name: 'Period 3 Begins', time: '10:35', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
    { id: 'bell-6', name: 'Period 4 Begins', time: '11:25', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
    { id: 'bell-7', name: 'Lunch Period Starts', time: '12:15', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'lunch', enabled: true },
    { id: 'bell-8', name: 'Period 5 Begins', time: '13:00', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
    { id: 'bell-9', name: 'Period 6 Begins', time: '13:50', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'period_bell', enabled: true },
    { id: 'bell-10', name: 'School Dismissal Bell', time: '14:40', daysOfWeek: [1, 2, 3, 4, 5], chimeType: 'westminster', enabled: true },
  ],
};

// Pre-seeded realistic school classrooms
const initialClassrooms: Classroom[] = [
  {
    id: 'room-101',
    name: 'Grade 1 Classroom',
    roomNumber: '101',
    grade: 'Grade 1',
    wing: 'North Wing',
    volume: 85,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'Promethean ActivPanel 9',
    notes: 'Front row IFB display',
  },
  {
    id: 'room-102',
    name: 'Grade 2 Classroom',
    roomNumber: '102',
    grade: 'Grade 2',
    wing: 'North Wing',
    volume: 80,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'ViewSonic ViewBoard IFP7550',
    notes: 'Primary wall panel',
  },
  {
    id: 'room-103',
    name: 'Grade 3 Classroom',
    roomNumber: '103',
    grade: 'Grade 3',
    wing: 'North Wing',
    volume: 90,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'SMART Board GX',
    notes: 'East wall speaker output',
  },
  {
    id: 'room-201',
    name: 'Science Lab A',
    roomNumber: '201',
    grade: 'Grade 4',
    wing: 'Science Wing',
    volume: 95,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'BenQ Board Pro RP7503',
    notes: 'Includes auxiliary ceiling speakers',
  },
  {
    id: 'room-202',
    name: 'STEM Robotics Lab',
    roomNumber: '202',
    grade: 'Grade 5',
    wing: 'Science Wing',
    volume: 85,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'Promethean ActivPanel 9',
    notes: 'Central podium interface',
  },
  {
    id: 'room-301',
    name: 'Main Gymnasium',
    roomNumber: 'GYM-1',
    grade: 'All Grades',
    wing: 'Gym & Athletics',
    volume: 100,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'Commercial PA Receiver IFB',
    notes: 'High-gain arena amplifier linked',
  },
  {
    id: 'room-302',
    name: 'Central Library & Media Center',
    roomNumber: 'LIB-1',
    grade: 'All Grades',
    wing: 'East Hall',
    volume: 70,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'ViewSonic ViewBoard 65"',
    notes: 'Acoustic baffle zone',
  },
  {
    id: 'room-303',
    name: 'Cafeteria & Dining Hall',
    roomNumber: 'CAF-1',
    grade: 'All Grades',
    wing: 'South Wing',
    volume: 100,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: 'Dual IFB Overhead Wall Array',
    notes: 'Multi-zone speaker integration',
  },
];

const classrooms = new Map<string, Classroom>();
initialClassrooms.forEach((c) => classrooms.set(c.id, c));

let announcementHistory: Announcement[] = [
  {
    id: 'ann-init-1',
    timestamp: Date.now() - 3600000 * 2,
    type: 'chime',
    chimeType: 'morning',
    sender: 'School PA Master Automation',
    title: 'Morning Bell & Welcome Chime',
    targetType: 'all',
    targetIds: [],
    priority: 'normal',
    duration: 3,
  },
  {
    id: 'ann-init-2',
    timestamp: Date.now() - 3600000,
    type: 'tts',
    sender: 'Principal Miller (Office)',
    title: 'Morning Assembly & Weather Advisory',
    message: 'Good morning faculty and students. Please be advised that outdoor recess will be relocated indoors today due to inclement weather.',
    targetType: 'all',
    targetIds: [],
    priority: 'normal',
    duration: 8,
  },
];

// File-based persistence engine for real school durability across server reboots
function saveDatabaseToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      version: 1,
      savedAt: Date.now(),
      classrooms: Array.from(classrooms.values()),
      announcementHistory: announcementHistory.slice(-100),
      transmitterLockConfig,
      bellScheduleConfig,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.classrooms) && data.classrooms.length > 0) {
        classrooms.clear();
        data.classrooms.forEach((c: Classroom) => classrooms.set(c.id, c));
      }
      if (Array.isArray(data.announcementHistory)) {
        announcementHistory.length = 0;
        announcementHistory.push(...data.announcementHistory);
      }
      if (data.transmitterLockConfig?.lockPassword) {
        transmitterLockConfig = data.transmitterLockConfig;
      }
      if (data.bellScheduleConfig && Array.isArray(data.bellScheduleConfig.items)) {
        bellScheduleConfig = data.bellScheduleConfig;
      }
      console.log(
        `[School PA DB] Loaded persistent data: ${classrooms.size} rooms, ${announcementHistory.length} logs, ${bellScheduleConfig.items.length} scheduled bells.`
      );
    } else {
      saveDatabaseToDisk();
    }
  } catch (err) {
    console.warn('Error reading database file, retaining in-memory defaults:', err);
  }
}

// Immediately restore state from disk on server launch
loadDatabaseFromDisk();

// Map socket to connected client state
interface ClientSession {
  role: 'receiver' | 'principal' | 'server';
  classroomId?: string;
  deviceName?: string;
  ipAddress?: string;
  connectedAt: number;
}

const activeClients = new Map<WebSocket, ClientSession>();

// Helper to determine server IP addresses
function getServerIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

// Broadcast message helper
function broadcastWS(msg: any, filter?: (session: ClientSession) => boolean) {
  const data = JSON.stringify(msg);
  activeClients.forEach((session, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!filter || filter(session)) {
        try {
          ws.send(data);
        } catch (err) {
          console.error('WS send error:', err);
        }
      }
    }
  });
}

function broadcastClassroomList() {
  const list = Array.from(classrooms.values());
  broadcastWS({
    type: 'classrooms_sync',
    payload: list,
  });
}

// Setup WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  
  // Only route app-specific WebSocket connections to the school PA wss
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
  // All other upgrade requests (e.g. Vite HMR) are left to Vite's own handlers
});

wss.on('connection', (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'register': {
          const { role, classroomId, deviceName, classroomData } = data.payload;
          const session: ClientSession = {
            role: role || 'receiver',
            classroomId,
            deviceName: deviceName || 'Device',
            ipAddress: clientIp,
            connectedAt: Date.now(),
          };
          activeClients.set(ws, session);

          if (role === 'receiver' && classroomId) {
            let room = classrooms.get(classroomId);
            if (!room && classroomData) {
              room = {
                id: classroomId,
                name: classroomData.name || `Room ${classroomId}`,
                roomNumber: classroomData.roomNumber || classroomId,
                grade: classroomData.grade || 'General',
                wing: classroomData.wing || 'Main Building',
                volume: classroomData.volume ?? 80,
                isOnline: true,
                lastPing: Date.now(),
                currentStatus: 'idle',
                ipAddress: clientIp,
                panelModel: classroomData.panelModel || 'Android IFB Panel',
                notes: classroomData.notes || '',
              };
              classrooms.set(classroomId, room);
            } else if (room) {
              room.isOnline = true;
              room.lastPing = Date.now();
              room.ipAddress = clientIp;
              if (classroomData?.name) room.name = classroomData.name;
              if (classroomData?.roomNumber) room.roomNumber = classroomData.roomNumber;
              if (classroomData?.wing) room.wing = classroomData.wing;
              if (classroomData?.grade) room.grade = classroomData.grade;
              if (classroomData?.volume !== undefined) room.volume = classroomData.volume;
            }
          }

          // Acknowledge registration with current state
          ws.send(
            JSON.stringify({
              type: 'init',
              payload: {
                classrooms: Array.from(classrooms.values()),
                announcementHistory: announcementHistory.slice(-20),
                serverInfo: getServerStats(),
                assignedClassroom: classroomId ? classrooms.get(classroomId) : undefined,
                transmitterLockConfig,
              },
            })
          );

          // Broadcast updated presence to all transmitters and server
          broadcastClassroomList();
          break;
        }

        case 'heartbeat': {
          const session = activeClients.get(ws);
          if (session) {
            if (session.classroomId) {
              const room = classrooms.get(session.classroomId);
              if (room) {
                room.lastPing = Date.now();
                room.isOnline = true;
              }
            }
            ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }));
          }
          break;
        }

        case 'announcement_broadcast': {
          const announcement: Announcement = {
            id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            ...data.payload,
          };

          announcementHistory.push(announcement);
          if (announcementHistory.length > 50) {
            announcementHistory.shift();
          }

          // Target specific rooms or all
          broadcastWS(
            {
              type: 'announcement_play',
              payload: announcement,
            },
            (session) => {
              if (session.role === 'server') return true;
              if (session.role === 'receiver') {
                if (announcement.targetType === 'all') return true;
                if (!session.classroomId) return false;

                const room = classrooms.get(session.classroomId);
                if (!room) return false;

                if (announcement.targetType === 'rooms') {
                  return announcement.targetIds.includes(session.classroomId);
                }
                if (announcement.targetType === 'wings') {
                  return announcement.targetIds.includes(room.wing);
                }
              }
              return true;
            }
          );

          // Notify sender of success
          ws.send(
            JSON.stringify({
              type: 'announcement_dispatched',
              payload: { id: announcement.id },
            })
          );
          break;
        }

        case 'announcement_ack': {
          const { announcementId, classroomId, status } = data.payload;
          broadcastWS(
            {
              type: 'announcement_status',
              payload: { announcementId, classroomId, status, timestamp: Date.now() },
            },
            (s) => s.role === 'principal' || s.role === 'server'
          );
          break;
        }

        case 'voice_stream_start':
        case 'voice_stream_chunk':
        case 'voice_stream_end': {
          const { targetType, targetIds } = data.payload;
          // Forward audio stream packets to target receivers in real-time
          broadcastWS(data, (session) => {
            if (session.role === 'server') return true;
            if (session.role === 'receiver') {
              if (targetType === 'all') return true;
              if (!session.classroomId) return false;
              const room = classrooms.get(session.classroomId);
              if (!room) return false;
              if (targetType === 'rooms') return targetIds?.includes(session.classroomId);
              if (targetType === 'wings') return targetIds?.includes(room.wing);
            }
            return false;
          });
          break;
        }

        case 'ping_test': {
          const { classroomId } = data.payload;
          broadcastWS(
            {
              type: 'ping_test_received',
              payload: { classroomId },
            },
            (s) => s.role === 'receiver' && s.classroomId === classroomId
          );
          break;
        }

        case 'classroom_update': {
          const updated: Classroom = data.payload;
          if (updated && updated.id) {
            classrooms.set(updated.id, {
              ...classrooms.get(updated.id),
              ...updated,
            });
            broadcastClassroomList();
          }
          break;
        }

        case 'classroom_delete': {
          const { id } = data.payload;
          if (id && classrooms.has(id)) {
            classrooms.delete(id);
            broadcastClassroomList();
          }
          break;
        }

        case 'transmitter_lock_update': {
          const { newPassword, updatedBy } = data.payload || {};
          if (newPassword && typeof newPassword === 'string' && newPassword.trim().length >= 4) {
            transmitterLockConfig = {
              lockPassword: newPassword.trim(),
              updatedAt: Date.now(),
              updatedBy: updatedBy || 'Authorized Administrator',
            };
            broadcastWS({
              type: 'transmitter_lock_sync',
              payload: transmitterLockConfig,
            });
          }
          break;
        }

        case 'transmitter_force_lock': {
          broadcastWS(
            {
              type: 'transmitter_force_lock',
              payload: {
                timestamp: Date.now(),
                reason: data.payload?.reason || 'Console locked by Central Administrator',
              },
            },
            (s) => s.role === 'principal'
          );
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    const session = activeClients.get(ws);
    if (session) {
      if (session.role === 'receiver' && session.classroomId) {
        const room = classrooms.get(session.classroomId);
        if (room) {
          room.isOnline = false;
          broadcastClassroomList();
        }
      }
      activeClients.delete(ws);
    }
  });
});

// Periodic offline checker for stale rooms
setInterval(() => {
  const now = Date.now();
  let changed = false;
  classrooms.forEach((room) => {
    // If room hasn't pinged in 15 seconds and marked online, mark offline
    if (room.isOnline && now - room.lastPing > 18000) {
      // Keep initial demo rooms alive unless specifically toggled or inactive
      room.isOnline = false;
      changed = true;
    }
  });
  if (changed) {
    broadcastClassroomList();
  }
}, 5000);

function getServerStats(): ServerInfo {
  let activeReceivers = 0;
  let activeTransmitters = 0;

  activeClients.forEach((session) => {
    if (session.role === 'receiver') activeReceivers++;
    if (session.role === 'principal') activeTransmitters++;
  });

  const ips = getServerIpAddresses();

  return {
    status: 'online',
    serverIp: ips[0] || '127.0.0.1',
    port: PORT,
    hostname: os.hostname(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeReceivers: Math.max(activeReceivers, Array.from(classrooms.values()).filter((c) => c.isOnline).length),
    totalClassrooms: classrooms.size,
    activeTransmitters: Math.max(activeTransmitters, 1),
    announcementsCount: announcementHistory.length,
  };
}

// REST API Endpoints
app.get('/api/server-info', (req, res) => {
  res.json({
    ...getServerStats(),
    allIps: getServerIpAddresses(),
  });
});

app.get('/api/classrooms', (req, res) => {
  res.json(Array.from(classrooms.values()));
});

app.post('/api/classrooms', (req, res) => {
  const data = req.body;
  const id = data.id || `room-${data.roomNumber || Date.now()}`;
  const room: Classroom = {
    id,
    name: data.name || `Room ${data.roomNumber}`,
    roomNumber: data.roomNumber || '100',
    grade: data.grade || 'General',
    wing: data.wing || 'Main Building',
    volume: data.volume ?? 80,
    isOnline: true,
    lastPing: Date.now(),
    currentStatus: 'idle',
    panelModel: data.panelModel || 'Android IFB Panel',
    notes: data.notes || '',
  };
  classrooms.set(id, room);
  broadcastClassroomList();
  saveDatabaseToDisk();
  res.json({ success: true, classroom: room });
});

app.put('/api/classrooms/:id', (req, res) => {
  const { id } = req.params;
  const existing = classrooms.get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Classroom not found' });
  }
  const updated: Classroom = {
    ...existing,
    ...req.body,
    id,
  };
  classrooms.set(id, updated);
  broadcastClassroomList();
  saveDatabaseToDisk();
  res.json({ success: true, classroom: updated });
});

app.delete('/api/classrooms/:id', (req, res) => {
  const { id } = req.params;
  if (classrooms.has(id)) {
    classrooms.delete(id);
    broadcastClassroomList();
    saveDatabaseToDisk();
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Classroom not found' });
});

app.get('/api/announcements/history', (req, res) => {
  res.json(announcementHistory.slice(-50));
});

// Transmitter Lock Security Management Endpoints
app.get('/api/transmitter-lock', (req, res) => {
  res.json(transmitterLockConfig);
});

app.post('/api/transmitter-lock', (req, res) => {
  const { newPassword, currentPassword, updatedBy } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'Lock password must be at least 4 characters long.' });
  }

  // If currentPassword is supplied, verify it
  if (
    currentPassword !== undefined &&
    currentPassword !== transmitterLockConfig.lockPassword
  ) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  transmitterLockConfig = {
    lockPassword: newPassword.trim(),
    updatedAt: Date.now(),
    updatedBy: updatedBy || 'Central Admin',
  };

  broadcastWS({
    type: 'transmitter_lock_sync',
    payload: transmitterLockConfig,
  });

  saveDatabaseToDisk();

  res.json({ success: true, transmitterLockConfig });
});

app.post('/api/transmitter-lock/reset', (req, res) => {
  transmitterLockConfig = {
    lockPassword: '8888',
    updatedAt: Date.now(),
    updatedBy: req.body.updatedBy || 'Central System Reset',
  };

  broadcastWS({
    type: 'transmitter_lock_sync',
    payload: transmitterLockConfig,
  });

  saveDatabaseToDisk();

  res.json({ success: true, transmitterLockConfig });
});

app.post('/api/transmitter-lock/force-lock', (req, res) => {
  broadcastWS(
    {
      type: 'transmitter_force_lock',
      payload: {
        timestamp: Date.now(),
        reason: req.body.reason || 'Manual lock triggered from Central Linux Server',
      },
    },
    (s) => s.role === 'principal'
  );

  res.json({ success: true, message: 'Force lock signal sent to all active transmitters.' });
});

// Automated Daily School Bell Runner
let lastRangMinuteKey = '';
setInterval(() => {
  if (!bellScheduleConfig.enabled) return;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;
  const minuteKey = `${now.toDateString()}_${currentTimeStr}`;

  if (lastRangMinuteKey === minuteKey) return;

  for (const item of bellScheduleConfig.items) {
    if (item.enabled && item.time === currentTimeStr && item.daysOfWeek.includes(dayOfWeek)) {
      lastRangMinuteKey = minuteKey;
      console.log(`[BELL SCHEDULE] Ringing automated school bell: "${item.name}" at ${item.time}`);

      const bellAnnouncement: Announcement = {
        id: `bell-auto-${Date.now()}`,
        timestamp: Date.now(),
        type: 'chime',
        chimeType: item.chimeType,
        sender: 'School Bell Automation',
        title: item.name,
        targetType: 'all',
        targetIds: [],
        priority: 'normal',
        duration: 4,
      };

      announcementHistory.push(bellAnnouncement);
      if (announcementHistory.length > 50) announcementHistory.shift();

      broadcastWS({
        type: 'announcement_play',
        payload: bellAnnouncement,
      });

      broadcastWS({
        type: 'announcement_dispatched',
        payload: bellAnnouncement,
      });

      saveDatabaseToDisk();
      break;
    }
  }
}, 10000);

// Bell Schedule Endpoints
app.get('/api/bell-schedule', (_req, res) => {
  res.json(bellScheduleConfig);
});

app.post('/api/bell-schedule', (req, res) => {
  const { enabled, activeProfileName, items } = req.body;
  if (enabled !== undefined) bellScheduleConfig.enabled = Boolean(enabled);
  if (activeProfileName) bellScheduleConfig.activeProfileName = String(activeProfileName);
  if (Array.isArray(items)) bellScheduleConfig.items = items;

  broadcastWS({
    type: 'bell_schedule_sync',
    payload: bellScheduleConfig,
  });

  saveDatabaseToDisk();
  res.json({ success: true, bellScheduleConfig });
});

app.post('/api/bell-schedule/test-ring', (req, res) => {
  const { chimeType, name } = req.body;
  const testAnnouncement: Announcement = {
    id: `bell-manual-${Date.now()}`,
    timestamp: Date.now(),
    type: 'chime',
    chimeType: chimeType || 'period_bell',
    sender: req.body.sender || 'Central Server Admin',
    title: name || 'School Period Bell Test',
    targetType: 'all',
    targetIds: [],
    priority: 'normal',
    duration: 4,
  };

  announcementHistory.push(testAnnouncement);
  if (announcementHistory.length > 50) announcementHistory.shift();

  broadcastWS({
    type: 'announcement_play',
    payload: testAnnouncement,
  });

  broadcastWS({
    type: 'announcement_dispatched',
    payload: testAnnouncement,
  });

  saveDatabaseToDisk();
  res.json({ success: true, announcement: testAnnouncement });
});

// Full School Configuration Backup & Restore Endpoints
app.get('/api/backup/export', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="school_pa_backup_${new Date().toISOString().split('T')[0]}.json"`
  );
  res.json({
    version: 1,
    exportedAt: Date.now(),
    classrooms: Array.from(classrooms.values()),
    transmitterLockConfig,
    bellScheduleConfig,
    announcementHistory: announcementHistory.slice(-50),
  });
});

app.post('/api/backup/import', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    if (Array.isArray(data.classrooms)) {
      classrooms.clear();
      data.classrooms.forEach((c: Classroom) => classrooms.set(c.id, c));
      broadcastClassroomList();
    }

    if (data.transmitterLockConfig?.lockPassword) {
      transmitterLockConfig = data.transmitterLockConfig;
      broadcastWS({
        type: 'transmitter_lock_sync',
        payload: transmitterLockConfig,
      });
    }

    if (data.bellScheduleConfig && Array.isArray(data.bellScheduleConfig.items)) {
      bellScheduleConfig = data.bellScheduleConfig;
      broadcastWS({
        type: 'bell_schedule_sync',
        payload: bellScheduleConfig,
      });
    }

    saveDatabaseToDisk();
    res.json({
      success: true,
      restoredClassrooms: classrooms.size,
      restoredBells: bellScheduleConfig.items.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

// Start Server and Vite setup
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server,
          clientPort: 443,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`School PA Central Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
